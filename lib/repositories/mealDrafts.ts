import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MealItem, MealTotals } from "@/lib/gemini/mealAnalysisSchema";

export type MealDraftSource = "text" | "photo" | "voice" | "barcode";
export type MealDraftStatus = "pending" | "saved" | "cancelled" | "expired";

/** Base (multiplier = 1) nutrition data a draft's displayed values scale from. */
export interface MealDraftBase {
  mealName: string;
  items: MealItem[];
  totals: MealTotals;
  confidence: number;
  recommendation: string;
}

export interface MealDraftRow {
  id: string;
  telegramId: number;
  source: MealDraftSource;
  base: MealDraftBase;
  portionMultiplier: number;
  status: MealDraftStatus;
  expiresAt: string;
}

interface MealDraftDbRow {
  id: string;
  telegram_id: number;
  source: MealDraftSource;
  base_nutrition_json: MealDraftBase;
  portion_multiplier: number;
  status: MealDraftStatus;
  expires_at: string;
}

const DEFAULT_TTL_MINUTES = 20;

function fromDbRow(row: MealDraftDbRow): MealDraftRow {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    source: row.source,
    base: row.base_nutrition_json,
    portionMultiplier: Number(row.portion_multiplier),
    status: row.status,
    expiresAt: row.expires_at,
  };
}

export async function createMealDraft(params: {
  telegramId: number;
  source: MealDraftSource;
  base: MealDraftBase;
  ttlMinutes?: number;
}): Promise<MealDraftRow> {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(
    Date.now() + (params.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60_000
  ).toISOString();

  const { data, error } = await supabase
    .from("meal_drafts")
    .insert({
      telegram_id: params.telegramId,
      source: params.source,
      base_nutrition_json: params.base,
      portion_multiplier: 1,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create meal draft: ${error.message}`);
  }
  return fromDbRow(data as MealDraftDbRow);
}

/** Loads a draft only if it belongs to the user, is pending, and hasn't expired. */
export async function getPendingMealDraft(
  id: string,
  telegramId: number
): Promise<MealDraftRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("meal_drafts")
    .select("*")
    .eq("id", id)
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load meal draft: ${error.message}`);
  }
  if (!data) return null;

  const row = fromDbRow(data as MealDraftDbRow);
  if (row.status !== "pending" || new Date(row.expiresAt).getTime() < Date.now()) {
    return null;
  }
  return row;
}

export async function updateMealDraftPortion(
  id: string,
  telegramId: number,
  portionMultiplier: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("meal_drafts")
    .update({ portion_multiplier: portionMultiplier })
    .eq("id", id)
    .eq("telegram_id", telegramId);

  if (error) {
    throw new Error(`Failed to update meal draft portion: ${error.message}`);
  }
}

/** Manual edit overrides the base totals outright and resets the multiplier to 1x. */
export async function updateMealDraftBase(
  id: string,
  telegramId: number,
  base: MealDraftBase
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("meal_drafts")
    .update({ base_nutrition_json: base, portion_multiplier: 1 })
    .eq("id", id)
    .eq("telegram_id", telegramId);

  if (error) {
    throw new Error(`Failed to update meal draft: ${error.message}`);
  }
}

export async function markMealDraftSaved(id: string, telegramId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("meal_drafts")
    .update({ status: "saved" })
    .eq("id", id)
    .eq("telegram_id", telegramId);

  if (error) {
    throw new Error(`Failed to mark meal draft saved: ${error.message}`);
  }
}

export async function cancelMealDraft(id: string, telegramId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("meal_drafts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("telegram_id", telegramId);

  if (error) {
    throw new Error(`Failed to cancel meal draft: ${error.message}`);
  }
}
