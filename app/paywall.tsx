import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, gradients } from '@/lib/theme';
import { tapSelection } from '@/lib/haptics';
import { analytics } from '@/lib/analytics';
import { useOfferings } from '@/lib/billing/hooks';
import { useBilling } from '@/lib/billing/context';
import { billing } from '@/lib/billing';
import { PurchaseCancelledError, legalUrls } from '@/lib/billing';
import type { BillingPeriod, SubscriptionOption } from '@/lib/billing/types';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'camera', text: 'Snap a photo — AI logs your drink instantly' },
  { icon: 'infinite', text: 'Unlimited AI scans & drink logging' },
  { icon: 'notifications', text: 'Smart hydration reminders' },
  { icon: 'flame', text: 'Streaks, history & personal insights' },
  { icon: 'people', text: 'Accountability circle with friends & family' },
];

/**
 * Hard paywall (App Review-compliant): the only screen reachable once onboarded
 * until the premium entitlement is active. Shows the offering's plans with clear
 * prices + trial terms, a Restore button, and Terms/Privacy links. A completed
 * purchase flips the entitlement, and the `app/_layout` gate swaps to the app —
 * no manual navigation here. Not dismissible (no back gesture; see the route
 * options in `_layout`).
 */
export default function Paywall() {
  const { data: options, isLoading, isError, refetch } = useOfferings();
  const { refresh } = useBilling();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  useEffect(() => {
    analytics.track('paywall_viewed', {});
  }, []);

  // Default to the first plan (offerings arrive yearly-first).
  useEffect(() => {
    if (options?.length && selectedId == null) setSelectedId(options[0].id);
  }, [options, selectedId]);

  const selected = options?.find((o) => o.id === selectedId) ?? null;
  const yearlySavingsPct = useMemo(() => savingsPct(options), [options]);

  const buy = async () => {
    if (!selected || busy) return;
    tapSelection();
    setBusy('purchase');
    analytics.track('purchase_started', { plan: selected.id });
    try {
      const entitled = await billing.purchase(selected);
      if (entitled) {
        analytics.track('purchase_completed', { plan: selected.id });
        await refresh(); // the gate also reacts to the entitlement listener
      } else {
        analytics.track('purchase_failed', { plan: selected.id, reason: 'not_entitled' });
        Alert.alert(
          'Purchase incomplete',
          "We couldn't verify your subscription. Please try again.",
        );
      }
    } catch (e) {
      if (e instanceof PurchaseCancelledError) return; // user backed out — no-op
      analytics.track('purchase_failed', {
        plan: selected.id,
        reason: e instanceof Error ? e.message : 'unknown',
      });
      Alert.alert(
        'Purchase failed',
        e instanceof Error ? e.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    try {
      const entitled = await billing.restore();
      if (entitled) {
        analytics.track('purchase_restored', {});
        await refresh();
      } else {
        Alert.alert(
          'Nothing to restore',
          "We couldn't find an active subscription for this account.",
        );
      }
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <ScrollView
        contentContainerClassName="px-6 pt-6 pb-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          className="items-center"
        >
          <LinearGradient
            colors={gradients.water}
            style={{
              width: 76,
              height: 76,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-4xl">💧</Text>
          </LinearGradient>
          <Text className="mt-5 text-center text-3xl font-bold text-hydro-950">
            Unlock Hydro AI
          </Text>
          <Text className="mt-2 text-center text-base leading-6 text-slate-500">
            Start your free trial and build a hydration habit that actually sticks.
          </Text>
        </Animated.View>

        {/* Benefits */}
        <Animated.View
          entering={FadeInDown.springify().damping(18).delay(80)}
          className="mt-7 gap-3"
        >
          {BENEFITS.map((b) => (
            <View key={b.text} className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-hydro-50">
                <Ionicons name={b.icon} size={17} color={colors.hydro[600]} />
              </View>
              <Text className="flex-1 text-[15px] font-medium text-slate-700">
                {b.text}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Plans */}
        <Animated.View
          entering={FadeInDown.springify().damping(18).delay(160)}
          className="mt-7 gap-3"
        >
          {isLoading ? (
            <View className="h-28 items-center justify-center">
              <ActivityIndicator color={colors.hydro[500]} />
            </View>
          ) : isError || !options?.length ? (
            <View className="items-center gap-3 rounded-3xl border border-hydro-100 bg-hydro-50 px-4 py-6">
              <Text className="text-center text-sm text-slate-500">
                Couldn't load subscription options. Check your connection and try
                again.
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="rounded-full bg-hydro-500 px-5 py-2 active:bg-hydro-600"
              >
                <Text className="text-sm font-semibold text-white">Retry</Text>
              </Pressable>
            </View>
          ) : (
            options.map((opt) => (
              <PlanCard
                key={opt.id}
                option={opt}
                selected={opt.id === selectedId}
                savingsPct={opt.period === 'year' ? yearlySavingsPct : null}
                onPress={() => {
                  tapSelection();
                  setSelectedId(opt.id);
                }}
              />
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* Sticky CTA + legal */}
      <View className="px-6 pt-2">
        <Pressable
          onPress={buy}
          disabled={!selected || busy != null}
          className={`h-14 flex-row items-center justify-center rounded-2xl ${
            !selected || busy != null ? 'bg-hydro-300' : 'bg-hydro-500 active:bg-hydro-600'
          }`}
          style={{
            shadowColor: '#0C4A6E',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {busy === 'purchase' ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">{ctaLabel(selected)}</Text>
          )}
        </Pressable>

        <Text className="mt-3 text-center text-[11px] leading-4 text-slate-400">
          {finePrint(selected)}
        </Text>

        <View className="mt-2.5 flex-row items-center justify-center">
          <FooterLink
            label={busy === 'restore' ? 'Restoring…' : 'Restore'}
            onPress={restore}
            disabled={busy != null}
          />
          <Dot />
          <FooterLink label="Terms" onPress={() => Linking.openURL(legalUrls.terms)} />
          <Dot />
          <FooterLink label="Privacy" onPress={() => Linking.openURL(legalUrls.privacy)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------- plan card ------------------------------- */

function PlanCard({
  option,
  selected,
  savingsPct,
  onPress,
}: {
  option: SubscriptionOption;
  selected: boolean;
  savingsPct: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-3xl border-2 bg-white/80 px-4 py-4 ${
        selected ? 'border-hydro-500' : 'border-slate-200'
      }`}
    >
      {/* Radio */}
      <View
        className={`mr-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? 'border-hydro-500 bg-hydro-500' : 'border-slate-300'
        }`}
      >
        {selected && <Ionicons name="checkmark" size={15} color="white" />}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-hydro-950">{option.title}</Text>
          {savingsPct != null && savingsPct > 0 && (
            <View className="rounded-full bg-aqua-500 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-white">SAVE {savingsPct}%</Text>
            </View>
          )}
        </View>
        {option.perWeekString && (
          <Text className="mt-0.5 text-xs text-slate-400">
            {option.perWeekString}/week
          </Text>
        )}
      </View>

      <View className="items-end">
        <Text className="text-base font-bold text-hydro-950">{option.priceString}</Text>
        <Text className="text-xs text-slate-400">/{periodShort(option.period)}</Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------- footer ---------------------------------- */

function FooterLink({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <Text className="px-2 text-xs font-medium text-slate-400">{label}</Text>
    </Pressable>
  );
}

function Dot() {
  return <Text className="text-xs text-slate-300">·</Text>;
}

/* -------------------------------- helpers --------------------------------- */

function periodShort(period: BillingPeriod): string {
  switch (period) {
    case 'year':
      return 'yr';
    case 'month':
      return 'mo';
    case 'week':
      return 'wk';
    default:
      return '';
  }
}

function ctaLabel(selected: SubscriptionOption | null): string {
  if (!selected) return 'Continue';
  if (selected.trialDays) return `Start ${selected.trialDays}-day free trial`;
  return `Subscribe · ${selected.priceString}/${periodShort(selected.period)}`;
}

/** App Review requires the trial length, price, cadence and auto-renew terms. */
function finePrint(selected: SubscriptionOption | null): string {
  if (!selected) return ' ';
  const priceLine = `${selected.priceString}/${periodShort(selected.period)}`;
  const lead = selected.trialDays
    ? `${selected.trialDays}-day free trial, then ${priceLine}. `
    : `${priceLine}. `;
  return (
    lead +
    'Auto-renews unless cancelled at least 24 hours before the period ends. ' +
    'Manage or cancel anytime in your App Store settings.'
  );
}

/** Percentage the yearly plan saves vs paying the monthly plan for a year. */
function savingsPct(options: SubscriptionOption[] | undefined): number | null {
  if (!options) return null;
  const year = options.find((o) => o.period === 'year');
  const month = options.find((o) => o.period === 'month');
  if (!year?.perWeek || !month?.perWeek || month.perWeek <= 0) return null;
  const pct = Math.round((1 - year.perWeek / month.perWeek) * 100);
  return pct > 0 ? pct : null;
}
