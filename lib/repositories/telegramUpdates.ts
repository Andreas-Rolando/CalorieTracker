import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UpdateReservation = "process" | "skip";

const STALE_LOCK_SECONDS = 60;

/**
 * Atomically reserves a Telegram update_id for processing. See
 * `reserve_telegram_update` in supabase/migrations/0001_init.sql for the
 * idempotency/recovery rules (pipeline.md section 4).
 */
export async function reserveTelegramUpdate(
  updateId: number
): Promise<UpdateReservation> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("reserve_telegram_update", {
    p_update_id: updateId,
    p_stale_seconds: STALE_LOCK_SECONDS,
  });

  if (error) {
    throw new Error(`Failed to reserve telegram update: ${error.message}`);
  }

  const action = Array.isArray(data) ? data[0]?.action : undefined;
  return action === "process" ? "process" : "skip";
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
