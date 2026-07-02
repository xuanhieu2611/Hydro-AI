import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { VolumeAdjuster } from '@/components/VolumeAdjuster';
import { colors, gradients } from '@/lib/theme';
import {
  useProfile,
  useHistory,
  useUpdateProfile,
  useClearAllData,
  useDeleteAccount,
  useAuthIdentity,
} from '@/lib/query/hooks';
import { formatVolume } from '@/lib/units';
import { syncReminders, syncStreakDanger, cancelAllReminders } from '@/lib/notifications';
import { signOut } from '@/lib/auth';
import { analytics } from '@/lib/analytics';
import { tapSelection } from '@/lib/haptics';
import { computeStreaks } from '@/lib/streak';
import type { DailySummary, Profile, UnitPreference } from '@/lib/data/types';

export default function ProfileScreen() {
  const profile = useProfile();
  const history = useHistory(30);
  const updateProfile = useUpdateProfile();
  const clearData = useClearAllData();
  const deleteAccount = useDeleteAccount();
  const identity = useAuthIdentity();
  const router = useRouter();

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
    if (next !== unit) {
      tapSelection();
      updateProfile.mutate({ unit_preference: next });
    }
  };

  const saveName = (name: string) => {
    const trimmed = name.trim();
    updateProfile.mutate({ display_name: trimmed.length ? trimmed : null });
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
    // Day-state snapshot so the freshly-scheduled copy is streak/progress-aware
    // (history is most-recent-first, so [0] is today).
    const days = history.data ?? [];
    const today = days[0];
    const state = {
      streak: computeStreaks(days).current,
      remaining_ml: today ? Math.max(0, today.goal_ml - today.total_intake_ml) : undefined,
      goal_ml: today?.goal_ml,
    };
    updateProfile.mutate(patch, {
      onSuccess: () => {
        syncReminders(next, state);
        syncStreakDanger(next, state);
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

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime with Apple or Google.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        // The auth-state listener routes back to the sign-in gate; no nav here.
        onPress: () => {
          cancelAllReminders();
          signOut();
        },
      },
    ]);
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
        <ActivityIndicator color={colors.hydro[500]} />
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
      <ScrollView
        contentContainerClassName="px-6 pt-4 pb-16"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-hydro-950">Profile</Text>

        {/* Identity — avatar, editable name, member since */}
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <IdentityHeader
            name={p.display_name}
            avatarUrl={p.avatar_url}
            createdAt={p.created_at}
            onSaveName={saveName}
          />
        </Animated.View>

        {/* Hero stats — a sense of progress, not just settings */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(60)}>
          <StatStrip days={history.data ?? []} unit={unit} />
        </Animated.View>

        {/* Daily goal (US-07) */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(120)}>
          <Section title="Daily goal">
            <Card className="px-5 py-5">
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
            </Card>
          </Section>
        </Animated.View>

        {/* Units (US-07) */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(180)}>
          <Section title="Units">
            <Card className="flex-row p-1.5">
              {(['ml', 'oz'] as UnitPreference[]).map((u) => {
                const selected = u === unit;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    className={`flex-1 items-center rounded-2xl py-3 ${
                      selected ? 'bg-hydro-500' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selected ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {u === 'ml' ? 'Milliliters' : 'Fluid ounces'}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>
          </Section>
        </Animated.View>

        {/* Reminders (US-13) */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(240)}>
          <Section title="Reminders">
            <Card className="px-4 py-3.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold text-slate-800">
                    Drink reminders
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-400">
                    Gentle nudges during your day.
                  </Text>
                </View>
                <Switch
                  value={p.reminders_enabled}
                  onValueChange={(v) => {
                    tapSelection();
                    patchReminders({ reminders_enabled: v });
                  }}
                  trackColor={{ true: colors.hydro[500] }}
                />
              </View>

              {p.reminders_enabled && (
                <View className="mt-3.5 gap-1 border-t border-slate-100 pt-2">
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
            </Card>
          </Section>
        </Animated.View>

        {/* Friends & accountability — share today's progress with a circle */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(285)}>
          <Section title="Friends & accountability">
            <Card>
              <Row
                icon="people-outline"
                label="Your circle"
                onPress={() => router.push('/friends')}
                chevron
              />
            </Card>
          </Section>
        </Animated.View>

        {/* Privacy (PRD privacy promise) */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(300)}>
          <Section title="Privacy">
            <View className="flex-row gap-3 rounded-3xl border border-hydro-100 bg-hydro-50 px-4 py-4">
              <Ionicons name="lock-closed" size={18} color={colors.hydro[600]} />
              <Text className="flex-1 text-sm leading-5 text-hydro-700">
                Photos are processed and discarded — only the estimated volume and
                drink type are saved. Full-resolution images never leave your device.
              </Text>
            </View>
          </Section>
        </Animated.View>

        {/* Account — only meaningful with the real backend (mock has no auth) */}
        {identity && (
          <Animated.View entering={FadeInDown.springify().damping(18).delay(330)}>
            <Section title="Account">
              <Card>
                <View className="flex-row items-center gap-3 px-4 py-3.5">
                  <Ionicons
                    name={providerIcon(identity.provider)}
                    size={18}
                    color={colors.slate[500]}
                  />
                  <View className="flex-1">
                    <Text className="text-base font-medium text-slate-700">
                      {identity.email ?? 'Signed in'}
                    </Text>
                    {identity.provider && (
                      <Text className="text-xs text-slate-400">
                        via {capitalize(identity.provider)}
                      </Text>
                    )}
                  </View>
                </View>
                <Divider />
                <Row icon="log-out-outline" label="Sign out" onPress={confirmSignOut} />
              </Card>
            </Section>
          </Animated.View>
        )}

        {/* Data & account (GDPR/CCPA) */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(360)}>
          <Section title="Data & account">
            <Card>
              <Row
                icon="trash-outline"
                label="Clear all history"
                onPress={confirmClear}
                loading={clearData.isPending}
              />
              <Divider />
              <Row
                icon="person-remove-outline"
                label="Delete account"
                onPress={confirmDelete}
                loading={deleteAccount.isPending}
                destructive
              />
            </Card>
          </Section>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.springify().damping(18).delay(420)}>
          <Section title="About">
            <Card>
              <Row
                icon="refresh"
                label="Replay onboarding"
                onPress={replayOnboarding}
                chevron
              />
              <Divider />
              <View className="flex-row items-center justify-between px-4 py-3.5">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="water-outline" size={18} color={colors.slate[400]} />
                  <Text className="text-base font-medium text-slate-700">Version</Text>
                </View>
                <Text className="text-sm font-medium text-slate-400">Hydro AI 1.0.0</Text>
              </View>
            </Card>
          </Section>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------- identity --------------------------------- */

function IdentityHeader({
  name,
  avatarUrl,
  createdAt,
  onSaveName,
}: {
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  onSaveName: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');

  const begin = () => {
    setDraft(name ?? '');
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (name ?? '')) onSaveName(draft);
  };

  const initial = name?.trim()?.[0]?.toUpperCase() ?? null;

  return (
    <View className="mt-5 flex-row items-center gap-4">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 64, height: 64, borderRadius: 32 }}
        />
      ) : (
        <LinearGradient
          colors={gradients.hero}
          style={{ width: 64, height: 64, borderRadius: 32 }}
          className="items-center justify-center"
        >
          {initial ? (
            <Text className="text-2xl font-bold text-white">{initial}</Text>
          ) : (
            <Text className="text-3xl">💧</Text>
          )}
        </LinearGradient>
      )}

      <View className="flex-1">
        {editing ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              placeholder="Your name"
              placeholderTextColor={colors.slate[400]}
              returnKeyType="done"
              onSubmitEditing={commit}
              onBlur={commit}
              maxLength={24}
              className="flex-1 border-b border-hydro-300 pb-1 text-2xl font-bold text-hydro-950"
            />
            <Pressable onPress={commit} hitSlop={8}>
              <Ionicons name="checkmark-circle" size={26} color={colors.hydro[500]} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={begin} className="flex-row items-center gap-2" hitSlop={6}>
            <Text
              className={`text-2xl font-bold ${name ? 'text-hydro-950' : 'text-slate-400'}`}
            >
              {name ?? 'Add your name'}
            </Text>
            <Ionicons name="pencil" size={15} color={colors.slate[400]} />
          </Pressable>
        )}
        <Text className="mt-0.5 text-sm text-slate-500">
          Member since {formatMonthYear(createdAt)}
        </Text>
      </View>
    </View>
  );
}

interface ProfileStats {
  streak: number;
  longestStreak: number;
  goalsMet: number;
  avg: number;
}

/** Roll up the last 30 days into the three headline stats. */
function computeStats(days: DailySummary[]): ProfileStats {
  const tracked = days.filter((d) => d.total_intake_ml > 0);
  const avg = tracked.length
    ? Math.round(tracked.reduce((s, d) => s + d.total_intake_ml, 0) / tracked.length)
    : 0;
  const goalsMet = days.filter((d) => d.goal_met).length;
  const { current: streak, longest: longestStreak } = computeStreaks(days);
  return { streak, longestStreak, goalsMet, avg };
}

function StatStrip({ days, unit }: { days: DailySummary[]; unit: UnitPreference }) {
  const stats = useMemo(() => computeStats(days), [days]);
  return (
    <Card className="mt-5 flex-row items-center px-2 py-4">
      <HeroStat
        icon="flame"
        value={stats.streak === 1 ? '1 day' : `${stats.streak} days`}
        label="Streak"
        sub={stats.longestStreak > 0 ? `Best ${stats.longestStreak}` : undefined}
        accent={stats.streak > 0}
      />
      <StatDivider />
      <HeroStat icon="checkmark-done" value={`${stats.goalsMet}`} label="Goals met" />
      <StatDivider />
      <HeroStat
        icon="water"
        value={stats.avg > 0 ? formatVolume(stats.avg, unit) : '—'}
        label="Daily avg"
      />
    </Card>
  );
}

function HeroStat({
  icon,
  value,
  label,
  sub,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 items-center">
      <Ionicons name={icon} size={18} color={accent ? colors.aqua[500] : colors.hydro[400]} />
      <Text className="mt-1.5 text-base font-bold text-hydro-950">{value}</Text>
      <Text className="mt-0.5 text-[11px] font-medium text-slate-400">{label}</Text>
      {sub && <Text className="mt-0.5 text-[10px] font-medium text-slate-300">{sub}</Text>}
    </View>
  );
}

function StatDivider() {
  return <View className="h-9 w-px bg-slate-200/70" />;
}

/* ------------------------------- primitives ------------------------------- */

/** "8 AM" / "8 PM" / "Noon" / "Midnight" for the reminder window. */
function formatHour(hour24: number): string {
  if (hour24 === 0) return 'Midnight';
  if (hour24 === 12) return 'Noon';
  const period = hour24 < 12 ? 'AM' : 'PM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h} ${period}`;
}

/** Icon for the signed-in provider (falls back to a generic person glyph). */
function providerIcon(provider: string | null): keyof typeof Ionicons.glyphMap {
  if (provider === 'apple') return 'logo-apple';
  if (provider === 'google') return 'logo-google';
  return 'person-circle-outline';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "June 2026" for the member-since line. */
function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const cardShadow = {
  shadowColor: '#0C4A6E',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`overflow-hidden rounded-3xl border border-white/80 bg-white/70 ${className}`}
      style={cardShadow}
    >
      {children}
    </View>
  );
}

function Divider() {
  return <View className="mx-4 h-px bg-slate-100" />;
}

function Row({
  icon,
  label,
  onPress,
  loading = false,
  destructive = false,
  chevron = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  destructive?: boolean;
  chevron?: boolean;
}) {
  const tint = destructive ? '#EF4444' : colors.slate[500];
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`flex-row items-center gap-3 px-4 py-3.5 ${
        destructive ? 'active:bg-red-50' : 'active:bg-slate-50'
      }`}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <Ionicons name={icon} size={18} color={tint} />
      )}
      <Text
        className={`flex-1 text-base font-medium ${
          destructive ? 'text-red-500' : 'text-slate-700'
        }`}
      >
        {label}
      </Text>
      {chevron && (
        <Ionicons name="chevron-forward" size={16} color={colors.slate[400]} />
      )}
    </Pressable>
  );
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
    <View className="flex-row items-center justify-between py-1.5">
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
      <Ionicons name={icon} size={18} color={disabled ? '#CBD5E1' : colors.hydro[600]} />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text className="mb-2.5 ml-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </Text>
      {children}
    </View>
  );
}
