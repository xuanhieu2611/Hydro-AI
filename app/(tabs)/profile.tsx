import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { VolumeAdjuster } from '@/components/VolumeAdjuster';
import { useProfile, useUpdateProfile } from '@/lib/query/hooks';
import { formatVolume } from '@/lib/units';
import type { UnitPreference } from '@/lib/data/types';

export default function ProfileScreen() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();

  const unit = profile.data?.unit_preference ?? 'ml';

  // Local goal draft so the stepper feels instant; Save persists it.
  const [goalMl, setGoalMl] = useState<number | null>(null);
  useEffect(() => {
    if (profile.data) setGoalMl(profile.data.daily_goal_ml);
  }, [profile.data?.daily_goal_ml]);

  const goalDirty = goalMl != null && goalMl !== profile.data?.daily_goal_ml;

  const saveGoal = () => {
    if (goalMl != null) updateProfile.mutate({ daily_goal_ml: goalMl });
  };

  const setUnit = (next: UnitPreference) => {
    if (next !== unit) updateProfile.mutate({ unit_preference: next });
  };

  const replayOnboarding = () => {
    // Flips the gate (app/_layout) → routes back into onboarding.
    updateProfile.mutate({ onboarding_completed: false });
  };

  if (profile.isLoading || goalMl == null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={['top']}>
        <ActivityIndicator color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="text-3xl font-bold text-slate-900">Profile</Text>
        <Text className="mt-1 text-base text-slate-500">
          {profile.data?.display_name ?? 'Your hydration settings'}
        </Text>

        {/* Daily goal (US-07) */}
        <Section title="Daily goal">
          <VolumeAdjuster
            valueMl={goalMl}
            onChange={setGoalMl}
            unit={unit}
            stepMl={100}
            minMl={500}
            maxMl={5000}
          />
          {goalDirty && (
            <Pressable
              onPress={saveGoal}
              disabled={updateProfile.isPending}
              className="mt-5 h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
            >
              {updateProfile.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Save goal ({formatVolume(goalMl, unit)})
                </Text>
              )}
            </Pressable>
          )}
        </Section>

        {/* Units (US-07) */}
        <Section title="Units">
          <View className="flex-row rounded-2xl bg-slate-100 p-1">
            {(['ml', 'oz'] as UnitPreference[]).map((u) => {
              const selected = u === unit;
              return (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  className={`flex-1 items-center rounded-xl py-2.5 ${
                    selected ? 'bg-white' : ''
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {u === 'ml' ? 'Milliliters' : 'Fluid ounces'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Replay onboarding (handy while iterating on the flow) */}
        <Pressable
          onPress={replayOnboarding}
          className="mt-auto mb-6 flex-row items-center gap-2 py-3"
        >
          <Ionicons name="refresh" size={18} color="#64748B" />
          <Text className="text-sm font-medium text-slate-500">Replay onboarding</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-8">
      <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </Text>
      {children}
    </View>
  );
}
