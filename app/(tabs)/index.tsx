import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ProgressRing } from '@/components/ProgressRing';
import { LogFeed } from '@/components/LogFeed';
import { QuickLogBar } from '@/components/QuickLogBar';
import { useProfile, useDailySummary, useLogEntries } from '@/lib/query/hooks';
import { formatProgress, formatVolume } from '@/lib/units';

export default function HomeScreen() {
  const profile = useProfile();
  const summary = useDailySummary();
  const entries = useLogEntries();

  const unit = profile.data?.unit_preference ?? 'ml';
  const intake = summary.data?.total_intake_ml ?? 0;
  const goal = summary.data?.goal_ml ?? profile.data?.daily_goal_ml ?? 2000;
  const progress = goal > 0 ? intake / goal : 0;
  const remaining = Math.max(0, goal - intake);
  const goalMet = summary.data?.goal_met ?? false;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-4 pb-32">
        <Text className="text-3xl font-bold text-slate-900">Hydro AI</Text>
        <Text className="mt-1 text-base text-slate-500">
          {profile.data?.display_name
            ? `Hi ${profile.data.display_name} — let's stay hydrated.`
            : 'Snap a drink to log your hydration.'}
        </Text>

        {/* Progress ring */}
        <View className="mt-8 items-center">
          <ProgressRing progress={progress}>
            {summary.isLoading ? (
              <ActivityIndicator color="#0EA5E9" />
            ) : (
              <View className="items-center">
                <Text className="text-4xl font-bold text-slate-900">
                  {Math.round(progress * 100)}%
                </Text>
                <Text className="mt-1 text-sm text-slate-500">
                  {formatProgress(intake, goal, unit)}
                </Text>
              </View>
            )}
          </ProgressRing>

          <Text className="mt-4 text-center text-sm font-medium text-slate-500">
            {goalMet
              ? '🎉 Goal reached — nice work!'
              : `${formatVolume(remaining, unit)} to go`}
          </Text>
        </View>

        {/* Quick log — one-tap common drinks, no photo (PRD §4.3) */}
        <View className="mt-8">
          <Text className="mb-3 text-lg font-semibold text-slate-800">Quick log</Text>
          <QuickLogBar unit={unit} />
          <Link href="/manual-log" asChild>
            <Pressable className="mt-2 flex-row items-center justify-center gap-1.5 py-2">
              <Ionicons name="create-outline" size={16} color="#0284C7" />
              <Text className="text-sm font-medium text-hydro-600">Log manually</Text>
            </Pressable>
          </Link>
        </View>

        {/* Daily log feed */}
        <View className="mt-6">
          <Text className="mb-3 text-lg font-semibold text-slate-800">Today</Text>
          {entries.isLoading ? (
            <ActivityIndicator className="mt-6" color="#0EA5E9" />
          ) : (
            <LogFeed entries={entries.data ?? []} unit={unit} />
          )}
        </View>
      </ScrollView>

      {/* Camera-first: the shutter is the most prominent action (PRD §6). */}
      <Link href="/camera" asChild>
        <Pressable className="absolute bottom-8 self-center h-20 w-20 items-center justify-center rounded-full bg-hydro-500 shadow-lg active:bg-hydro-600">
          <Ionicons name="camera" size={34} color="white" />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
