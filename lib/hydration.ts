/**
 * Daily-goal recommendation (US-08). Pure functions — no UI, no storage.
 * Output is canonical ml (CLAUDE.md hard rule); the display layer formats it.
 */

export type ActivityLevel = 'low' | 'moderate' | 'high';

export const ACTIVITY_META: Record<
  ActivityLevel,
  { label: string; description: string; bonusMl: number }
> = {
  low: { label: 'Low', description: 'Mostly sitting', bonusMl: 0 },
  moderate: { label: 'Moderate', description: 'On your feet / light exercise', bonusMl: 350 },
  high: { label: 'High', description: 'Intense or frequent workouts', bonusMl: 700 },
};

const LB_PER_KG = 2.20462;
const ML_PER_KG = 35; // common rule-of-thumb baseline

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/** Round to the nearest 50 ml so recommendations read as tidy goals. */
export function roundGoalMl(ml: number): number {
  return Math.round(ml / 50) * 50;
}

/**
 * Recommend a daily goal from body weight + activity level. Baseline is
 * ~35 ml/kg with an activity bonus, clamped to a sane range.
 */
export function recommendGoalMl(weightKg: number, activity: ActivityLevel): number {
  const raw = weightKg * ML_PER_KG + ACTIVITY_META[activity].bonusMl;
  return Math.max(1000, Math.min(5000, roundGoalMl(raw)));
}
