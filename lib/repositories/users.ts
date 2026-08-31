import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActivityLevel, Gender, Goal } from "@/lib/nutrition/engine";

export interface UserRow {
  telegramId: number;
  name: string;
  botAlias: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  bmr: number;
  tdee: number;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
  timezone: string;
  dashboardToken: string;
  dashboardEnabled: boolean;
  onboardingCompleted: boolean;
}

interface UserDbRow {
  telegram_id: number;
  name: string;
  bot_alias: string;
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number;
  goal: Goal;
  activity_level: ActivityLevel;
  bmr: number;
  tdee: number;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  water_target_ml: number;
  timezone: string;
  dashboard_token: string;
  dashboard_enabled: boolean;
  onboarding_completed: boolean;
}

function fromDbRow(row: UserDbRow): UserRow {
  return {
    telegramId: row.telegram_id,
    name: row.name,
    botAlias: row.bot_alias,
    gender: row.gender,
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    targetWeightKg: row.target_weight_kg,
    goal: row.goal,
    activityLevel: row.activity_level,
    bmr: row.bmr,
    tdee: row.tdee,
    dailyCalorieTarget: row.daily_calorie_target,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
    waterTargetMl: row.water_target_ml,
    timezone: row.timezone,
    dashboardToken: row.dashboard_token,
    dashboardEnabled: row.dashboard_enabled,
    onboardingCompleted: row.onboarding_completed,
  };
}

export async function getUserByTelegramId(
  telegramId: number
): Promise<UserRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user: ${error.message}`);
  }
  return data ? fromDbRow(data as UserDbRow) : null;
}

export async function createUser(
  user: Omit<UserRow, "onboardingCompleted">
): Promise<UserRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .insert({
      telegram_id: user.telegramId,
      name: user.name,
      bot_alias: user.botAlias,
      gender: user.gender,
      age: user.age,
      height_cm: user.heightCm,
      weight_kg: user.weightKg,
      target_weight_kg: user.targetWeightKg,
      goal: user.goal,
      activity_level: user.activityLevel,
      bmr: user.bmr,
      tdee: user.tdee,
      daily_calorie_target: user.dailyCalorieTarget,
      protein_target_g: user.proteinTargetG,
      carbs_target_g: user.carbsTargetG,
      fat_target_g: user.fatTargetG,
      water_target_ml: user.waterTargetMl,
      timezone: user.timezone,
      dashboard_token: user.dashboardToken,
      dashboard_enabled: user.dashboardEnabled,
      onboarding_completed: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
  return fromDbRow(data as UserDbRow);
}
