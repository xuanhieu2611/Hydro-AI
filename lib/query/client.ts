import { QueryClient } from '@tanstack/react-query';

/** Single shared QueryClient for the app (mounted in app/_layout.tsx). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Centralized query keys so hooks and invalidations stay in sync. */
export const queryKeys = {
  profile: ['profile'] as const,
  logEntries: (date: string) => ['logEntries', date] as const,
  dailySummary: (date: string) => ['dailySummary', date] as const,
  history: (rangeDays: number) => ['history', rangeDays] as const,
  connections: ['connections'] as const,
};
