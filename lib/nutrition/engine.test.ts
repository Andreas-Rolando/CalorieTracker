import { describe, expect, it } from "vitest";
import {
  calculateBmr,
  calculateCalorieTarget,
  calculateMacroTargets,
  calculateNutritionTargets,
  calculateTdee,
  calculateWaterTargetMl,
} from "./engine";

describe("calculateBmr", () => {
  it("computes Mifflin-St Jeor for males", () => {
    const bmr = calculateBmr({
      gender: "male",
      age: 30,
      heightCm: 175,
      weightKg: 75,
    });
    // 10*75 + 6.25*175 - 5*30 + 5
    expect(bmr).toBeCloseTo(1698.75, 5);
  });

  it("computes Mifflin-St Jeor for females", () => {
    const bmr = calculateBmr({
      gender: "female",
      age: 28,
      heightCm: 162,
      weightKg: 58,
    });
    // 10*58 + 6.25*162 - 5*28 - 161
    expect(bmr).toBeCloseTo(1291.5, 5);
  });
});

describe("calculateTdee", () => {
  it("multiplies BMR by the activity factor", () => {
    expect(calculateTdee(1698.75, "sedentary")).toBeCloseTo(2038.5, 5);
    expect(calculateTdee(1698.75, "very_active")).toBeCloseTo(3227.625, 5);
  });
});

describe("calculateCalorieTarget", () => {
  const bmr = 1698.75;
  const tdee = 2038.5;

  it("subtracts the deficit for a lose goal", () => {
    // tdee - 500 = 1538.5, but that's below this bmr (1698.75), so the
    // bmr floor kicks in.
    expect(calculateCalorieTarget({ bmr, tdee, goal: "lose" })).toBeCloseTo(
      1698.75,
      5
    );
  });

  it("subtracts the deficit for a lose goal without hitting the bmr floor", () => {
    const activeTdee = 3227.625; // bmr * very_active factor
    expect(
      calculateCalorieTarget({ bmr, tdee: activeTdee, goal: "lose" })
    ).toBeCloseTo(2727.625, 5);
  });

  it("keeps TDEE for a maintain goal", () => {
    expect(calculateCalorieTarget({ bmr, tdee, goal: "maintain" })).toBeCloseTo(
      2038.5,
      5
    );
  });

  it("adds the surplus for a gain goal", () => {
    expect(calculateCalorieTarget({ bmr, tdee, goal: "gain" })).toBeCloseTo(
      2338.5,
      5
    );
  });

  it("never drops below the safe floor or BMR", () => {
    const target = calculateCalorieTarget({
      bmr: 1300,
      tdee: 1400,
      goal: "lose",
    });
    expect(target).toBeGreaterThanOrEqual(1300);
    expect(target).toBeGreaterThanOrEqual(1200);
  });
});

describe("calculateMacroTargets", () => {
  it("splits calories into protein/fat/carbs deterministically", () => {
    const { proteinTargetG, fatTargetG, carbsTargetG } = calculateMacroTargets({
      calorieTarget: 2038.5,
      weightKg: 75,
      goal: "maintain",
    });

    expect(proteinTargetG).toBeCloseTo(120, 5); // 1.6 g/kg * 75kg
    expect(fatTargetG).toBeCloseTo(56.625, 5); // 25% of calories / 9
    expect(carbsTargetG).toBeCloseTo(262.21875, 5);
  });

  it("never returns negative carbs", () => {
    const { carbsTargetG } = calculateMacroTargets({
      calorieTarget: 1200,
      weightKg: 120,
      goal: "lose",
    });
    expect(carbsTargetG).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateWaterTargetMl", () => {
  it("rounds to the nearest 50ml", () => {
    expect(calculateWaterTargetMl(75)).toBe(2500); // 75*33 = 2475 -> 2500
    expect(calculateWaterTargetMl(58)).toBe(1900); // 58*33 = 1914 -> 1900
  });
});

describe("calculateNutritionTargets", () => {
  it("returns a fully rounded target set", () => {
    const targets = calculateNutritionTargets({
      gender: "male",
      age: 30,
      heightCm: 175,
      weightKg: 75,
      activityLevel: "sedentary",
      goal: "maintain",
    });

    expect(targets).toEqual({
      bmr: 1699,
      tdee: 2039,
      calorieTarget: 2039,
      proteinTargetG: 120,
      carbsTargetG: 262,
      fatTargetG: 57,
      waterTargetMl: 2500,
    });
  });
});
