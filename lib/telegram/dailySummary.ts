import "server-only";
import { getLocalDateString } from "@/lib/dateUtils";
import { sumFoodLogsForDate } from "@/lib/repositories/dailyFoodLogs";
import { getActiveNutritionTarget } from "@/lib/repositories/nutritionTargetHistory";

export interface DailySummary {
  localDate: string;
  calorieTarget: number;
  caloriesConsumed: number;
  remainingCalories: number;
  proteinTargetG: number;
  proteinConsumedG: number;
  carbsTargetG: number;
  carbsConsumedG: number;
  fatTargetG: number;
  fatConsumedG: number;
}

/**
 * Food-only daily summary (PRD section 13 / pipeline.md section 9). Water
 * and workout aggregation are added once `/air` and `/workout` exist
 * (Milestone 4) — see progress.md.
 */
export async function getDailySummary(
  telegramId: number,
  timezone: string
): Promise<DailySummary> {
  const now = new Date();
  const localDate = getLocalDateString(now, timezone);

  const [target, consumed] = await Promise.all([
    getActiveNutritionTarget(telegramId, now),
    sumFoodLogsForDate(telegramId, localDate),
  ]);

  if (!target) {
    throw new Error(`No nutrition target history found for telegram_id=${telegramId}`);
  }

  return {
    localDate,
    calorieTarget: target.calorieTarget,
    caloriesConsumed: Math.round(consumed.calories),
    remainingCalories: Math.round(target.calorieTarget - consumed.calories),
    proteinTargetG: target.proteinTargetG,
    proteinConsumedG: Math.round(consumed.proteinG),
    carbsTargetG: target.carbsTargetG,
    carbsConsumedG: Math.round(consumed.carbsG),
    fatTargetG: target.fatTargetG,
    fatConsumedG: Math.round(consumed.fatG),
  };
}

export function formatDailySummaryMessage(summary: DailySummary): string {
  return (
    "Progres hari ini:\n\n" +
    `Kalori: ${summary.caloriesConsumed} / ${summary.calorieTarget} kcal\n` +
    `Sisa: ~${summary.remainingCalories} kcal\n\n` +
    `Protein: ${summary.proteinConsumedG} / ${summary.proteinTargetG} g\n` +
    `Karbo: ${summary.carbsConsumedG} / ${summary.carbsTargetG} g\n` +
    `Lemak: ${summary.fatConsumedG} / ${summary.fatTargetG} g`
  );
}
