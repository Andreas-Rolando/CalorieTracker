import { z } from "zod";

/**
 * Structured output contract for Gemini meal analysis (PRD section 9).
 * Bounds are sanity ceilings so we reject clearly absurd values rather than
 * trusting the model blindly (PRD: "Reject or downgrade clearly absurd
 * values").
 */

const nonNegative = (max: number) => z.number().min(0).max(max);

export const mealItemSchema = z.object({
  name: z.string().min(1).max(120),
  estimated_portion_g: nonNegative(5000).optional(),
  calories: nonNegative(5000),
  protein_g: nonNegative(500),
  carbs_g: nonNegative(1000),
  fat_g: nonNegative(500),
  sugar_g: nonNegative(500).optional(),
  fiber_g: nonNegative(200).optional(),
  sodium_mg: nonNegative(20000).optional(),
});

export const mealTotalsSchema = z.object({
  calories: nonNegative(10000),
  protein_g: nonNegative(1000),
  carbs_g: nonNegative(2000),
  fat_g: nonNegative(1000),
  sugar_g: nonNegative(1000).optional(),
  fiber_g: nonNegative(400).optional(),
  sodium_mg: nonNegative(40000).optional(),
});

export const mealAnalysisSchema = z.object({
  meal_name: z.string().min(1).max(120),
  items: z.array(mealItemSchema).min(1).max(20),
  // Gemini's self-reported totals — validated for sanity, but the app
  // recomputes authoritative totals deterministically from `items` (see
  // lib/nutrition/mealTotals.ts) rather than trusting this field.
  totals: mealTotalsSchema,
  confidence: z.number().min(0).max(1),
  recommendation: z.string().min(1).max(500),
});

export type MealItem = z.infer<typeof mealItemSchema>;
export type MealTotals = z.infer<typeof mealTotalsSchema>;
export type MealAnalysis = z.infer<typeof mealAnalysisSchema>;

/**
 * JSON Schema sent to Gemini as `responseJsonSchema`. Built once at module
 * load since the schema is static.
 */
export const MEAL_ANALYSIS_JSON_SCHEMA = (() => {
  const schema = z.toJSONSchema(mealAnalysisSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
})();
