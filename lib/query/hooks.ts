import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { analyzer, repository } from '../data';
import type {
  AnalysisResult,
  LogEntry,
  NewLogEntry,
  Profile,
} from '../data/types';
import { bumpInactivityNudge } from '../notifications';
import { todayKey } from '../date';
import { MOCK_USER_ID } from '../data/mock/seed';
import { queryKeys } from './client';

/* ----------------------------------- reads ---------------------------------- */

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => repository.getProfile(),
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
 * Log a drink with an optimistic insert so the dashboard reacts instantly
 * (CLAUDE.md: logging uses optimistic updates). Logs are always "now" → today.
 */
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
      // Logging activity pushes the "haven't logged in a while" nudge back out.
      const profile = qc.getQueryData<Profile>(queryKeys.profile);
      if (profile) bumpInactivityNudge(profile);
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
