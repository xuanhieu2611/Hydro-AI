import '../global.css';

import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import {
  notifStateFromCache,
  useFinalizeOnboarding,
  useProfile,
  useSession,
} from '@/lib/query/hooks';
import { useAppFonts } from '@/lib/fonts';
import {
  configureNotificationHandler,
  syncReminders,
  syncStreakDanger,
} from '@/lib/notifications';
import { configureGoogleSignin } from '@/lib/auth';
import { analytics } from '@/lib/analytics';

// Foreground handler must be registered before any notification can present.
configureNotificationHandler();
// One-time native Google sign-in config (no-op in mock mode at runtime).
configureGoogleSignin();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Onboarding-first gate. The app is reachable only once `onboarding_completed`
 * is true; everything before that (name → goal → units → reminders → sign-in)
 * lives in the `onboarding` route, which is therefore shown whenever the user
 * isn't fully onboarded — signed out *or* signed-in-but-not-onboarded. Sign-in
 * is the last onboarding step (Apple/Google required); on success the buffered
 * answers are flushed by `useFinalizeOnboarding`, which flips the gate to the
 * tabs. `Stack.Protected` swaps the reachable routes so no manual redirects are
 * needed, and a splash holds while booting or finalizing to avoid flashing the
 * wrong screen. In mock mode `useSession` is always authenticated, so the
 * sign-in step is skipped (onboarding still shows until completed).
 */
function RootNavigator() {
  const session = useSession();
  const profile = useProfile();
  const fontsLoaded = useAppFonts();
  const qc = useQueryClient();

  // One app_opened event per cold start, once the profile resolves.
  const trackedOpen = useRef(false);
  useEffect(() => {
    if (profile.data && !trackedOpen.current) {
      trackedOpen.current = true;
      analytics.track('app_opened', { onboarded: profile.data.onboarding_completed });
    }
  }, [profile.data]);

  // Keep the OS reminder schedule + streak-saver reconciled with the saved
  // settings and today's state. Re-runs when any reminder field changes
  // (idempotent; clears when disabled). The day-state snapshot personalizes the
  // frozen copy; it's refreshed again on every app foreground below.
  const p = profile.data;
  useEffect(() => {
    if (!p?.onboarding_completed) return;
    const state = notifStateFromCache(qc);
    syncReminders(p, state);
    syncStreakDanger(p, state);
  }, [
    p?.onboarding_completed,
    p?.reminders_enabled,
    p?.reminder_interval_hours,
    p?.reminder_window_start_hour,
    p?.reminder_window_end_hour,
  ]);

  // Re-sync on every foreground so frozen local copy reflects recent progress —
  // e.g. the streak-saver goes quiet once today's goal is met. Cheap and
  // idempotent (cancel + reschedule our own tags only).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || !p?.onboarding_completed) return;
      const state = notifStateFromCache(qc);
      syncReminders(p, state);
      syncStreakDanger(p, state);
    });
    return () => sub.remove();
  }, [p, qc]);

  const authenticated = session === 'authenticated';
  const onboarded = !!profile.data?.onboarding_completed;
  // After sign-in, flush the buffered onboarding answers into the profile.
  const finalizing = useFinalizeOnboarding(
    authenticated && !!profile.data && !onboarded,
  );

  // Hold the splash while fonts/session load, (once signed in) while the profile
  // resolves, and while finalizing — so we never flash the wrong screen.
  const booting =
    !fontsLoaded ||
    session === 'loading' ||
    (authenticated && (profile.isLoading || !profile.data));

  if (booting || finalizing) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={authenticated && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="camera"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="manual-log"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="friends"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="dev"
          options={{ presentation: 'modal', title: 'Dev / Data layer check' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!(authenticated && onboarded)}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
