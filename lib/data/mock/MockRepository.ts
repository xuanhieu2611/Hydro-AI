import type { DataRepository } from '../repository';
import type {
  DailySummary,
  LogEntry,
  NewLogEntry,
  Profile,
} from '../types';
import { dateKeyDaysAgo, isOnDate, todayKey } from '../../date';
import { buildSeedEntries, genId, MOCK_USER_ID, seedProfile } from './seed';

/** Simulate network latency so optimistic updates are observable. */
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function actualVolume(e: Pick<LogEntry, 'estimated_volume_ml' | 'user_adjusted_volume_ml'>) {
  return e.user_adjusted_volume_ml ?? e.estimated_volume_ml;
}

/**
 * In-memory DataRepository for UI-first development. State lives in module
 * scope so it persists across screens within a session (but resets on reload),
 * which is exactly what we want for fast UX iteration.
 */
export class MockRepository implements DataRepository {
  private profile: Profile = { ...seedProfile };
  private entries: LogEntry[] = buildSeedEntries();

  async getProfile(): Promise<Profile> {
    await delay();
    return { ...this.profile };
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    await delay();
    // Identity fields can't be patched away.
    this.profile = { ...this.profile, ...patch, id: this.profile.id };
    return { ...this.profile };
  }

  async getLogEntries(date: string): Promise<LogEntry[]> {
    await delay();
    return this.entries
      .filter((e) => isOnDate(e.logged_at, date))
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
      .map((e) => ({ ...e }));
  }

  async addLogEntry(entry: NewLogEntry): Promise<LogEntry> {
    await delay();
    const volume = entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml;
    const created: LogEntry = {
      id: genId(),
      user_id: MOCK_USER_ID,
      logged_at: entry.logged_at ?? new Date().toISOString(),
      beverage_type: entry.beverage_type,
      estimated_volume_ml: entry.estimated_volume_ml,
      user_adjusted_volume_ml: entry.user_adjusted_volume_ml ?? null,
      hydration_coefficient: entry.hydration_coefficient,
      effective_hydration_ml: Math.round(volume * entry.hydration_coefficient),
      thumbnail_url: entry.thumbnail_url ?? null,
      ai_confidence_score: entry.ai_confidence_score ?? null,
    };
    this.entries.push(created);
    return { ...created };
  }

  async updateLogEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry> {
    await delay();
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Log entry ${id} not found`);

    const merged: LogEntry = { ...this.entries[idx], ...patch, id };
    // Keep effective hydration consistent if volume/coefficient changed.
    merged.effective_hydration_ml = Math.round(
      actualVolume(merged) * merged.hydration_coefficient,
    );
    this.entries[idx] = merged;
    return { ...merged };
  }

  async deleteLogEntry(id: string): Promise<void> {
    await delay();
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  async getDailySummary(date: string): Promise<DailySummary> {
    await delay();
    return this.summaryFor(date);
  }

  async getHistory(rangeDays: number): Promise<DailySummary[]> {
    await delay();
    // Most-recent-first, including today.
    return Array.from({ length: rangeDays }, (_, i) =>
      this.summaryFor(dateKeyDaysAgo(i)),
    );
  }

  async clearAllLogs(): Promise<void> {
    await delay();
    this.entries = [];
  }

  async deleteAccount(): Promise<void> {
    await delay();
    // Wipe history and reset to a fresh, un-onboarded profile (keeps the id so
    // the rest of the session stays coherent; the real impl signs the user out).
    this.entries = [];
    this.profile = {
      ...seedProfile,
      id: this.profile.id,
      display_name: null,
      onboarding_completed: false,
      reminders_enabled: false,
    };
  }

  /** Synchronous rollup used by both summary methods. */
  private summaryFor(date: string): DailySummary {
    const dayEntries = this.entries.filter((e) => isOnDate(e.logged_at, date));
    const total = dayEntries.reduce((sum, e) => sum + actualVolume(e), 0);
    const goal = this.profile.daily_goal_ml;
    return {
      date,
      total_intake_ml: total,
      goal_ml: goal,
      goal_met: total >= goal,
      entry_count: dayEntries.length,
    };
  }
}

export const mockTodayKey = todayKey;
