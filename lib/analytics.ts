/**
 * Analytics boundary (Phase 4). Like the data layer, screens depend on this
 * interface — never on a concrete SDK — so swapping in PostHog/Amplitude/Expo
 * in Phase B is a one-line change here.
 *
 * For now `ConsoleAnalytics` just logs, which is enough to verify the right
 * events fire at the right moments while we're still on mock data. The event
 * set maps to the PRD success metrics (retention, logs/day, onboarding
 * completion — IMPLEMENTATION_PLAN.md §Phase 4).
 */

/** Strongly-typed event map: event name → its properties. */
export interface AnalyticsEvents {
  app_opened: { onboarded: boolean };
  onboarding_completed: { goal_ml: number; unit: string; reminders_enabled: boolean };
  onboarding_skipped: Record<string, never>;
  log_added: {
    method: 'camera' | 'gallery' | 'manual' | 'quick';
    beverage_type: string;
    volume_ml: number;
  };
  goal_met: { goal_ml: number; total_ml: number };
  reminders_configured: { enabled: boolean; interval_hours: number };
  data_cleared: Record<string, never>;
  account_deleted: Record<string, never>;
}

export type AnalyticsEvent = keyof AnalyticsEvents;

export interface Analytics {
  track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]): void;
}

class ConsoleAnalytics implements Analytics {
  track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`📊 [analytics] ${event}`, props);
    }
  }
}

/** Singleton. Phase B swaps the impl behind this same export. */
export const analytics: Analytics = new ConsoleAnalytics();
