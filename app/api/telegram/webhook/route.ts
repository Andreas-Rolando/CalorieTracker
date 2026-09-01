import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Update } from "grammy/types";
import { env } from "@/lib/env";
import { getInitializedBot } from "@/lib/telegram/bot";
import {
  markTelegramUpdateFailed,
  markTelegramUpdateProcessed,
  reserveTelegramUpdate,
} from "@/lib/repositories/telegramUpdates";
import { extractChatId, sendFallbackMessage } from "@/lib/telegram/fallbackMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidSecret(request: Request): boolean {
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!header) return false;

  const headerBuf = Buffer.from(header);
  const secretBuf = Buffer.from(env.TELEGRAM_WEBHOOK_SECRET);
  if (headerBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(headerBuf, secretBuf);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let update: Update;
  try {
    update = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (typeof update.update_id !== "number") {
    return new NextResponse("Missing update_id", { status: 400 });
  }

  const reservation = await reserveTelegramUpdate(update.update_id);
  if (reservation === "skip") {
    // Already processed, or another (fresh) delivery is already handling it.
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (reservation === "abandon") {
    // Failed too many times already — stop Telegram's retry loop instead
    // of burning more (possibly quota-limited) work on a doomed update.
    const chatId = extractChatId(update);
    if (chatId !== undefined) {
      await sendFallbackMessage(
        chatId,
        "Maaf, aku gagal memproses pesan itu setelah beberapa kali coba. Coba kirim ulang ya."
      );
    }
    return NextResponse.json({ ok: true, abandoned: true });
  }

  try {
    const bot = await getInitializedBot();
    await bot.handleUpdate(update);
    await markTelegramUpdateProcessed(update.update_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markTelegramUpdateFailed(update.update_id, message);
    // Non-2xx so Telegram retries the delivery; our idempotency table lets
    // that retry reprocess this update_id instead of skipping it.
    return new NextResponse("Internal error", { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
