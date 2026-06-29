import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LiquidGauge } from '@/components/LiquidGauge';
import { CountUp } from '@/components/CountUp';
import { LogFeed } from '@/components/LogFeed';
import { QuickLogBar } from '@/components/QuickLogBar';
import { ErrorState } from '@/components/StateViews';
import { useProfile, useDailySummary, useLogEntries, useHistory } from '@/lib/query/hooks';
import { celebrateGoalMet } from '@/lib/notifications';
import { computeStreaks, isStreakMilestone, streakLabel } from '@/lib/streak';
import { analytics } from '@/lib/analytics';
import { gradients } from '@/lib/theme';
import { formatProgress, formatVolume } from '@/lib/units';

export default function HomeScreen() {
  const profile = useProfile();
  const summary = useDailySummary();
  const entries = useLogEntries();
  const history = useHistory(90);

  const unit = profile.data?.unit_preference ?? 'ml';
  const intake = summary.data?.total_intake_ml ?? 0;
  const goal = summary.data?.goal_ml ?? profile.data?.daily_goal_ml ?? 2000;
  const progress = goal > 0 ? intake / goal : 0;
  const remaining = Math.max(0, goal - intake);
  const goalMet = summary.data?.goal_met ?? false;

  const streak = useMemo(
    () => computeStreaks(history.data ?? []).current,
    [history.data],
  );

  // Goal-met celebration (US-14): the streak ticks up at the exact moment today
  // crosses the goal, so a growing streak is our trigger — fire once per
  // increase with an in-app banner + out-of-app notification + success metric.
  // Hitting a milestone (7, 30, …) upgrades the banner to a streak shout-out.
  const [celebration, setCelebration] = useState<
    { streak: number; milestone: boolean } | null
  >(null);
  const prevStreak = useRef<number | null>(null);
  useEffect(() => {
    if (history.data == null) return;
    const prev = prevStreak.current;
    prevStreak.current = streak;
    if (prev != null && streak > prev) {
      const milestone = isStreakMilestone(streak);
      setCelebration({ streak, milestone });
      celebrateGoalMet();
      analytics.track('goal_met', { goal_ml: goal, total_ml: intake });
      if (milestone) analytics.track('streak_milestone', { days: streak });
      const t = setTimeout(() => setCelebration(null), milestone ? 4500 : 3500);
      return () => clearTimeout(t);
    }
  }, [streak, history.data]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <ScrollView contentContainerClassName="px-6 pt-4 pb-32">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-hydro-950">Hydro AI</Text>
            <Text className="mt-1 text-base text-slate-500">
              {profile.data?.display_name
                ? `Hi ${profile.data.display_name} — let's stay hydrated.`
                : 'Snap a drink to log your hydration.'}
            </Text>
          </View>

          {streak > 0 && (
            <View className="mt-1 flex-row items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1.5">
              <Ionicons name="flame" size={16} color="#F97316" />
              <Text className="text-sm font-bold text-orange-600">{streak}</Text>
            </View>
          )}
        </View>

        {/* Liquid gauge — water rises toward the goal */}
        <View className="mt-8 items-center">
          <LiquidGauge progress={progress}>
            {summary.isLoading ? (
              <ActivityIndicator color="#0EA5E9" />
            ) : (
              <View className="items-center">
                <CountUp
                  value={Math.round(progress * 100)}
                  suffix="%"
                  className="text-5xl font-extrabold text-hydro-950"
                  style={{
                    textShadowColor: 'rgba(255,255,255,0.7)',
                    textShadowRadius: 6,
                  }}
                />
                <Text
                  className="mt-1 text-sm font-medium text-hydro-900"
                  style={{ textShadowColor: 'rgba(255,255,255,0.7)', textShadowRadius: 4 }}
                >
                  {formatProgress(intake, goal, unit)}
                </Text>
              </View>
            )}
          </LiquidGauge>

          <Text className="mt-5 text-center text-sm font-medium text-slate-500">
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
          ) : entries.isError ? (
            <ErrorState
              subtitle="Couldn't load today's drinks."
              onRetry={() => entries.refetch()}
            />
          ) : (
            <LogFeed entries={entries.data ?? []} unit={unit} />
          )}
        </View>
      </ScrollView>

      {/* Goal-met / streak-milestone celebration banner */}
      {celebration && (
        <Animated.View
          entering={FadeInDown.springify().damping(16)}
          exiting={FadeOut}
          pointerEvents="none"
          className={`absolute inset-x-6 top-16 flex-row items-center gap-3 rounded-2xl px-5 py-4 shadow-lg ${
            celebration.milestone ? 'bg-orange-500' : 'bg-hydro-500'
          }`}
        >
          <Text className="text-2xl">{celebration.milestone ? '🔥' : '🎉'}</Text>
          <View className="flex-1">
            <Text className="text-base font-bold text-white">
              {celebration.milestone
                ? `${streakLabel(celebration.streak)}!`
                : 'Goal reached!'}
            </Text>
            <Text className={`text-sm ${celebration.milestone ? 'text-orange-50' : 'text-hydro-50'}`}>
              {celebration.milestone
                ? `${celebration.streak} days in a row — keep it flowing!`
                : `You hit ${formatVolume(goal, unit)} today. Nice work.`}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Camera-first: the shutter is the most prominent action (PRD §6). */}
      <Link href="/camera" asChild>
        <Pressable className="absolute bottom-8 self-center h-20 w-20 items-center justify-center rounded-full bg-hydro-500 shadow-lg active:bg-hydro-600">
          <Ionicons name="camera" size={34} color="white" />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
