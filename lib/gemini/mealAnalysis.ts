import "server-only";
import { createPartFromBase64, createUserContent, type ContentListUnion } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import { env } from "@/lib/env";
import {
  MEAL_ANALYSIS_JSON_SCHEMA,
  mealAnalysisSchema,
  type MealAnalysis,
} from "@/lib/gemini/mealAnalysisSchema";
import { stripNulls } from "@/lib/utils/stripNulls";

export class GeminiAnalysisError extends Error {}

const COMMON_RULES = `Aturan:
- Jawab HANYA dengan JSON sesuai skema yang diberikan, tanpa teks lain di luar JSON.
- Pecah makanan menjadi item-item wajar (misal "nasi goreng + telur ceplok" jadi 2 item).
- Jangan mengarang bahan yang sama sekali tidak terlihat/tidak disebutkan atau tidak masuk akal.
- Isi "confidence" (0-1) mencerminkan seberapa yakin kamu dengan estimasi ini; gunakan nilai rendah (<0.5) jika input ambigu, tidak jelas, atau tidak terlihat seperti makanan/minuman.
- "recommendation" berisi satu kalimat singkat, suportif, dan tidak menghakimi dalam Bahasa Indonesia.`;

const TEXT_SYSTEM_INSTRUCTION = `Kamu adalah asisten nutrisi yang memperkirakan kandungan gizi dari deskripsi makanan berbahasa Indonesia yang ditulis pengguna.

${COMMON_RULES}
- Gunakan pengetahuan nutrisi umum per 100g bahan dan porsi yang disebutkan pengguna; jika porsi tidak disebutkan, asumsikan porsi rumahan yang wajar di Indonesia.`;

const PHOTO_SYSTEM_INSTRUCTION = `Kamu adalah asisten nutrisi yang menganalisis foto terkait makanan/minuman dari pengguna Indonesia. Foto bisa berupa salah satu dari dua jenis berikut — kenali dulu jenisnya:

1. Foto label "Informasi Nilai Gizi" pada kemasan produk.
   - Baca angka yang TERCETAK pada label (jangan mengarang), termasuk "Takaran Saji"/"Sajian per Kemasan" bila ada.
   - Jadikan SATU sajian (serving) sesuai label sebagai dasar (1 item, base porsi = takaran saji dalam gram bila tercantum). Pengguna bisa mengoreksi porsi setelahnya kalau makan lebih/kurang dari itu.
   - "meal_name" diisi nama produk pada kemasan bila terlihat, atau deskripsi singkat produknya.

2. Foto piring/porsi makanan.
   - Perkirakan jenis dan porsi makanan secara visual seperti biasa, gunakan pengetahuan nutrisi umum per 100g bahan.

${COMMON_RULES}`;

interface GenerateAnalysisParams {
  systemInstruction: string;
  contents: ContentListUnion;
}

async function generateAnalysis(params: GenerateAnalysisParams): Promise<MealAnalysis> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: params.contents,
    config: {
      systemInstruction: params.systemInstruction,
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

/**
 * Analyzes a free-form meal description with Gemini structured output,
 * then runtime-validates the result (PRD section 9). Throws
 * GeminiAnalysisError for anything the caller should treat as "couldn't
 * analyze this" rather than a transient/infra failure.
 */
export async function analyzeMealText(description: string): Promise<MealAnalysis> {
  return generateAnalysis({
    systemInstruction: TEXT_SYSTEM_INSTRUCTION,
    contents: `Deskripsi makanan dari pengguna:\n"""\n${description}\n"""`,
  });
}

/**
 * Analyzes a meal/nutrition-label photo with Gemini Vision, using the same
 * structured output contract and validation as `analyzeMealText`. The
 * caller is responsible for downloading the photo and discarding it
 * afterward — this function only holds the bytes in memory for the
 * duration of the API call (PRD section 10: no permanent image storage).
 */
export async function analyzeMealPhoto(params: {
  imageBase64: string;
  mimeType: string;
}): Promise<MealAnalysis> {
  const imagePart = createPartFromBase64(params.imageBase64, params.mimeType);
  return generateAnalysis({
    systemInstruction: PHOTO_SYSTEM_INSTRUCTION,
    contents: createUserContent([imagePart, "Analisis foto ini."]),
  });
}
