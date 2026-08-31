import "server-only";
import type { Context } from "grammy";
import {
  clearBotSession,
  upsertBotSession,
} from "@/lib/repositories/botSessions";
import { createUser, getUserByTelegramId } from "@/lib/repositories/users";
import { insertNutritionTargetHistory } from "@/lib/repositories/nutritionTargetHistory";
import { generateDashboardToken } from "@/lib/dashboardToken";
import {
  calculateNutritionTargets,
  type ActivityLevel,
  type Gender,
  type Goal,
} from "@/lib/nutrition/engine";
import { env } from "@/lib/env";

export const ONBOARDING_FLOW = "onboarding";

export type OnboardingStep =
  | "name"
  | "bot_alias"
  | "gender"
  | "age"
  | "height"
  | "weight"
  | "target_weight"
  | "activity_level"
  | "goal"
  | "timezone";

const STEP_ORDER: OnboardingStep[] = [
  "name",
  "bot_alias",
  "gender",
  "age",
  "height",
  "weight",
  "target_weight",
  "activity_level",
  "goal",
  "timezone",
];

export interface OnboardingState {
  name?: string;
  botAlias?: string;
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  timezone?: string;
}

const GENDER_OPTIONS: Record<string, Gender> = { "1": "male", "2": "female" };
const ACTIVITY_OPTIONS: Record<string, ActivityLevel> = {
  "1": "sedentary",
  "2": "light",
  "3": "moderate",
  "4": "active",
  "5": "very_active",
};
const GOAL_OPTIONS: Record<string, Goal> = {
  "1": "lose",
  "2": "maintain",
  "3": "gain",
};

function promptFor(step: OnboardingStep): string {
  switch (step) {
    case "name":
      return "Siapa nama kamu?";
    case "bot_alias":
      return "Mau panggil aku siapa? (contoh: BroCal)";
    case "gender":
      return "Jenis kelamin kamu?\n1. Laki-laki\n2. Perempuan\n\nBalas dengan angka 1 atau 2.";
    case "age":
      return "Berapa usia kamu (tahun)?";
    case "height":
      return "Berapa tinggi badan kamu (cm)?";
    case "weight":
      return "Berapa berat badan kamu sekarang (kg)?";
    case "target_weight":
      return "Berapa target berat badan kamu (kg)?";
    case "activity_level":
      return (
        "Seberapa aktif kegiatan harian kamu?\n" +
        "1. Jarang olahraga\n" +
        "2. Olahraga ringan (1-3x/minggu)\n" +
        "3. Olahraga sedang (3-5x/minggu)\n" +
        "4. Olahraga berat (6-7x/minggu)\n" +
        "5. Sangat aktif (fisik intens/atlet)\n\n" +
        "Balas dengan angka 1-5."
      );
    case "goal":
      return (
        "Apa tujuan kamu?\n" +
        "1. Menurunkan berat badan\n" +
        "2. Menjaga berat badan\n" +
        "3. Menaikkan berat badan\n\n" +
        "Balas dengan angka 1-3."
      );
    case "timezone":
      return "Zona waktu kamu? (contoh: Asia/Jakarta, Asia/Makassar, Asia/Jayapura)";
  }
}

function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = STEP_ORDER.indexOf(step);
  return STEP_ORDER[index + 1] ?? null;
}

export async function startOnboarding(
  ctx: Context,
  telegramId: number
): Promise<void> {
  const existing = await getUserByTelegramId(telegramId);
  if (existing?.onboardingCompleted) {
    await ctx.reply(
      `Selamat datang kembali, ${existing.name}! Ketik /help untuk lihat perintah yang ada.`
    );
    return;
  }

  const firstStep = STEP_ORDER[0];
  await upsertBotSession({
    telegramId,
    flow: ONBOARDING_FLOW,
    step: firstStep,
    state: {},
  });

  await ctx.reply(
    "Yuk kenalan dulu supaya aku bisa hitung kebutuhan kalori kamu.\n\n" +
      promptFor(firstStep)
  );
}

