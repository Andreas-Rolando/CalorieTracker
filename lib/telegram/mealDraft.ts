import "server-only";
import { InlineKeyboard, type Context } from "grammy";
import {
  analyzeMealPhoto,
  analyzeMealText,
  GeminiAnalysisError,
} from "@/lib/gemini/mealAnalysis";
import type { MealAnalysis } from "@/lib/gemini/mealAnalysisSchema";
import { computeTotalsFromItems, scaleTotals } from "@/lib/nutrition/mealTotals";
import {
  createMealDraft,
  getPendingMealDraft,
  markMealDraftSaved,
  updateMealDraftBase,
  updateMealDraftPortion,
  type MealDraftBase,
  type MealDraftRow,
  type MealDraftSource,
} from "@/lib/repositories/mealDrafts";
import { insertFoodLog } from "@/lib/repositories/dailyFoodLogs";
import { getLocalDateString } from "@/lib/dateUtils";
import { clearBotSession, upsertBotSession } from "@/lib/repositories/botSessions";
import { formatDailySummaryMessage, getDailySummary } from "@/lib/telegram/dailySummary";
import type { UserRow } from "@/lib/repositories/users";

export const MEAL_EDIT_FLOW = "meal_edit";
export type MealEditState = { draftId: string };

const MIN_MULTIPLIER = 0.25;
const MAX_MULTIPLIER = 3;
const PORTION_STEP = 0.25;
const LOW_CONFIDENCE_THRESHOLD = 0.5;

function clampMultiplier(value: number): number {
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, value));
}

function buildDraftKeyboard(draftId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("➖ 25%", `meal:${draftId}:dec`)
    .text("➕ 25%", `meal:${draftId}:inc`)
    .row()
    .text("📝 Edit Manual", `meal:${draftId}:edit`)
    .row()
    .text("✅ Simpan", `meal:${draftId}:save`);
}

function formatDraftMessage(draft: MealDraftRow): string {
  const totals = scaleTotals(draft.base.totals, draft.portionMultiplier);
  const itemLines = draft.base.items.map((item) => `- ${item.name}`).join("\n");
  const confidenceNote =
    draft.base.confidence < LOW_CONFIDENCE_THRESHOLD
      ? "\n\n⚠️ Aku kurang yakin dengan estimasi ini, koreksi kalau perlu."
      : "";

  return (
    `🍽️ ${draft.base.mealName} (porsi ${draft.portionMultiplier}x)\n` +
    `${itemLines}\n\n` +
    `Kalori: ${totals.calories} kcal\n` +
    `Protein: ${totals.protein_g} g | Karbo: ${totals.carbs_g} g | Lemak: ${totals.fat_g} g\n\n` +
    `${draft.base.recommendation}${confidenceNote}\n\n` +
    "Koreksi porsi kalau kurang pas, lalu tekan Simpan."
  );
}

async function createDraftFromAnalysis(
  ctx: Context,
  telegramId: number,
  source: MealDraftSource,
  analysis: MealAnalysis
): Promise<void> {
  const base: MealDraftBase = {
    mealName: analysis.meal_name,
    items: analysis.items,
    totals: computeTotalsFromItems(analysis.items),
    confidence: analysis.confidence,
    recommendation: analysis.recommendation,
  };

  const draft = await createMealDraft({ telegramId, source, base });

  await ctx.reply(formatDraftMessage(draft), {
    reply_markup: buildDraftKeyboard(draft.id),
  });
}

/** Entry point for a plain-text message once the user is onboarded — analyzes it as a meal. */
export async function startMealAnalysis(
  ctx: Context,
  telegramId: number,
  description: string
): Promise<void> {
  let analysis: MealAnalysis;
  try {
    analysis = await analyzeMealText(description);
  } catch (error) {
    if (!(error instanceof GeminiAnalysisError)) throw error;
    await ctx.reply(
      'Maaf, aku belum bisa memperkirakan gizi dari pesan itu. Coba jelaskan lagi lebih detail ya (misal: "nasi goreng ayam 1 piring").'
    );
    return;
  }

  await createDraftFromAnalysis(ctx, telegramId, "text", analysis);
}

/**
 * Entry point for a photo message — either a plate of food or a packaged
 * product's nutrition-facts label. `imageBase64` is only held in memory
 * for this call; the caller is responsible for not persisting it (PRD
 * section 10 — no permanent meal photo storage).
 */
export async function startMealPhotoAnalysis(
  ctx: Context,
  telegramId: number,
  imageBase64: string,
  mimeType: string
): Promise<void> {
  let analysis: MealAnalysis;
  try {
    analysis = await analyzeMealPhoto({ imageBase64, mimeType });
  } catch (error) {
    if (!(error instanceof GeminiAnalysisError)) throw error;
    await ctx.reply(
      "Maaf, aku belum bisa membaca gizi dari foto itu. Coba foto lagi dengan pencahayaan yang lebih jelas ya."
    );
    return;
  }

  await createDraftFromAnalysis(ctx, telegramId, "photo", analysis);
}

