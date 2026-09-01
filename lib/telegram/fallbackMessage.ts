import "server-only";
import type { Update } from "grammy/types";
import { env } from "@/lib/env";

/**
 * Best-effort chat id extraction for the update kinds this bot actually
 * handles (text messages, callback queries). Used only for the "give up
 * after too many retries" notice — no need to cover every update kind.
 */
export function extractChatId(update: Update): number | undefined {
  return update.message?.chat.id ?? update.callback_query?.message?.chat.id;
}

/**
 * Sends a message directly via the Telegram Bot API `sendMessage` call,
 * bypassing grammY/bot init entirely. Used when we've given up retrying an
 * update (see reserve_telegram_update's "abandon" action) — the bot may
 * not even get initialized on that code path, and this is a single
 * best-effort notice, not something worth the extra machinery for.
 */
export async function sendFallbackMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Best-effort — if this fails there's nothing more useful to do.
  }
}
