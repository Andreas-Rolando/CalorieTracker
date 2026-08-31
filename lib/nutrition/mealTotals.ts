import type { MealItem, MealTotals } from "@/lib/gemini/mealAnalysisSchema";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumField(items: MealItem[], field: keyof MealItem): number {
  return items.reduce((total, item) => {
    const value = item[field];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function anyHas(items: MealItem[], field: keyof MealItem): boolean {
  return items.some((item) => typeof item[field] === "number");
}

/**
 * Recomputes meal totals deterministically from the item list, instead of
 * trusting Gemini's own `totals` field (PRD: prefer deterministic
 * application logic over AI-reported aggregates).
 */
export function computeTotalsFromItems(items: MealItem[]): MealTotals {
  return {
    calories: round1(sumField(items, "calories")),
    protein_g: round1(sumField(items, "protein_g")),
    carbs_g: round1(sumField(items, "carbs_g")),
    fat_g: round1(sumField(items, "fat_g")),
    ...(anyHas(items, "sugar_g") ? { sugar_g: round1(sumField(items, "sugar_g")) } : {}),
    ...(anyHas(items, "fiber_g") ? { fiber_g: round1(sumField(items, "fiber_g")) } : {}),
    ...(anyHas(items, "sodium_mg") ? { sodium_mg: round1(sumField(items, "sodium_mg")) } : {}),
  };
}

/** Scales totals by a portion multiplier and rounds to whole units. */
export function scaleTotals(totals: MealTotals, multiplier: number): MealTotals {
  const scale = (value: number | undefined) =>
    value === undefined ? undefined : Math.round(value * multiplier);

  return {
    calories: scale(totals.calories) as number,
    protein_g: scale(totals.protein_g) as number,
    carbs_g: scale(totals.carbs_g) as number,
    fat_g: scale(totals.fat_g) as number,
    ...(totals.sugar_g !== undefined ? { sugar_g: scale(totals.sugar_g) } : {}),
    ...(totals.fiber_g !== undefined ? { fiber_g: scale(totals.fiber_g) } : {}),
    ...(totals.sodium_mg !== undefined ? { sodium_mg: scale(totals.sodium_mg) } : {}),
  };
}
