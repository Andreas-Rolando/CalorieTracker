/**
 * Deterministic nutrition calculations (BMR, TDEE, calorie target, macro
 * targets, water target). No AI involved — see PRD section 7.
 */

export type Gender = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** kcal/day adjustment applied to TDEE for lose/gain goals. */
const CALORIE_DEFICIT = 500;
const CALORIE_SURPLUS = 300;

/** Absolute floor so the calorie target never drops into an unsafe range. */
const MIN_CALORIE_TARGET = 1200;

/** g of protein per kg of current body weight. */
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 1.8,
  maintain: 1.6,
  gain: 1.8,
};

const FAT_CALORIE_SHARE = 0.25;

const ML_PER_KG_BODY_WEIGHT = 33;
const WATER_TARGET_ROUNDING_ML = 50;

export interface NutritionProfileInput {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
}

/** Mifflin-St Jeor equation. */
export function calculateBmr(input: {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.gender === "male" ? base + 5 : base - 161;
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

export function calculateCalorieTarget(params: {
  bmr: number;
  tdee: number;
  goal: Goal;
}): number {
  const raw =
    params.goal === "lose"
      ? params.tdee - CALORIE_DEFICIT
      : params.goal === "gain"
        ? params.tdee + CALORIE_SURPLUS
        : params.tdee;

  return Math.max(raw, MIN_CALORIE_TARGET, params.bmr);
}

export function calculateMacroTargets(params: {
  calorieTarget: number;
  weightKg: number;
  goal: Goal;
}): { proteinTargetG: number; carbsTargetG: number; fatTargetG: number } {
  const proteinTargetG = PROTEIN_G_PER_KG[params.goal] * params.weightKg;
  const proteinCalories = proteinTargetG * 4;

  const fatCalories = params.calorieTarget * FAT_CALORIE_SHARE;
  const fatTargetG = fatCalories / 9;

  const carbsCalories = Math.max(
    params.calorieTarget - proteinCalories - fatCalories,
    0
  );
  const carbsTargetG = carbsCalories / 4;

  return { proteinTargetG, carbsTargetG, fatTargetG };
}

export function calculateWaterTargetMl(weightKg: number): number {
  const raw = weightKg * ML_PER_KG_BODY_WEIGHT;
  return Math.round(raw / WATER_TARGET_ROUNDING_ML) * WATER_TARGET_ROUNDING_ML;
}

/** Computes the full set of nutrition targets for a user profile. */
export function calculateNutritionTargets(
  input: NutritionProfileInput
): NutritionTargets {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activityLevel);
  const calorieTarget = calculateCalorieTarget({ bmr, tdee, goal: input.goal });
  const { proteinTargetG, carbsTargetG, fatTargetG } = calculateMacroTargets({
    calorieTarget,
    weightKg: input.weightKg,
    goal: input.goal,
  });
  const waterTargetMl = calculateWaterTargetMl(input.weightKg);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget: Math.round(calorieTarget),
    proteinTargetG: Math.round(proteinTargetG),
    carbsTargetG: Math.round(carbsTargetG),
    fatTargetG: Math.round(fatTargetG),
    waterTargetMl,
  };
}
