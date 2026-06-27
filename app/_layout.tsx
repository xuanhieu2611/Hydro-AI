import '../global.css';

import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { useProfile } from '@/lib/query/hooks';

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
 * Onboarding gate: the profile decides which screen group is reachable.
 * `Stack.Protected` swaps the available routes when `onboarding_completed`
 * flips, so finishing onboarding auto-lands the app on the tabs (no manual
 * redirect needed). We hold a splash until the profile resolves to avoid a
 * flash of the wrong screen.
 */
function RootNavigator() {
  const profile = useProfile();

  if (profile.isLoading || !profile.data) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  const onboarded = profile.data.onboarding_completed;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded}>
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
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
