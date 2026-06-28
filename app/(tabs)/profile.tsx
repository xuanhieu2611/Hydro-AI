import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { VolumeAdjuster } from '@/components/VolumeAdjuster';
import { gradients } from '@/lib/theme';
import {
  useProfile,
  useUpdateProfile,
  useClearAllData,
  useDeleteAccount,
} from '@/lib/query/hooks';
import { formatVolume } from '@/lib/units';
import { syncReminders, cancelAllReminders } from '@/lib/notifications';
import { analytics } from '@/lib/analytics';
import type { Profile, UnitPreference } from '@/lib/data/types';

export default function ProfileScreen() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const clearData = useClearAllData();
  const deleteAccount = useDeleteAccount();

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

  /**
   * Persist a reminder-settings patch, then reconcile the OS schedule from the
   * resulting profile. `syncReminders` is idempotent and handles the permission
   * prompt + the disabled case (it just clears).
   */
  const patchReminders = (patch: Partial<Profile>) => {
    if (!profile.data) return;
    const next = { ...profile.data, ...patch };
    updateProfile.mutate(patch, {
      onSuccess: () => {
        syncReminders(next);
        if ('reminders_enabled' in patch || 'reminder_interval_hours' in patch) {
          analytics.track('reminders_configured', {
            enabled: next.reminders_enabled,
            interval_hours: next.reminder_interval_hours,
          });
        }
      },
    });
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear all history?',
      'This permanently deletes every logged drink. Your goal and settings stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () =>
            clearData.mutate(undefined, {
              onSuccess: () => analytics.track('data_cleared', {}),
            }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This erases all your data and resets the app. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => {
                cancelAllReminders();
                analytics.track('account_deleted', {});
              },
            }),
        },
      ],
    );
  };

  if (profile.isLoading || goalMl == null || !profile.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={['top']}>
        <ActivityIndicator color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  const p = profile.data;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <ScrollView contentContainerClassName="px-6 pt-4 pb-12">
        <Text className="text-3xl font-bold text-hydro-950">Profile</Text>
        <Text className="mt-1 text-base text-slate-500">
          {p.display_name ?? 'Your hydration settings'}
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

        {/* Reminders (US-13) */}
        <Section title="Reminders">
          <View className="flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-slate-800">
                Drink reminders
              </Text>
              <Text className="text-xs text-slate-400">
                Gentle nudges during your day.
              </Text>
            </View>
            <Switch
              value={p.reminders_enabled}
              onValueChange={(v) => patchReminders({ reminders_enabled: v })}
              trackColor={{ true: '#0EA5E9' }}
            />
          </View>

          {p.reminders_enabled && (
            <View className="mt-3 gap-3">
              <Stepper
                label="Every"
                value={`${p.reminder_interval_hours} h`}
                onDec={() =>
                  patchReminders({
                    reminder_interval_hours: Math.max(1, p.reminder_interval_hours - 1),
                  })
                }
                onInc={() =>
                  patchReminders({
                    reminder_interval_hours: Math.min(6, p.reminder_interval_hours + 1),
                  })
                }
                canDec={p.reminder_interval_hours > 1}
                canInc={p.reminder_interval_hours < 6}
              />
              <Stepper
                label="From"
                value={formatHour(p.reminder_window_start_hour)}
                onDec={() =>
                  patchReminders({
                    reminder_window_start_hour: Math.max(0, p.reminder_window_start_hour - 1),
                  })
                }
                onInc={() =>
                  patchReminders({
                    reminder_window_start_hour: Math.min(
                      p.reminder_window_end_hour - 1,
                      p.reminder_window_start_hour + 1,
                    ),
                  })
                }
                canDec={p.reminder_window_start_hour > 0}
                canInc={p.reminder_window_start_hour < p.reminder_window_end_hour - 1}
              />
              <Stepper
                label="Until"
                value={formatHour(p.reminder_window_end_hour)}
                onDec={() =>
                  patchReminders({
                    reminder_window_end_hour: Math.max(
                      p.reminder_window_start_hour + 1,
                      p.reminder_window_end_hour - 1,
                    ),
                  })
                }
                onInc={() =>
                  patchReminders({
                    reminder_window_end_hour: Math.min(23, p.reminder_window_end_hour + 1),
                  })
                }
                canDec={p.reminder_window_end_hour > p.reminder_window_start_hour + 1}
                canInc={p.reminder_window_end_hour < 23}
              />
            </View>
          )}
        </Section>

        {/* Privacy (PRD privacy promise) */}
        <Section title="Privacy">
          <View className="flex-row gap-3 rounded-2xl bg-hydro-50 px-4 py-4">
            <Ionicons name="lock-closed" size={18} color="#0284C7" />
            <Text className="flex-1 text-sm leading-5 text-hydro-700">
              Photos are processed and discarded — only the estimated volume and
              drink type are saved. Full-resolution images never leave your device.
            </Text>
          </View>
        </Section>

        {/* Data & account (GDPR/CCPA) */}
        <Section title="Data & account">
          <Pressable
            onPress={confirmClear}
            disabled={clearData.isPending}
            className="flex-row items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3.5 active:bg-slate-50"
          >
            {clearData.isPending ? (
              <ActivityIndicator color="#64748B" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#64748B" />
            )}
            <Text className="text-base font-medium text-slate-700">
              Clear all history
            </Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            disabled={deleteAccount.isPending}
            className="mt-2 flex-row items-center gap-3 rounded-2xl border border-red-100 px-4 py-3.5 active:bg-red-50"
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
            )}
            <Text className="text-base font-medium text-red-500">Delete account</Text>
          </Pressable>
        </Section>

        {/* Replay onboarding (handy while iterating on the flow) */}
        <Pressable
          onPress={replayOnboarding}
          className="mt-8 flex-row items-center gap-2 py-3"
        >
          <Ionicons name="refresh" size={18} color="#64748B" />
          <Text className="text-sm font-medium text-slate-500">Replay onboarding</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** "8 AM" / "8 PM" / "Noon" / "Midnight" for the reminder window. */
function formatHour(hour24: number): string {
  if (hour24 === 0) return 'Midnight';
  if (hour24 === 12) return 'Noon';
  const period = hour24 < 12 ? 'AM' : 'PM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h} ${period}`;
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  canDec,
  canInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-slate-100 px-4 py-2.5">
      <Text className="text-base font-medium text-slate-600">{label}</Text>
      <View className="flex-row items-center gap-4">
        <StepButton icon="remove" onPress={onDec} disabled={!canDec} />
        <Text className="min-w-16 text-center text-base font-semibold text-slate-900">
          {value}
        </Text>
        <StepButton icon="add" onPress={onInc} disabled={!canInc} />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={`h-9 w-9 items-center justify-center rounded-full ${
        disabled ? 'bg-slate-100' : 'bg-hydro-50 active:bg-hydro-100'
      }`}
    >
      <Ionicons name={icon} size={18} color={disabled ? '#CBD5E1' : '#0284C7'} />
    </Pressable>
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
