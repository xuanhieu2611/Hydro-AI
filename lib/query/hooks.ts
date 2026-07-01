import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { analyzer, dataSource, repository } from '../data';
import type {
  AnalysisResult,
  DailySummary,
  LogEntry,
  NewLogEntry,
  Profile,
} from '../data/types';
import { supabase } from '../supabase/client';
import { bumpInactivityNudge, syncStreakDanger, type NotifState } from '../notifications';
import { computeStreaks } from '../streak';
import { todayKey } from '../date';
import { MOCK_USER_ID } from '../data/mock/seed';
import { clearDraft, loadDraft } from '../onboarding/draft';
import { queryKeys } from './client';

/* ----------------------------------- auth ----------------------------------- */

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Tracks the Supabase auth session that gates the whole app (sign-in is
 * required — the last onboarding step, `components/SignInButtons`). Seeds from
 * the persisted session, then
 * follows `onAuthStateChange` so sign-in/out re-routes the nav gate instantly.
 *
 * Mock mode has no real auth, so it reports `authenticated` immediately and the
 * gate is bypassed (CLAUDE.md: mock stays fully working for fast UI iteration).
 */
export function useSession(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>(
    dataSource === 'mock' ? 'authenticated' : 'loading',
  );

  useEffect(() => {
    if (dataSource === 'mock') return;

    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authenticated' : 'unauthenticated');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return status;
}

export interface AuthIdentity {
  email: string | null;
  /** The provider that minted the session, e.g. 'apple' | 'google'. */
  provider: string | null;
}

/**
 * The signed-in user's email + provider for the Profile "Account" section.
 * Returns null in mock mode (no real auth) and while unauthenticated.
 */
export function useAuthIdentity(): AuthIdentity | null {
  const session = useSession();
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);

  useEffect(() => {
    if (dataSource === 'mock' || session !== 'authenticated') {
      setIdentity(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) {
        setIdentity({
          email: u.email ?? null,
          provider: (u.app_metadata?.provider as string | undefined) ?? null,
        });
      }
    });
  }, [session]);

  return identity;
}

/* ----------------------------------- reads ---------------------------------- */

export function useProfile() {
  // In supabase mode `getProfile()` requires a session, so only fetch once
  // signed in; the nav gate ensures this hook's consumers mount post-auth, but
  // `enabled` guards the brief unauthenticated window too.
  const session = useSession();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => repository.getProfile(),
    enabled: session === 'authenticated',
  });
}

export function useLogEntries(date: string = todayKey()) {
  return useQuery({
    queryKey: queryKeys.logEntries(date),
    queryFn: () => repository.getLogEntries(date),
  });
}

export function useDailySummary(date: string = todayKey()) {
  return useQuery({
    queryKey: queryKeys.dailySummary(date),
    queryFn: () => repository.getDailySummary(date),
  });
}

export function useHistory(rangeDays: number) {
  return useQuery({
    queryKey: queryKeys.history(rangeDays),
    queryFn: () => repository.getHistory(rangeDays),
  });
}

/* --------------------------------- mutations -------------------------------- */

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => repository.updateProfile(patch),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile, profile);
      // Goal changes affect every summary/history rollup.
      qc.invalidateQueries({ queryKey: ['dailySummary'] });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

/**
 * Flush the buffered onboarding answers (see `lib/onboarding/draft`) into the
 * profile once a session exists. The app is onboarding-first: answers are
 * collected before sign-in, then written here after it. This lives at the root
 * (not in the onboarding screen) because the moment the session flips, the
 * profile-load splash unmounts onboarding — so an in-component flush would be
 * cut short. `enabled` should be `authenticated && profile loaded && !onboarded`.
 * Returns `finalizing` so the gate can hold the splash during the write.
 */
