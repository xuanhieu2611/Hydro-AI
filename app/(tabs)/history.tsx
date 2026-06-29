import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { LoadingState, ErrorState, EmptyState } from '@/components/StateViews';
import { useHistory, useProfile, useLogEntries } from '@/lib/query/hooks';
import { colors, gradients } from '@/lib/theme';
import { formatVolume } from '@/lib/units';
import { beverageEmoji, beverageLabel } from '@/lib/beverage';
import { formatDayLabel, formatTime, todayKey } from '@/lib/date';
import { computeStreaks } from '@/lib/streak';
import { tapSelection } from '@/lib/haptics';
import type { DailySummary, LogEntry, UnitPreference } from '@/lib/data/types';

const RANGES = [
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
] as const;

const CHART_H = 168; // px — drawable height of the bars area

export default function HistoryScreen() {
  const profile = useProfile();
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGES[rangeIdx];
  const history = useHistory(range.days);
  const unit = profile.data?.unit_preference ?? 'ml';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <ScrollView contentContainerClassName="px-6 pt-4 pb-24" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-3xl font-bold text-hydro-950">History</Text>
            <Text className="mt-1 text-base text-slate-500">
              Last {range.days} days
            </Text>
          </View>
          <RangeToggle idx={rangeIdx} onChange={setRangeIdx} />
        </View>

        {history.isLoading ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState subtitle="Couldn't load your history." onRetry={() => history.refetch()} />
        ) : (
          <HistoryBody days={history.data ?? []} unit={unit} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RangeToggle({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  return (
    <View className="flex-row rounded-full border border-white/80 bg-white/70 p-1">
      {RANGES.map((r, i) => {
        const active = i === idx;
        return (
          <Pressable
            key={r.label}
            onPress={() => {
              if (i !== idx) tapSelection();
              onChange(i);
            }}
            className={`rounded-full px-4 py-1.5 ${active ? 'bg-hydro-500' : ''}`}
          >
            <Text
              className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-500'}`}
            >
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HistoryBody({ days, unit }: { days: DailySummary[]; unit: UnitPreference }) {
  const hasAny = days.some((d) => d.total_intake_ml > 0);

  // getHistory is most-recent-first; show oldest → newest left to right.
  const ordered = useMemo(() => [...days].reverse(), [days]);

  // Default the selection to the most recent day (today).
  const [selectedDate, setSelectedDate] = useState(days[0]?.date ?? todayKey());
  const selected =
    days.find((d) => d.date === selectedDate) ?? days[0] ?? null;

  const stats = useMemo(() => computeStats(days), [days]);

  if (!hasAny) {
    return (
      <View className="mt-10">
        <EmptyState
          emoji="📊"
          title="No history yet"
          subtitle="Log a few drinks and your week fills in here."
        />
      </View>
    );
  }

  const goal = days[0]?.goal_ml ?? 2000;
  const peak = Math.max(goal, ...days.map((d) => d.total_intake_ml));

  return (
    <View className="mt-5">
      {/* Hero chart card — selected-day readout + interactive bars */}
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        className="overflow-hidden rounded-3xl border border-white/80 bg-white/80"
        style={cardShadow}
      >
        {selected && <SelectedReadout day={selected} unit={unit} goal={goal} />}

        <View className="px-4 pb-4 pt-2">
          <View style={{ height: CHART_H }} className="relative">
            <GoalLine goalRatio={peak > 0 ? goal / peak : 0} />
            <View className="absolute inset-0 flex-row items-end">
              {ordered.map((day, i) => (
                <Bar
                  key={day.date}
                  day={day}
                  peak={peak}
                  index={i}
                  count={ordered.length}
                  selected={day.date === selectedDate}
                  onPress={() => {
                    tapSelection();
                    setSelectedDate(day.date);
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Stats grid */}
      <View className="mt-4 flex-row gap-3">
        <StatCard
          icon="water-outline"
          label="Daily average"
          value={formatVolume(stats.avg, unit)}
        />
        <StatCard
          icon="checkmark-done-outline"
          label="Goals met"
          value={`${stats.daysMet}/${days.length}`}
        />
      </View>
      <View className="mt-3 flex-row gap-3">
        <StatCard
          icon="flame-outline"
          label="Current streak"
          value={stats.streak === 1 ? '1 day' : `${stats.streak} days`}
          sub={stats.longestStreak > 0 ? `Best: ${stats.longestStreak} days` : undefined}
          accent={stats.streak > 0}
        />
        <StatCard
          icon="trophy-outline"
          label="Best day"
          value={formatVolume(stats.best, unit)}
        />
      </View>

      {/* Selected day's drinks (read-only) */}
      {selected && <DayDrinks date={selected.date} unit={unit} />}
    </View>
  );
}

/** Card header that reflects whichever bar is selected. */
function SelectedReadout({
  day,
  unit,
  goal,
}: {
  day: DailySummary;
  unit: UnitPreference;
  goal: number;
}) {
  const pct = goal > 0 ? Math.round((day.total_intake_ml / goal) * 100) : 0;
  const isToday = day.date === todayKey();
  return (
    <Animated.View
      key={day.date}
      entering={FadeIn.duration(220)}
      className="border-b border-slate-100 px-5 pb-4 pt-4"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-medium text-slate-500">
          {isToday ? 'Today' : formatDayLabel(day.date)}
        </Text>
        {day.goal_met && (
          <View className="flex-row items-center gap-1 rounded-full bg-aqua-300/30 px-2 py-0.5">
            <Ionicons name="checkmark" size={11} color={colors.aqua[500]} />
            <Text className="text-[11px] font-semibold text-aqua-500">Goal met</Text>
          </View>
        )}
      </View>
      <View className="mt-1 flex-row items-end gap-2">
        <Text className="text-3xl font-extrabold text-hydro-950">
          {formatVolume(day.total_intake_ml, unit)}
        </Text>
        <Text className="pb-1 text-sm font-medium text-slate-400">{pct}% of goal</Text>
      </View>
    </Animated.View>
  );
}

function GoalLine({ goalRatio }: { goalRatio: number }) {
  const bottom = Math.min(CHART_H, goalRatio * CHART_H);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom }}>
      <View className="flex-row items-center">
        <View className="flex-1 border-t border-dashed border-hydro-300" />
        <Text className="ml-2 text-[10px] font-semibold text-hydro-400">Goal</Text>
      </View>
    </View>
  );
}

function Bar({
  day,
  peak,
  index,
  count,
  selected,
  onPress,
}: {
  day: DailySummary;
  peak: number;
  index: number;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const ratio = peak > 0 ? day.total_intake_ml / peak : 0;
  const target = Math.max(day.total_intake_ml > 0 ? 6 : 2, ratio * CHART_H);

  // Grow the bar up from the baseline on mount / range change.
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = 0;
    grow.value = withDelay(
      index * (count > 10 ? 18 : 45),
      withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, index, count]);
  const barStyle = useAnimatedStyle(() => ({ height: grow.value }));

  const dense = count > 10;
  const showLabel = !dense || index % 5 === 0 || index === count - 1;
  const isToday = day.date === todayKey();

  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-end" style={{ height: CHART_H }}>
      <Animated.View style={[{ width: dense ? '64%' : '52%' }, barStyle]}>
        {day.goal_met ? (
          <LinearGradient
            colors={gradients.water}
            style={{ flex: 1, borderRadius: dense ? 4 : 7 }}
          />
        ) : (
          <View
            className="flex-1 bg-hydro-200"
            style={{ borderRadius: dense ? 4 : 7, opacity: day.total_intake_ml > 0 ? 1 : 0.5 }}
          />
        )}
        {selected && (
          <View
            pointerEvents="none"
            className="absolute -inset-x-0.5 -inset-y-0.5 rounded-lg border-2 border-hydro-500"
          />
        )}
      </Animated.View>
      <Text
        numberOfLines={1}
        className={`mt-1.5 text-[10px] ${
          isToday ? 'font-bold text-hydro-600' : 'font-medium text-slate-400'
        }`}
        style={{ opacity: showLabel ? 1 : 0 }}
      >
        {labelFor(day.date, dense)}
      </Text>
    </Pressable>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View
      className="flex-1 rounded-3xl border border-white/80 bg-white/70 px-4 py-4"
      style={cardShadow}
    >
      <Ionicons
        name={icon}
        size={18}
        color={accent ? colors.aqua[500] : colors.hydro[400]}
      />
      <Text className="mt-2 text-xs font-medium text-slate-400">{label}</Text>
      <Text className="mt-0.5 text-xl font-bold text-hydro-950">{value}</Text>
      {sub && <Text className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</Text>}
    </View>
  );
}

/** Read-only list of the selected day's drinks. */
function DayDrinks({ date, unit }: { date: string; unit: UnitPreference }) {
  const entries = useLogEntries(date);
  const rows = entries.data ?? [];

  if (entries.isLoading || rows.length === 0) return null;

  return (
    <View className="mt-6">
      <Text className="mb-3 text-lg font-semibold text-slate-800">
        {date === todayKey() ? "Today's drinks" : 'Drinks that day'}
      </Text>
      <View className="gap-2">
        {rows.map((entry) => (
          <DayDrinkRow key={entry.id} entry={entry} unit={unit} />
        ))}
      </View>
    </View>
  );
}

function DayDrinkRow({ entry, unit }: { entry: LogEntry; unit: UnitPreference }) {
  const volume = entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml;
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-hydro-50">
        <Text className="text-lg">{beverageEmoji(entry.beverage_type)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-slate-800">
          {beverageLabel(entry.beverage_type)}
        </Text>
        <Text className="text-xs text-slate-400">{formatTime(entry.logged_at)}</Text>
      </View>
      <Text className="text-base font-semibold text-slate-700">
        {formatVolume(volume, unit)}
      </Text>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#0C4A6E',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

/** Weekday letter for dense view; weekday letter + day number otherwise. */
function labelFor(dateKey: string, dense: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const letter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
  return dense ? String(date.getDate()) : letter;
}

interface HistoryStats {
  avg: number;
  daysMet: number;
  streak: number;
  longestStreak: number;
  best: number;
}

/** Roll up the range into the headline stats. `days` is most-recent-first. */
function computeStats(days: DailySummary[]): HistoryStats {
  const avg = Math.round(
    days.reduce((s, d) => s + d.total_intake_ml, 0) / Math.max(1, days.length),
  );
  const daysMet = days.filter((d) => d.goal_met).length;
  const best = Math.max(0, ...days.map((d) => d.total_intake_ml));
  const { current: streak, longest: longestStreak } = computeStreaks(days);
  return { avg, daysMet, streak, longestStreak, best };
}
