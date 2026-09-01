import { describe, expect, it } from "vitest";
import { MEAL_ANALYSIS_JSON_SCHEMA, mealAnalysisSchema } from "./mealAnalysisSchema";

const validAnalysis = {
  meal_name: "Nasi goreng ayam",
  items: [
    {
      name: "Nasi goreng ayam",
      estimated_portion_g: 350,
      calories: 550,
      protein_g: 25,
      carbs_g: 70,
      fat_g: 18,
    },
  ],
  totals: {
    calories: 550,
    protein_g: 25,
    carbs_g: 70,
    fat_g: 18,
  },
  confidence: 0.7,
  recommendation: "Cukup seimbang, coba tambah sayur untuk serat.",
};

describe("mealAnalysisSchema", () => {
  it("accepts a well-formed analysis", () => {
    const result = mealAnalysisSchema.safeParse(validAnalysis);
    expect(result.success).toBe(true);
  });

  it("rejects negative calories", () => {
    const result = mealAnalysisSchema.safeParse({
      ...validAnalysis,
      totals: { ...validAnalysis.totals, calories: -10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    const result = mealAnalysisSchema.safeParse({ ...validAnalysis, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects absurdly large calorie values", () => {
    const result = mealAnalysisSchema.safeParse({
      ...validAnalysis,
      totals: { ...validAnalysis.totals, calories: 999_999 },
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one item", () => {
    const result = mealAnalysisSchema.safeParse({ ...validAnalysis, items: [] });
    expect(result.success).toBe(false);
  });
});

describe("MEAL_ANALYSIS_JSON_SCHEMA", () => {
  it("is a plain JSON-serializable object without the $schema key", () => {
    expect(MEAL_ANALYSIS_JSON_SCHEMA).not.toHaveProperty("$schema");
    expect(() => JSON.stringify(MEAL_ANALYSIS_JSON_SCHEMA)).not.toThrow();
  });

  it("declares meal_name, items, totals, confidence, and recommendation", () => {
    const properties = MEAL_ANALYSIS_JSON_SCHEMA.properties as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining(["meal_name", "items", "totals", "confidence", "recommendation"])
    );
  });

  it("never contains minLength/maxLength/minimum/maximum (unsupported by Gemini's responseJsonSchema in practice)", () => {
    const seenKeys = new Set<string>();
    const collectKeys = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(collectKeys);
        return;
      }
      if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          seenKeys.add(key);
          collectKeys(value);
        }
      }
    };
    collectKeys(MEAL_ANALYSIS_JSON_SCHEMA);

    expect(seenKeys.has("minLength")).toBe(false);
    expect(seenKeys.has("maxLength")).toBe(false);
    expect(seenKeys.has("minimum")).toBe(false);
    expect(seenKeys.has("maximum")).toBe(false);
    expect(seenKeys.has("$schema")).toBe(false);
  });

  it("still keeps minItems/maxItems (those work fine against the live API)", () => {
    const items = MEAL_ANALYSIS_JSON_SCHEMA.properties as Record<string, { minItems?: number; maxItems?: number }>;
    expect(items.items.minItems).toBe(1);
    expect(items.items.maxItems).toBe(20);
  });
});
