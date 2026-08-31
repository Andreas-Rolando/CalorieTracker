import { describe, expect, it } from "vitest";
import { computeTotalsFromItems, scaleTotals } from "./mealTotals";
import type { MealItem } from "@/lib/gemini/mealAnalysisSchema";

const items: MealItem[] = [
  { name: "Nasi putih", calories: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4, estimated_portion_g: 150 },
  { name: "Ayam goreng", calories: 250, protein_g: 25, carbs_g: 5, fat_g: 15, sodium_mg: 400 },
];

describe("computeTotalsFromItems", () => {
  it("sums numeric fields across items", () => {
    expect(computeTotalsFromItems(items)).toEqual({
      calories: 450,
      protein_g: 29,
      carbs_g: 49,
      fat_g: 15.4,
      sodium_mg: 400,
    });
  });

  it("omits optional fields no item reported", () => {
    const totals = computeTotalsFromItems(items);
    expect(totals.sugar_g).toBeUndefined();
    expect(totals.fiber_g).toBeUndefined();
  });
});

describe("scaleTotals", () => {
  it("scales and rounds every field by the multiplier", () => {
    const totals = computeTotalsFromItems(items);
    expect(scaleTotals(totals, 0.75)).toEqual({
      calories: 338,
      protein_g: 22,
      carbs_g: 37,
      fat_g: 12,
      sodium_mg: 300,
    });
  });

  it("is a no-op at multiplier 1 except rounding", () => {
    const totals = computeTotalsFromItems(items);
    expect(scaleTotals(totals, 1)).toEqual({
      calories: 450,
      protein_g: 29,
      carbs_g: 49,
      fat_g: 15,
      sodium_mg: 400,
    });
  });
});
