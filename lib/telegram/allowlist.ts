import { env } from "@/lib/env";

const allowedIds = new Set(env.ALLOWED_TELEGRAM_IDS);

export function isAllowedTelegramId(telegramId: number): boolean {
  return allowedIds.has(telegramId);
}
