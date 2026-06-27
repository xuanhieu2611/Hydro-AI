import type { UnitPreference } from './data/types';

/**
 * Unit helpers. Canonical storage is ALWAYS ml (CLAUDE.md hard rule);
 * convert to oz only here, at the display layer.
 */

const ML_PER_FL_OZ = 29.5735;

export function mlToOz(ml: number): number {
  return ml / ML_PER_FL_OZ;
}

export function ozToMl(oz: number): number {
  return oz * ML_PER_FL_OZ;
}

/** Format a canonical ml value for display in the user's preferred unit. */
export function formatVolume(ml: number, unit: UnitPreference): string {
  if (unit === 'oz') {
    return `${Math.round(mlToOz(ml))} oz`;
  }
  return `${Math.round(ml)} ml`;
}

/** "1,240 / 2,000 ml" style progress label for the dashboard ring. */
export function formatProgress(
  intakeMl: number,
  goalMl: number,
  unit: UnitPreference,
): string {
  if (unit === 'oz') {
    return `${Math.round(mlToOz(intakeMl))} / ${Math.round(mlToOz(goalMl))} oz`;
  }
  return `${intakeMl.toLocaleString()} / ${goalMl.toLocaleString()} ml`;
}
