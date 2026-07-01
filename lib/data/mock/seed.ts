import type { LogEntry, Profile } from '../types';
import { dateKeyDaysAgo } from '../../date';

/** Stable ids for seeded rows; runtime additions use `genId`. */
let counter = 0;
export function genId(prefix = 'log'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export const MOCK_USER_ID = 'mock-user-0001';

export const seedProfile: Profile = {
  id: MOCK_USER_ID,
  display_name: 'Sam',
  avatar_url: null,
  daily_goal_ml: 2000,
  unit_preference: 'ml',
  // Seeded false so the first-run onboarding flow is reachable. With the mock
  // store resetting on reload, you can replay onboarding any time (or Skip it).
  onboarding_completed: false,
  // Reminders default off until the user opts in (onboarding or Profile).
  reminders_enabled: false,
  reminder_interval_hours: 2,
  reminder_window_start_hour: 8,
  reminder_window_end_hour: 20,
  created_at: new Date('2026-06-01T08:00:00Z').toISOString(),
};

/** Build a log entry on a given date key at a given local hour. */
function makeEntry(
  dateKey: string,
  hour: number,
  beverage_type: LogEntry['beverage_type'],
  volumeMl: number,
  coefficient: number,
  confidence: number | null,
): LogEntry {
  const loggedAt = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00`);
  return {
    id: genId('seed'),
    user_id: MOCK_USER_ID,
    logged_at: loggedAt.toISOString(),
    beverage_type,
    estimated_volume_ml: volumeMl,
    user_adjusted_volume_ml: null,
    hydration_coefficient: coefficient,
    effective_hydration_ml: Math.round(volumeMl * coefficient),
    thumbnail_url: null,
    ai_confidence_score: confidence,
  };
}

/**
 * A seeded week: today is partially filled (so the ring isn't full), and the
 * past 6 days vary between goal-met and missed so History has signal.
 */
export function buildSeedEntries(): LogEntry[] {
  const entries: LogEntry[] = [];

  // Today — ~1,180 ml so the progress ring sits mid-way toward 2,000.
  const today = dateKeyDaysAgo(0);
  entries.push(makeEntry(today, 8, 'water', 300, 1.0, 0.92));
  entries.push(makeEntry(today, 9, 'coffee', 240, 0.8, 0.86));
  entries.push(makeEntry(today, 12, 'water', 500, 1.0, 0.9));
  entries.push(makeEntry(today, 14, 'tea', 250, 0.9, 0.81));

  // Past days with assorted totals (some meet the 2,000 ml goal, some miss).
  const pastTotals = [2100, 1600, 2300, 900, 2000, 1850];
  pastTotals.forEach((target, i) => {
    const dateKey = dateKeyDaysAgo(i + 1);
    let remaining = target;
    let hour = 8;
    while (remaining > 0) {
      const sip = Math.min(remaining, 250 + ((i * 50) % 300));
      entries.push(makeEntry(dateKey, hour, 'water', sip, 1.0, 0.9));
      remaining -= sip;
      hour += 2;
    }
  });

  return entries;
}
