import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { LoadingState, ErrorState, EmptyState } from '@/components/StateViews';
import { useHistory, useProfile } from '@/lib/query/hooks';
import { gradients } from '@/lib/theme';
import { formatVolume } from '@/lib/units';
import type { DailySummary, UnitPreference } from '@/lib/data/types';

const RANGE_DAYS = 7;

export default function HistoryScreen() {
  const profile = useProfile();
  const history = useHistory(RANGE_DAYS);
  const unit = profile.data?.unit_preference ?? 'ml';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="flex-1 px-6 pt-4">
        <Text className="text-3xl font-bold text-hydro-950">History</Text>
        <Text className="mt-1 text-base text-slate-500">Your last 7 days</Text>

        {history.isLoading ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState
            subtitle="Couldn't load your history."
            onRetry={() => history.refetch()}
          />
        ) : (
          <HistoryBody days={history.data ?? []} unit={unit} />
        )}
      </View>
    </SafeAreaView>
  );
}

function HistoryBody({ days, unit }: { days: DailySummary[]; unit: UnitPreference }) {
  const hasAny = days.some((d) => d.total_intake_ml > 0);
  if (!hasAny) {
    return (
      <EmptyState
        emoji="📊"
        title="No history yet"
        subtitle="Log a few drinks and your week fills in here."
      />
    );
  }

  // getHistory is most-recent-first; show oldest → newest left to right.
  const ordered = [...days].reverse();
  const goal = days[0]?.goal_ml ?? 2000;
  const peak = Math.max(goal, ...days.map((d) => d.total_intake_ml));
  const daysMet = days.filter((d) => d.goal_met).length;
  const avg = Math.round(
    days.reduce((s, d) => s + d.total_intake_ml, 0) / Math.max(1, days.length),
  );

  return (
    <View className="mt-6 flex-1">
      {/* Summary stats */}
      <View className="flex-row gap-3">
        <StatCard label="Daily average" value={formatVolume(avg, unit)} />
        <StatCard label="Goals met" value={`${daysMet} / ${days.length}`} />
      </View>

      {/* Weekly bars */}
      <View className="mt-8 flex-row items-end justify-between" style={{ height: 200 }}>
        {ordered.map((day) => (
          <Bar key={day.date} day={day} peak={peak} />
        ))}
      </View>
    </View>
  );
}

function Bar({ day, peak }: { day: DailySummary; peak: number }) {
  const ratio = peak > 0 ? day.total_intake_ml / peak : 0;
  const heightPct = Math.max(2, Math.round(ratio * 100));
  return (
    <View className="flex-1 items-center gap-2">
      <View className="w-full flex-1 justify-end px-1.5">
        {day.goal_met ? (
          // Goal met → a full "column of water" (the app's fluid identity).
          <LinearGradient
            colors={gradients.water}
            style={{ width: '100%', height: `${heightPct}%`, borderRadius: 8 }}
          />
        ) : (
          <View
            className="w-full rounded-lg bg-hydro-200"
            style={{ height: `${heightPct}%` }}
          />
        )}
      </View>
      <Text className="text-xs font-medium text-slate-400">{weekdayLabel(day.date)}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-3xl border border-white/80 bg-white/70 px-4 py-4"
      style={{
        shadowColor: '#0C4A6E',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text className="text-xs font-medium text-slate-400">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-hydro-950">{value}</Text>
    </View>
  );
}

/** Single-letter weekday for a 'YYYY-MM-DD' key, in local time. */
function weekdayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(y, m - 1, d).getDay()];
}
