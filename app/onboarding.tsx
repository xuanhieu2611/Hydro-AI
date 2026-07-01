import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { VolumeAdjuster } from '@/components/VolumeAdjuster';
import { LiquidGauge } from '@/components/LiquidGauge';
import { SignInButtons } from '@/components/SignInButtons';
import { colors, gradients } from '@/lib/theme';
import { useSession, useUpdateProfile } from '@/lib/query/hooks';
import { saveDraft, type OnboardingDraft } from '@/lib/onboarding/draft';
import { analytics } from '@/lib/analytics';
import { tapSelection } from '@/lib/haptics';
import {
  ACTIVITY_META,
  lbToKg,
  recommendGoalMl,
  type ActivityLevel,
} from '@/lib/hydration';
import { formatVolume } from '@/lib/units';
import type { UnitPreference } from '@/lib/data/types';

type Step = 0 | 1 | 2 | 3 | 4;
const LAST_STEP: Step = 4;
const STEP_COUNT = 5;

const DEFAULT_GOAL_ML = 2000;

/**
 * First-run onboarding (PRD §4.5), onboarding-first: collect a name, daily goal
 * + unit preference and a notifications opt-in, then sign in as the final step.
 * Each screen is a step in local state — no nested routes needed.
 *
 * Sign-in is required to finish. When already authenticated (mock mode, or a
 * returning user who never onboarded) the last step is a one-tap "Get started"
 * that writes the profile directly. Otherwise it shows Apple/Google: the answers
 * are buffered to a draft first, and the root `useFinalizeOnboarding` flushes
 * them once the session flips.
 */
export default function Onboarding() {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const authenticated = useSession() === 'authenticated';

  const [step, setStep] = useState<Step>(0);
  // Direction drives the slide transition (forward vs back).
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<UnitPreference>('ml');
  const [goalMl, setGoalMl] = useState(DEFAULT_GOAL_ML);
  const [notify, setNotify] = useState(false);

  const next = () => {
    tapSelection();
    setDir(1);
    setStep((s) => Math.min(LAST_STEP, s + 1) as Step);
  };
  const back = () => {
    tapSelection();
    setDir(-1);
    setStep((s) => Math.max(0, s - 1) as Step);
  };
  // Skip can't finish without an account — jump to the sign-in step instead.
  const skip = () => {
    analytics.track('onboarding_skipped', {});
    tapSelection();
    setDir(1);
    setStep(LAST_STEP);
  };

  const buildDraft = (): OnboardingDraft => {
    const trimmedName = name.trim();
    return {
      display_name: trimmedName.length ? trimmedName : null,
      daily_goal_ml: goalMl,
      unit_preference: unit,
      reminders_enabled: notify,
    };
  };

  /**
   * Already-authenticated finish (mock / returning user): write the profile
   * directly and flip the gate. The unauthenticated path instead persists the
   * draft (`onBeforeSignIn`) and lets the root finalize flush it after sign-in.
   */
  const finishAuthenticated = async () => {
    const draft = buildDraft();
    const patch = {
      daily_goal_ml: draft.daily_goal_ml,
      unit_preference: draft.unit_preference,
      reminders_enabled: draft.reminders_enabled,
      onboarding_completed: true,
      ...(draft.display_name ? { display_name: draft.display_name } : {}),
    };
    await updateProfile.mutateAsync(patch);
    analytics.track('onboarding_completed', {
      goal_ml: goalMl,
      unit,
      reminders_enabled: notify,
    });
    router.replace('/(tabs)');
  };

  const Entering = dir === 1 ? SlideInRight : SlideInLeft;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header: progress bar + Skip */}
        <View className="flex-row items-center gap-4 px-6 pt-2">
          <ProgressBar step={step} />
          {step < LAST_STEP ? (
            <Pressable onPress={skip} hitSlop={8}>
              <Text className="text-sm font-medium text-slate-400">Skip</Text>
            </Pressable>
          ) : (
            <View className="w-7" />
          )}
        </View>

        <Animated.View
          key={step}
          entering={Entering.duration(320).easing(Easing.out(Easing.cubic))}
          className="flex-1"
        >
          {step === 0 && <Welcome name={name} onChangeName={setName} />}
          {step === 1 && (
            <GoalStep unit={unit} goalMl={goalMl} onChangeGoal={setGoalMl} />
          )}
          {step === 2 && <UnitStep unit={unit} onChange={setUnit} />}
          {step === 3 && <NotificationsStep enabled={notify} onChange={setNotify} />}
          {step === 4 && <SignInStep name={name} />}
        </Animated.View>

        {/* Footer actions */}
        <View className="gap-2 px-6 pb-8">
          {step === LAST_STEP ? (
            authenticated ? (
              // Mock mode / already signed in: no sign-in needed, one tap to finish.
              <PrimaryButton
                label="Get started"
                loading={updateProfile.isPending}
                onPress={finishAuthenticated}
              />
            ) : (
              // Buffer answers, then sign in — the root finalize flushes them.
              <SignInButtons onBeforeSignIn={() => saveDraft(buildDraft())} />
            )
          ) : (
            <View className="flex-row items-center gap-3">
              {step > 0 && (
                <Pressable
                  onPress={back}
                  className="h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white/60 active:bg-slate-50"
                >
                  <Ionicons name="arrow-back" size={22} color="#475569" />
                </Pressable>
              )}
              <View className="flex-1">
                <PrimaryButton label="Continue" onPress={next} />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Animated segmented progress bar — the current segment fills left to right. */
function ProgressBar({ step }: { step: number }) {
  return (
    <View className="flex-1 flex-row gap-1.5">
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <ProgressSegment key={i} active={i === step} done={i < step} />
      ))}
    </View>
  );
}

