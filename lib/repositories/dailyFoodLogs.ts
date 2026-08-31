import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface InsertFoodLogParams {
  telegramId: number;
  foodName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG?: number;
  fiberG?: number;
  sodiumMg?: number;
  estimatedPortionG?: number;
  portionMultiplier: number;
  source: "text" | "photo" | "voice" | "barcode" | "manual";
  aiConfidence?: number;
  consumedAt: Date;
  localDate: string;
}

export interface FoodLogTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function insertFoodLog(
  params: InsertFoodLogParams
): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_food_logs")
    .insert({
      telegram_id: params.telegramId,
      food_name: params.foodName,
      calories: params.calories,
      protein_g: params.proteinG,
      carbs_g: params.carbsG,
      fat_g: params.fatG,
      sugar_g: params.sugarG ?? null,
      fiber_g: params.fiberG ?? null,
      sodium_mg: params.sodiumMg ?? null,
      estimated_portion_g: params.estimatedPortionG ?? null,
      portion_multiplier: params.portionMultiplier,
      source: params.source,
      ai_confidence: params.aiConfidence ?? null,
      consumed_at: params.consumedAt.toISOString(),
      local_date: params.localDate,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert food log: ${error.message}`);
  }
  return { id: (data as { id: string }).id };
}

/** Sums today's (non-deleted) food logs. Personal-scale daily volume, so summing client-side is fine. */
export async function sumFoodLogsForDate(
  telegramId: number,
  localDate: string
): Promise<FoodLogTotals> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_food_logs")
    .select("calories, protein_g, carbs_g, fat_g")
    .eq("telegram_id", telegramId)
    .eq("local_date", localDate)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to sum food logs: ${error.message}`);
  }

  const rows = (data ?? []) as { calories: number; protein_g: number; carbs_g: number; fat_g: number }[];
  return rows.reduce<FoodLogTotals>(
    (totals, row) => ({
      calories: totals.calories + row.calories,
      proteinG: totals.proteinG + row.protein_g,
      carbsG: totals.carbsG + row.carbs_g,
      fatG: totals.fatG + row.fat_g,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}
