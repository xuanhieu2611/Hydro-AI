/**
 * Shared domain types for Hydro AI.
 *
 * These intentionally mirror the eventual Supabase schema (see
 * IMPLEMENTATION_PLAN.md §Phase B) so swapping MockRepository for
 * SupabaseRepository is type-clean. Volumes are ALWAYS stored in ml
 * (CLAUDE.md hard rule); oz is a display-layer concern only.
 */

export type UnitPreference = 'ml' | 'oz';

export type BeverageType =
  | 'water'
  | 'coffee'
  | 'tea'
  | 'juice'
  | 'soda'
  | 'smoothie'
  | 'other';

export type ContainerType =
  | 'glass'
  | 'mug'
  | 'ceramic_mug'
  | 'disposable_cup'
  | 'water_bottle'
  | 'tumbler'
  | 'can'
  | 'pint_glass'
  | 'other';

/** User profile + hydration goal. Maps to the `profiles` table. */
export interface Profile {
  id: string;
  display_name: string | null;
  daily_goal_ml: number;
  unit_preference: UnitPreference;
  /** First-run flag — false until onboarding is finished (gates the app). */
  onboarding_completed: boolean;
  /** Reminder schedule (Phase 4). Drives the local notifications in lib/notifications. */
  reminders_enabled: boolean;
  /** Hours between reminders within the active window, e.g. 2. */
  reminder_interval_hours: number;
  /** Active window, local 24h clock — no reminders fire outside [start, end]. */
  reminder_window_start_hour: number; // e.g. 8  → 8am
  reminder_window_end_hour: number; // e.g. 20 → 8pm
  created_at: string; // ISO timestamp
}

/** A single logged drink. Maps to the `log_entries` table. */
export interface LogEntry {
  id: string;
  user_id: string;
  logged_at: string; // ISO timestamp
  beverage_type: BeverageType;
  /** What the AI (or quick-tile/manual default) proposed, in ml. */
  estimated_volume_ml: number;
  /** Non-null when the user nudged the volume on the result card, in ml. */
  user_adjusted_volume_ml: number | null;
  /** Multiplier applied to the actual volume (water 1.0, coffee 0.8, ...). */
  hydration_coefficient: number;
  /** Effective hydration = (adjusted ?? estimated) × coefficient, in ml. */
  effective_hydration_ml: number;
  /** Local thumbnail URI now; Supabase Storage URL after the backend swap. */
  thumbnail_url: string | null;
  /** 0..1 AI confidence; null for manual/quick-tile logs. */
  ai_confidence_score: number | null;
}

/**
 * Input to `addLogEntry`. The repository owns id/user_id/logged_at and
 * derives `effective_hydration_ml`, so callers don't pass them.
 */
export interface NewLogEntry {
  beverage_type: BeverageType;
  estimated_volume_ml: number;
  user_adjusted_volume_ml?: number | null;
  hydration_coefficient: number;
  thumbnail_url?: string | null;
  ai_confidence_score?: number | null;
  /** Optional override; defaults to "now" in the repository. */
  logged_at?: string;
}

/**
 * Structured result from the AI boundary. Mirrors the JSON contract the
 * Edge Function will return (IMPLEMENTATION_PLAN.md §Phase B).
 */
export interface AnalysisResult {
  is_drink: boolean;
  container_type: ContainerType | null;
  beverage_type: BeverageType | null;
  estimated_volume_ml: number | null;
  /** [low, high] when confidence is low; null when confident. */
  volume_range_ml: [number, number] | null;
  /** 0..1 — how full the container looks. */
  fill_ratio: number | null;
  /** 0..1 confidence. < 0.70 → force confirmation (CLAUDE.md). */
  confidence: number;
  hydration_coefficient: number | null;
  /** Short human-readable rationale for the transparency UX (PRD §6). */
  reasoning?: string;
}

/** Per-day rollup. Backed by the `daily_summary` SQL view after the swap. */
export interface DailySummary {
  date: string; // 'YYYY-MM-DD'
  total_intake_ml: number;
  goal_ml: number;
  goal_met: boolean;
  entry_count: number;
}