function ProgressSegment({ active, done }: { active: boolean; done: boolean }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(done || active ? 1 : 0, {
      duration: active ? 320 : 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, done]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
      <Animated.View style={style} className="h-full rounded-full bg-hydro-500" />
    </View>
  );
}

/* --------------------------------- steps ---------------------------------- */

function Welcome({
  name,
  onChangeName,
}: {
  name: string;
  onChangeName: (v: string) => void;
}) {
  return (
    <StepBody>
      <View className="flex-1 items-center justify-center">
        <LiquidGauge progress={0.68} size={172}>
          <Text className="text-5xl">💧</Text>
        </LiquidGauge>
        <Text className="mt-8 text-3xl font-bold text-hydro-950">Hydro AI</Text>
        <Text className="mt-3 text-center text-base leading-6 text-slate-500">
          Snap a photo of any drink and we&apos;ll estimate the volume and log it —
          no typing, no guesswork.
        </Text>

        <View className="mt-10 w-full">
          <Text className="mb-2 ml-1 text-sm font-semibold text-slate-500">
            What should we call you?
          </Text>
          <TextInput
            value={name}
            onChangeText={onChangeName}
            placeholder="Your name (optional)"
            placeholderTextColor={colors.slate[400]}
            returnKeyType="done"
            maxLength={24}
            className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3.5 text-lg text-slate-900"
          />
        </View>
      </View>
    </StepBody>
  );
}

function GoalStep({
  unit,
  goalMl,
  onChangeGoal,
}: {
  unit: UnitPreference;
  goalMl: number;
  onChangeGoal: (ml: number) => void;
}) {
  const [mode, setMode] = useState<'recommend' | 'custom'>('recommend');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');

  const weightNum = parseFloat(weight);
  const hasWeight = !Number.isNaN(weightNum) && weightNum > 0;
  const recommended = hasWeight
    ? recommendGoalMl(weightUnit === 'kg' ? weightNum : lbToKg(weightNum), activity)
    : null;

  // In recommend mode the live recommendation IS the goal — sync it up.
  useEffect(() => {
    if (mode === 'recommend' && recommended != null) onChangeGoal(recommended);
  }, [mode, recommended, onChangeGoal]);

  const effectiveGoal = mode === 'recommend' ? recommended ?? goalMl : goalMl;

  return (
    <StepBody scroll>
      <Text className="text-2xl font-bold text-slate-900">Set your daily goal</Text>
      <Text className="mt-2 text-base text-slate-500">
        We can recommend one from your body, or you can set your own.
      </Text>

      <Segmented
        options={[
          { value: 'recommend', label: 'Recommend' },
          { value: 'custom', label: 'Custom' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'recommend' | 'custom')}
      />

      {mode === 'recommend' ? (
        <View className="mt-6 gap-5">
          <View>
            <Text className="mb-2 text-sm font-semibold text-slate-500">Weight</Text>
            <View className="flex-row items-center gap-3">
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="e.g. 70"
                placeholderTextColor={colors.slate[400]}
                className="flex-1 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-lg text-slate-900"
              />
              <Segmented
                compact
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'lb', label: 'lb' },
                ]}
                value={weightUnit}
                onChange={(v) => setWeightUnit(v as 'kg' | 'lb')}
              />
            </View>
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-slate-500">
              Activity level
            </Text>
            <View className="gap-2">
              {(Object.keys(ACTIVITY_META) as ActivityLevel[]).map((level) => {
                const meta = ACTIVITY_META[level];
                const selected = level === activity;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      tapSelection();
                      setActivity(level);
                    }}
                    className={`flex-row items-center justify-between rounded-2xl border px-4 py-3 ${
                      selected
                        ? 'border-hydro-500 bg-hydro-50'
                        : 'border-slate-200 bg-white/60 active:bg-slate-50'
                    }`}
                  >
                    <View>
                      <Text className="text-base font-semibold text-slate-800">
                        {meta.label}
                      </Text>
                      <Text className="text-xs text-slate-400">{meta.description}</Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.hydro[500]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <View className="mt-8 rounded-3xl border border-white/80 bg-white/70 px-5 py-6" style={cardShadow}>
          <VolumeAdjuster
            valueMl={goalMl}
            onChange={onChangeGoal}
            unit={unit}
            stepMl={100}
            minMl={500}
            maxMl={5000}
          />
        </View>
      )}

      <View className="mt-8 items-center rounded-3xl bg-hydro-50 py-5">
        <Text className="text-sm font-medium text-hydro-700">Your daily goal</Text>
        <Text className="mt-1 text-4xl font-bold text-hydro-600">
          {formatVolume(effectiveGoal, unit)}
        </Text>
        {mode === 'recommend' && recommended == null && (
          <Text className="mt-1 text-xs text-slate-400">
            Enter your weight for a personalized goal
          </Text>
        )}
      </View>
    </StepBody>
  );
}

