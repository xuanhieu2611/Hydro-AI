import '../global.css';

import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { useFinalizeOnboarding, useProfile, useSession } from '@/lib/query/hooks';
import { useAppFonts } from '@/lib/fonts';
import { configureNotificationHandler, syncReminders } from '@/lib/notifications';
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

  // One app_opened event per cold start, once the profile resolves.
  const trackedOpen = useRef(false);
  useEffect(() => {
    if (profile.data && !trackedOpen.current) {
      trackedOpen.current = true;
      analytics.track('app_opened', { onboarded: profile.data.onboarding_completed });
    }
  }, [profile.data]);

  // Keep the OS reminder schedule reconciled with the saved settings. Re-runs
  // when any reminder field changes (idempotent; clears when disabled).
  const p = profile.data;
  useEffect(() => {
    if (p?.onboarding_completed) syncReminders(p);
  }, [
    p?.onboarding_completed,
    p?.reminders_enabled,
    p?.reminder_interval_hours,
    p?.reminder_window_start_hour,
    p?.reminder_window_end_hour,
  ]);

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