export function useFinalizeOnboarding(enabled: boolean): boolean {
  const updateProfile = useUpdateProfile();
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      // No draft → nothing to flush; the onboarding gate stays up so the user
      // can complete it (e.g. an account that signed in but never finished).
      if (!draft) return;
      setFinalizing(true);
      try {
        // Only override display_name when the user actually typed one — otherwise
        // keep whatever the provider seeded (`seedIdentity`).
        const patch: Partial<Profile> = {
          daily_goal_ml: draft.daily_goal_ml,
          unit_preference: draft.unit_preference,
          reminders_enabled: draft.reminders_enabled,
          onboarding_completed: true,
        };
        if (draft.display_name) patch.display_name = draft.display_name;
        await updateProfile.mutateAsync(patch);
        await clearDraft();
      } finally {
        if (!cancelled) setFinalizing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return finalizing;
}

/**
 * Log a drink with an optimistic insert so the dashboard reacts instantly
 * (CLAUDE.md: logging uses optimistic updates). Logs are always "now" → today.
 */
/**
 * Best-effort snapshot of today's day-state for notification copy, read from the
 * query cache (no fetch). Streak comes from the 90-day history and remaining ml
 * from today's summary; both may be absent on a cold cache, in which case the
 * copy engine falls back to its generic lines. Refreshed wherever we (re)schedule
 * notifications — profile change, app foreground, and after each log.
 */
export function notifStateFromCache(qc: QueryClient): NotifState {
  const summary = qc.getQueryData<DailySummary>(queryKeys.dailySummary(todayKey()));
  const history = qc.getQueryData<DailySummary[]>(queryKeys.history(90));
  return {
    streak: history ? computeStreaks(history).current : undefined,
    remaining_ml: summary ? Math.max(0, summary.goal_ml - summary.total_intake_ml) : undefined,
    goal_ml: summary?.goal_ml,
  };
}

export function useAddLog() {
  const qc = useQueryClient();
  const date = todayKey();
  const key = queryKeys.logEntries(date);

  return useMutation({
    mutationFn: (entry: NewLogEntry) => repository.addLogEntry(entry),
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LogEntry[]>(key);

      const volume = entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml;
      const optimistic: LogEntry = {
        id: `optimistic_${Date.now()}`,
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

      qc.setQueryData<LogEntry[]>(key, (old) => [optimistic, ...(old ?? [])]);
      return { previous };
    },
    onError: (_err, _entry, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: () => {
      // Logging activity pushes the "haven't logged in a while" nudge back out
      // and refreshes the streak-saver (a log that crosses the goal cancels it).
      // State is read pre-invalidation, so it lags this log by one entry; the
      // foreground re-sync reconciles it — good enough for frozen local copy.
      const profile = qc.getQueryData<Profile>(queryKeys.profile);
      if (profile) {
        const state = notifStateFromCache(qc);
        bumpInactivityNudge(profile, state);
        syncStreakDanger(profile, state);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: queryKeys.dailySummary(date) });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useUpdateLog(date: string = todayKey()) {
  const qc = useQueryClient();
  const key = queryKeys.logEntries(date);

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LogEntry> }) =>
      repository.updateLogEntry(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LogEntry[]>(key);
      qc.setQueryData<LogEntry[]>(key, (old) =>
        (old ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: queryKeys.dailySummary(date) });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useDeleteLog(date: string = todayKey()) {
  const qc = useQueryClient();
  const key = queryKeys.logEntries(date);

  return useMutation({
    mutationFn: (id: string) => repository.deleteLogEntry(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LogEntry[]>(key);
      qc.setQueryData<LogEntry[]>(key, (old) =>
        (old ?? []).filter((e) => e.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: queryKeys.dailySummary(date) });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

/** Wipe all logged history (keeps the profile). GDPR/CCPA, Phase 4. */
export function useClearAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repository.clearAllLogs(),
    onSuccess: () => {
      // Everything log-derived is now empty — refetch across the app.
      qc.invalidateQueries({ queryKey: ['logEntries'] });
      qc.invalidateQueries({ queryKey: ['dailySummary'] });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

/** Delete the account: wipe logs + reset the profile to first-run state. */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repository.deleteAccount(),
    onSuccess: () => {
      // Profile reset flips the onboarding gate; clear all caches.
      qc.invalidateQueries();
    },
  });
}

/* ----------------------------------- AI ------------------------------------- */

/** Run the (mock) analyzer on a captured/picked image. */
export function useAnalyzeImage() {
  return useMutation<AnalysisResult, Error, string>({
    mutationFn: (uri: string) => analyzer.analyzeImage(uri),
  });
}
