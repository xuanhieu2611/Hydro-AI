import type {
  Profile,
  LogEntry,
  NewLogEntry,
  DailySummary,
} from './types';

/**
 * The single data-access contract the entire app codes against.
 *
 * CLAUDE.md net rule: screens/hooks depend on THIS interface, never on
 * `@supabase/supabase-js` directly. Phase 1 ships `MockRepository`; Phase B
 * adds `SupabaseRepository` implementing the same surface, and the only
 * change is flipping EXPO_PUBLIC_DATA_SOURCE.
 *
 * `date` params are local calendar dates formatted 'YYYY-MM-DD'.
 */
export interface DataRepository {
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;

  getLogEntries(date: string): Promise<LogEntry[]>;
  addLogEntry(entry: NewLogEntry): Promise<LogEntry>;
  updateLogEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry>;
  deleteLogEntry(id: string): Promise<void>;

  getDailySummary(date: string): Promise<DailySummary>;
  /** Most-recent-first summaries for the past `rangeDays` days (incl. today). */
  getHistory(rangeDays: number): Promise<DailySummary[]>;

  /** GDPR/CCPA (Phase 4): wipe all log history, keep the profile. */
  clearAllLogs(): Promise<void>;
  /** Delete the account — wipe logs and reset the profile to first-run state. */
  deleteAccount(): Promise<void>;
}
