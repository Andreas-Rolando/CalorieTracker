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
 * Gemini's `responseJsonSchema` only supports a specific subset of JSON
 * Schema (per the @google/genai SDK docs): $id, $defs, $ref, $anchor,
 * type, format, title, description, enum, items, prefixItems, minItems,
 * maxItems, minimum, maximum, anyOf, oneOf, properties,
 * additionalProperties, required, propertyOrdering. Notably NOT included:
 * minLength/maxLength, which `z.toJSONSchema()` emits for every bounded
 * string field — sending those causes Gemini to reject the whole request
 * with 400 INVALID_ARGUMENT. Business-length bounds are still enforced by
 * `mealAnalysisSchema` at runtime; only the schema we hand to Gemini needs
 * pruning.
 */
const GEMINI_JSON_SCHEMA_SUPPORTED_KEYS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

/**
 * Keys whose *values* are maps from arbitrary user-defined names (field
 * names, $defs names) to nested schemas — the names themselves are data,
 * not JSON Schema keywords, and must never be filtered against the
 * keyword allowlist.
 */
const NAME_KEYED_MAP_KEYS = new Set(["properties", "$defs"]);

function stripUnsupportedJsonSchemaKeys(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedJsonSchemaKeys);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (!GEMINI_JSON_SCHEMA_SUPPORTED_KEYS.has(key)) continue;

    if (NAME_KEYED_MAP_KEYS.has(key) && value !== null && typeof value === "object") {
      const namedSchemas: Record<string, unknown> = {};
      for (const [name, nestedSchema] of Object.entries(value as Record<string, unknown>)) {
        namedSchemas[name] = stripUnsupportedJsonSchemaKeys(nestedSchema);
      }
      result[key] = namedSchemas;
    } else {
      result[key] = stripUnsupportedJsonSchemaKeys(value);
    }
  }
  return result;
}

/**
 * JSON Schema sent to Gemini as `responseJsonSchema`. Built once at module
 * load since the schema is static.
 */
export const MEAL_ANALYSIS_JSON_SCHEMA = stripUnsupportedJsonSchemaKeys(
  z.toJSONSchema(mealAnalysisSchema)
) as Record<string, unknown>;