export async function continueOnboarding(
  ctx: Context,
  telegramId: number,
  step: OnboardingStep,
  state: OnboardingState,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  const updated: OnboardingState = { ...state };

  switch (step) {
    case "name": {
      if (trimmed.length < 1 || trimmed.length > 50) {
        await ctx.reply("Nama sepertinya kurang pas. Coba ketik ulang ya (maks 50 karakter).");
        return;
      }
      updated.name = trimmed;
      break;
    }
    case "bot_alias": {
      if (trimmed.length < 1 || trimmed.length > 30) {
        await ctx.reply("Nama panggilan maksimal 30 karakter. Coba lagi ya.");
        return;
      }
      updated.botAlias = trimmed;
      break;
    }
    case "gender": {
      const gender = GENDER_OPTIONS[trimmed];
      if (!gender) {
        await ctx.reply("Balas dengan angka 1 (Laki-laki) atau 2 (Perempuan) ya.");
        return;
      }
      updated.gender = gender;
      break;
    }
    case "age": {
      const age = Number(trimmed);
      if (!Number.isInteger(age) || age <= 0 || age >= 130) {
        await ctx.reply("Usia sepertinya kurang pas. Masukkan angka usia dalam tahun, contoh: 28.");
        return;
      }
      updated.age = age;
      break;
    }
    case "height": {
      const height = Number(trimmed);
      if (!Number.isFinite(height) || height < 100 || height > 250) {
        await ctx.reply("Tinggi badan sepertinya kurang pas. Masukkan dalam cm, contoh: 170.");
        return;
      }
      updated.heightCm = height;
      break;
    }
    case "weight": {
      const weight = Number(trimmed);
      if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
        await ctx.reply("Berat badan sepertinya kurang pas. Masukkan dalam kg, contoh: 65.");
        return;
      }
      updated.weightKg = weight;
      break;
    }
    case "target_weight": {
      const targetWeight = Number(trimmed);
      if (!Number.isFinite(targetWeight) || targetWeight < 30 || targetWeight > 300) {
        await ctx.reply("Target berat badan sepertinya kurang pas. Masukkan dalam kg, contoh: 60.");
        return;
      }
      updated.targetWeightKg = targetWeight;
      break;
    }
    case "activity_level": {
      const activityLevel = ACTIVITY_OPTIONS[trimmed];
      if (!activityLevel) {
        await ctx.reply("Balas dengan angka 1-5 ya.");
        return;
      }
      updated.activityLevel = activityLevel;
      break;
    }
    case "goal": {
      const goal = GOAL_OPTIONS[trimmed];
      if (!goal) {
        await ctx.reply("Balas dengan angka 1, 2, atau 3 ya.");
        return;
      }
      updated.goal = goal;
      break;
    }
    case "timezone": {
      if (!Intl.supportedValuesOf("timeZone").includes(trimmed)) {
        await ctx.reply(
          "Zona waktu tidak dikenali. Gunakan format IANA, contoh: Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura."
        );
        return;
      }
      updated.timezone = trimmed;
      break;
    }
  }

  const next = nextStep(step);
  if (next) {
    await upsertBotSession({
      telegramId,
      flow: ONBOARDING_FLOW,
      step: next,
      state: updated,
    });
    await ctx.reply(promptFor(next));
    return;
  }

  await finishOnboarding(ctx, telegramId, updated);
}

async function finishOnboarding(
  ctx: Context,
  telegramId: number,
  state: OnboardingState
): Promise<void> {
  if (
    !state.name ||
    !state.botAlias ||
    !state.gender ||
    !state.age ||
    !state.heightCm ||
    !state.weightKg ||
    !state.targetWeightKg ||
    !state.activityLevel ||
    !state.goal ||
    !state.timezone
  ) {
    // Should not happen — every step validates before advancing.
    await clearBotSession(telegramId);
    await ctx.reply("Ups, ada data yang belum lengkap. Yuk mulai lagi dengan /start.");
    return;
  }

  const targets = calculateNutritionTargets({
    gender: state.gender,
    age: state.age,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
    activityLevel: state.activityLevel,
    goal: state.goal,
  });

  const user = await createUser({
    telegramId,
    name: state.name,
    botAlias: state.botAlias,
    gender: state.gender,
    age: state.age,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
    targetWeightKg: state.targetWeightKg,
    goal: state.goal,
    activityLevel: state.activityLevel,
    bmr: targets.bmr,
    tdee: targets.tdee,
    dailyCalorieTarget: targets.calorieTarget,
    proteinTargetG: targets.proteinTargetG,
    carbsTargetG: targets.carbsTargetG,
    fatTargetG: targets.fatTargetG,
    waterTargetMl: targets.waterTargetMl,
    timezone: state.timezone,
    dashboardToken: generateDashboardToken(),
    dashboardEnabled: true,
  });

  await insertNutritionTargetHistory({
    telegramId,
    weightKg: user.weightKg,
    bmr: user.bmr,
    tdee: user.tdee,
    calorieTarget: user.dailyCalorieTarget,
    proteinTargetG: user.proteinTargetG,
    carbsTargetG: user.carbsTargetG,
    fatTargetG: user.fatTargetG,
    waterTargetMl: user.waterTargetMl,
  });

  await clearBotSession(telegramId);

  const dashboardUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/${user.dashboardToken}`;

  await ctx.reply(
    `Sip, ${user.name} 👍\n\n` +
      "Ini target harian kamu:\n" +
      `Kalori: ${user.dailyCalorieTarget} kcal\n` +
      `Protein: ${user.proteinTargetG} g\n` +
      `Karbo: ${user.carbsTargetG} g\n` +
      `Lemak: ${user.fatTargetG} g\n` +
      `Air: ${user.waterTargetMl} ml\n\n` +
      `Dashboard kamu: ${dashboardUrl}\n\n` +
      "Pencatatan makan, air minum, dan olahraga akan segera hadir. Sampai saat itu, ketik /help untuk lihat perintah yang ada.\n\n" +
      `— ${user.botAlias}`
  );
}
