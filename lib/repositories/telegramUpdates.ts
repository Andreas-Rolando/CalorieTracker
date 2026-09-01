import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UpdateReservation = "process" | "skip" | "abandon";

const STALE_LOCK_SECONDS = 60;

/**
 * After this many attempts, a permanently-failing update stops being
 * retried (see `reserve_telegram_update` in
 * supabase/migrations/0002_reserve_telegram_update_max_attempts.sql).
 * Bounds how much expensive work (Gemini calls) a single bad update can
 * trigger via Telegram's automatic webhook retries.
 */
const MAX_ATTEMPTS = 5;

/**
 * Atomically reserves a Telegram update_id for processing. See
 * `reserve_telegram_update` in supabase/migrations/0001_init.sql and
 * 0002_reserve_telegram_update_max_attempts.sql for the idempotency/
 * recovery/retry-cap rules (pipeline.md section 4).
 */
export async function reserveTelegramUpdate(
  updateId: number
): Promise<UpdateReservation> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("reserve_telegram_update", {
    p_update_id: updateId,
    p_stale_seconds: STALE_LOCK_SECONDS,
    p_max_attempts: MAX_ATTEMPTS,
  });

  if (error) {
    throw new Error(`Failed to reserve telegram update: ${error.message}`);
  }

  const action = Array.isArray(data) ? data[0]?.action : undefined;
  if (action === "process" || action === "abandon") return action;
  return "skip";
}

export async function markTelegramUpdateProcessed(
  updateId: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("telegram_updates")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("update_id", updateId);

  if (error) {
    throw new Error(`Failed to mark telegram update processed: ${error.message}`);
  }
}

export async function markTelegramUpdateFailed(
  updateId: number,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("telegram_updates")
    .update({ status: "failed", last_error: errorMessage.slice(0, 2000) })
    .eq("update_id", updateId);

  if (error) {
    throw new Error(`Failed to mark telegram update failed: ${error.message}`);
  }
}
