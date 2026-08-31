import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface BotSession<TState extends object = Record<string, unknown>> {
  telegramId: number;
  flow: string;
  step: string;
  state: TState;
  expiresAt: string;
}

const DEFAULT_TTL_MINUTES = 30;

/**
 * Loads the active bot session for a user, if any. Expired sessions are
 * treated as absent (persistent state, per PRD section 22 — never held only
 * in server memory).
 */
export async function getBotSession<TState extends object = Record<string, unknown>>(
  telegramId: number
): Promise<BotSession<TState> | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bot_sessions")
    .select("telegram_id, flow, step, state_json, expires_at")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bot session: ${error.message}`);
  }
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  return {
    telegramId: data.telegram_id,
    flow: data.flow,
    step: data.step,
    state: data.state_json as TState,
    expiresAt: data.expires_at,
  };
}

export async function upsertBotSession(params: {
  telegramId: number;
  flow: string;
  step: string;
  state: object;
  ttlMinutes?: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(
    Date.now() + (params.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60_000
  ).toISOString();

  const { error } = await supabase.from("bot_sessions").upsert({
    telegram_id: params.telegramId,
    flow: params.flow,
    step: params.step,
    state_json: params.state,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to save bot session: ${error.message}`);
  }
}

export async function clearBotSession(telegramId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bot_sessions")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    throw new Error(`Failed to clear bot session: ${error.message}`);
  }
}