export type MealDraftAction = "dec" | "inc" | "edit" | "save";

export async function handleMealDraftCallback(
  ctx: Context,
  telegramId: number,
  draftId: string,
  action: MealDraftAction,
  user: UserRow
): Promise<void> {
  const draft = await getPendingMealDraft(draftId, telegramId);
  if (!draft) {
    await ctx.answerCallbackQuery({
      text: "Draft ini sudah tidak berlaku. Kirim ulang deskripsi makanmu ya.",
      show_alert: true,
    });
    return;
  }

  if (action === "dec" || action === "inc") {
    const delta = action === "dec" ? -PORTION_STEP : PORTION_STEP;
    const nextMultiplier = clampMultiplier(draft.portionMultiplier + delta);

    if (nextMultiplier === draft.portionMultiplier) {
      await ctx.answerCallbackQuery({
        text: action === "dec" ? "Sudah di porsi minimum." : "Sudah di porsi maksimum.",
      });
      return;
    }

    await updateMealDraftPortion(draftId, telegramId, nextMultiplier);
    const updated: MealDraftRow = { ...draft, portionMultiplier: nextMultiplier };
    await ctx.editMessageText(formatDraftMessage(updated), {
      reply_markup: buildDraftKeyboard(draftId),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "edit") {
    await upsertBotSession({
      telegramId,
      flow: MEAL_EDIT_FLOW,
      step: "awaiting_values",
      state: { draftId } satisfies MealEditState,
      ttlMinutes: 10,
    });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Ketik nilai gizi manual dipisah spasi, urutan: kalori protein karbo lemak.\nContoh: 550 30 60 15"
    );
    return;
  }

  // action === "save"
  const totals = scaleTotals(draft.base.totals, draft.portionMultiplier);
  const consumedAt = new Date();
  const localDate = getLocalDateString(consumedAt, user.timezone);
  const totalEstimatedPortionG = draft.base.items.reduce(
    (sum, item) => sum + (item.estimated_portion_g ?? 0),
    0
  );

  await insertFoodLog({
    telegramId,
    foodName: draft.base.mealName,
    calories: totals.calories,
    proteinG: totals.protein_g,
    carbsG: totals.carbs_g,
    fatG: totals.fat_g,
    sugarG: totals.sugar_g,
    fiberG: totals.fiber_g,
    sodiumMg: totals.sodium_mg,
    estimatedPortionG:
      totalEstimatedPortionG > 0
        ? Math.round(totalEstimatedPortionG * draft.portionMultiplier)
        : undefined,
    portionMultiplier: draft.portionMultiplier,
    source: "text",
    aiConfidence: draft.base.confidence,
    consumedAt,
    localDate,
  });

  await markMealDraftSaved(draftId, telegramId);
  await clearBotSession(telegramId);
  await ctx.answerCallbackQuery({ text: "Tersimpan ✅" });

  const summary = await getDailySummary(telegramId, user.timezone);
  await ctx.editMessageText(
    `${draft.base.mealName} tersimpan ✅\n${totals.calories} kcal\n\n` +
      formatDailySummaryMessage(summary) +
      `\n\n— ${user.botAlias}`
  );
}

export async function handleMealEditReply(
  ctx: Context,
  telegramId: number,
  draftId: string,
  text: string
): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const numbers = parts.map(Number);

  if (
    numbers.length !== 4 ||
    numbers.some((n) => !Number.isFinite(n) || n < 0 || n > 10000)
  ) {
    await ctx.reply(
      "Formatnya belum pas. Ketik 4 angka dipisah spasi: kalori protein karbo lemak.\nContoh: 550 30 60 15"
    );
    return;
  }

  const draft = await getPendingMealDraft(draftId, telegramId);
  if (!draft) {
    await clearBotSession(telegramId);
    await ctx.reply("Draft ini sudah tidak berlaku. Kirim ulang deskripsi makanmu ya.");
    return;
  }

  const [calories, protein_g, carbs_g, fat_g] = numbers;
  const base: MealDraftBase = {
    ...draft.base,
    totals: { calories, protein_g, carbs_g, fat_g },
  };

  await updateMealDraftBase(draftId, telegramId, base);
  await clearBotSession(telegramId);

  const updated: MealDraftRow = { ...draft, base, portionMultiplier: 1 };
  await ctx.reply(formatDraftMessage(updated), {
    reply_markup: buildDraftKeyboard(draftId),
  });
}