function UnitStep({
  unit,
  onChange,
}: {
  unit: UnitPreference;
  onChange: (u: UnitPreference) => void;
}) {
  return (
    <StepBody>
      <Text className="text-2xl font-bold text-slate-900">Units</Text>
      <Text className="mt-2 text-base text-slate-500">
        How would you like volumes shown? You can change this anytime in Profile.
      </Text>
      <View className="mt-8 gap-3">
        {(['ml', 'oz'] as UnitPreference[]).map((u) => {
          const selected = u === unit;
          return (
            <Pressable
              key={u}
              onPress={() => {
                tapSelection();
                onChange(u);
              }}
              className={`flex-row items-center justify-between rounded-2xl border px-5 py-4 ${
                selected
                  ? 'border-hydro-500 bg-hydro-50'
                  : 'border-slate-200 bg-white/60 active:bg-slate-50'
              }`}
            >
              <Text className="text-lg font-semibold text-slate-800">
                {u === 'ml' ? 'Milliliters (ml)' : 'Fluid ounces (oz)'}
              </Text>
              {selected && (
                <Ionicons name="checkmark-circle" size={24} color={colors.hydro[500]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </StepBody>
  );
}

function NotificationsStep({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const toggle = async () => {
    tapSelection();
    if (!enabled) {
      // Ask the OS now; actual scheduling lands in Phase 4.
      const { status } = await Notifications.requestPermissionsAsync();
      onChange(status === 'granted');
    } else {
      onChange(false);
    }
  };

  return (
    <StepBody>
      <View className="flex-1 items-center justify-center">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-hydro-50">
          <Ionicons name="notifications" size={40} color={colors.hydro[500]} />
        </View>
        <Text className="mt-6 text-2xl font-bold text-slate-900">Stay on track</Text>
        <Text className="mt-2 text-center text-base leading-6 text-slate-500">
          Gentle reminders to drink — suggested every 2 hours, 8am–8pm. You can
          fine-tune the schedule later.
        </Text>
        <Pressable
          onPress={toggle}
          className={`mt-8 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl ${
            enabled ? 'bg-hydro-50' : 'bg-hydro-500 active:bg-hydro-600'
          }`}
        >
          <Ionicons
            name={enabled ? 'checkmark-circle' : 'notifications-outline'}
            size={20}
            color={enabled ? colors.hydro[600] : 'white'}
          />
          <Text
            className={`text-lg font-semibold ${enabled ? 'text-hydro-700' : 'text-white'}`}
          >
            {enabled ? 'Reminders on' : 'Enable reminders'}
          </Text>
        </Pressable>
      </View>
    </StepBody>
  );
}

function SignInStep({ name }: { name: string }) {
  const greeting = name.trim().length ? `You're all set, ${name.trim()}!` : "You're all set!";
  return (
    <StepBody>
      <View className="flex-1 items-center justify-center">
        <LiquidGauge progress={0.68} size={148}>
          <Text className="text-5xl">💧</Text>
        </LiquidGauge>
        <Text className="mt-8 text-center text-3xl font-bold text-slate-900">
          {greeting}
        </Text>
        <Text className="mt-3 text-center text-base leading-6 text-slate-500">
          Create an account to save your progress and start tracking — it only
          takes a second.
        </Text>
        <Text className="mt-6 text-center text-xs leading-5 text-slate-400">
          We only store your hydration data — never your photos.
        </Text>
      </View>
    </StepBody>
  );
}

/* ------------------------------- primitives ------------------------------- */

const cardShadow = {
  shadowColor: '#0C4A6E',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

function StepBody({
  children,
  scroll,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  if (scroll) {
    return (
      <ScrollView
        contentContainerClassName="px-6 pt-8 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View className="flex-1 px-6 pt-8">{children}</View>;
}

function PrimaryButton({
  label,
  icon,
  loading,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color="white" />}
          <Text className="text-lg font-semibold text-white">{label}</Text>
        </>
      )}
    </Pressable>
  );
}

interface SegmentedOption {
  value: string;
  label: string;
}

function Segmented({
  options,
  value,
  onChange,
  compact,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <View className={`flex-row rounded-2xl bg-slate-100 p-1 ${compact ? '' : 'mt-6'}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              tapSelection();
              onChange(opt.value);
            }}
            className={`items-center rounded-xl py-2 ${compact ? 'px-4' : 'flex-1'} ${
              selected ? 'bg-white' : ''
            }`}
            style={
              selected
                ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }
                : undefined
            }
          >
            <Text
              className={`text-sm font-semibold ${
                selected ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
