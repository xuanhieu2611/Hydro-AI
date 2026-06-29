/**
 * Streak rollups — the single source of truth shared by Home, History and
 * Profile. A "streak" is consecutive days that met the daily goal (the strict
 * rule; logging without hitting goal doesn't extend it).
 *
 * Input is a most-recent-first, calendar-contiguous range (what
 * `repository.getHistory` returns). Consecutive array positions are therefore
 * consecutive calendar days, which keeps the run logic simple.
 */

import type { DailySummary } from './data/types';
import { todayKey } from './date';

export interface StreakInfo {
  /**
   * Consecutive goal-met days ending at the most recent day. Today counts as
   * "in progress": an unmet today doesn't break a streak built on prior days.
   */
  current: number;
  /** Longest run of consecutive goal-met days anywhere in the range. */
  longest: number;
}

/** Roll a most-recent-first range up into the current + longest streak. */
export function computeStreaks(days: DailySummary[]): StreakInfo {
  // Current: walk back from the most recent day, skipping an unmet today.
  let current = 0;
  let start = 0;
  if (days[0]?.date === todayKey() && !days[0]?.goal_met) start = 1;
  for (let i = start; i < days.length; i++) {
    if (days[i].goal_met) current++;
    else break;
  }

  // Longest: the longest consecutive met-run across the whole range.
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.goal_met) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  return { current, longest };
}

/** Streak lengths (days) worth a celebration, ascending. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;

/** Whether `n` days is a celebration-worthy milestone. */
export function isStreakMilestone(n: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(n);
}

/** "3-day streak" / "1-day streak" — shared label so copy stays consistent. */
export function streakLabel(n: number): string {
  return `${n}-day streak`;
}
