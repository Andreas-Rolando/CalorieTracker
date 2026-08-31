import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { env } from "@/lib/env";
import {
  MEAL_ANALYSIS_JSON_SCHEMA,
  mealAnalysisSchema,
  type MealAnalysis,
} from "@/lib/gemini/mealAnalysisSchema";
import { stripNulls } from "@/lib/utils/stripNulls";

export class GeminiAnalysisError extends Error {}

const SYSTEM_INSTRUCTION = `Kamu adalah asisten nutrisi yang memperkirakan kandungan gizi dari deskripsi makanan berbahasa Indonesia yang ditulis pengguna.

Aturan:
- Jawab HANYA dengan JSON sesuai skema yang diberikan, tanpa teks lain di luar JSON.
- Pecah makanan menjadi item-item wajar (misal "nasi goreng + telur ceplok" jadi 2 item).
- Gunakan pengetahuan nutrisi umum per 100g bahan dan porsi yang disebutkan pengguna; jika porsi tidak disebutkan, asumsikan porsi rumahan yang wajar di Indonesia.
- Jangan mengarang bahan yang sama sekali tidak disebutkan atau tidak masuk akal dari deskripsi.
- Isi "confidence" (0-1) mencerminkan seberapa yakin kamu dengan estimasi ini; gunakan nilai rendah (<0.5) jika deskripsi ambigu, terlalu singkat, atau tidak terdengar seperti makanan.
- "recommendation" berisi satu kalimat singkat, suportif, dan tidak menghakimi dalam Bahasa Indonesia.`;

/**
 * Analyzes a free-form meal description with Gemini structured output,
 * then runtime-validates the result (PRD section 9). Throws
 * GeminiAnalysisError for anything the caller should treat as "couldn't
 * analyze this" rather than a transient/infra failure.
 */
export async function analyzeMealText(description: string): Promise<MealAnalysis> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: `Deskripsi makanan dari pengguna:\n"""\n${description}\n"""`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: MEAL_ANALYSIS_JSON_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new GeminiAnalysisError("Gemini returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiAnalysisError("Gemini returned invalid JSON");
  }

  const result = mealAnalysisSchema.safeParse(stripNulls(parsed));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new GeminiAnalysisError(`Gemini output failed validation: ${issues}`);
  }

  return result.data;
}
