import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface NutritionTargetSnapshot {
  telegramId: number;
  weightKg: number;
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
}

/**
 * Records a nutrition target snapshot. Called whenever targets change
 * (onboarding completion, weight updates) so the dashboard can compare past
 * intake against the target that was active at the time (PRD section 18).
 */
export async function insertNutritionTargetHistory(
  snapshot: NutritionTargetSnapshot
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("nutrition_target_history").insert({
    telegram_id: snapshot.telegramId,
    weight_kg: snapshot.weightKg,
    bmr: snapshot.bmr,
    tdee: snapshot.tdee,
    calorie_target: snapshot.calorieTarget,
    protein_target_g: snapshot.proteinTargetG,
    carbs_target_g: snapshot.carbsTargetG,
    fat_target_g: snapshot.fatTargetG,
    water_target_ml: snapshot.waterTargetMl,
  });

  if (error) {
    throw new Error(`Failed to insert nutrition target history: ${error.message}`);
  }
}

export interface ActiveNutritionTarget {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
}

/**
 * Loads the nutrition target that was active as of `asOf` (PRD section 18 —
 * targets change over time, so intake must be compared against the target
 * that was active at that point, not just the user's current one).
 */
export async function getActiveNutritionTarget(
  telegramId: number,
  asOf: Date
): Promise<ActiveNutritionTarget | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nutrition_target_history")
    .select("calorie_target, protein_target_g, carbs_target_g, fat_target_g, water_target_ml")
    .eq("telegram_id", telegramId)
    .lte("effective_from", asOf.toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active nutrition target: ${error.message}`);
  }
  if (!data) return null;

  return {
    calorieTarget: data.calorie_target,
    proteinTargetG: data.protein_target_g,
    carbsTargetG: data.carbs_target_g,
    fatTargetG: data.fat_target_g,
    waterTargetMl: data.water_target_ml,
  };
}
