import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  useProfile,
  useLogEntries,
  useDailySummary,
  useHistory,
  useAddLog,
  useUpdateLog,
  useDeleteLog,
  useAnalyzeImage,
} from '@/lib/query/hooks';
import { dataSource } from '@/lib/data';
import { formatProgress, formatVolume } from '@/lib/units';
import type { AnalysisResult } from '@/lib/data/types';

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg bg-hydro-500 px-3 py-2 active:bg-hydro-600"
    >
      <Text className="text-center text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

/**
 * Phase 1 verification screen (throwaway). Confirms the whole app can read
 * dummy data and add/edit/delete it through the TanStack Query hooks — all
 * in memory, with no backend. Removed once real screens land.
 */
export default function DevScreen() {
  const router = useRouter();
  const profile = useProfile();
  const entries = useLogEntries();
  const summary = useDailySummary();
  const history = useHistory(7);

  const addLog = useAddLog();
  const updateLog = useUpdateLog();
  const deleteLog = useDeleteLog();
  const analyze = useAnalyzeImage();

  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);

  const unit = profile.data?.unit_preference ?? 'ml';

  const runAnalyze = () => {
    analyze.mutate('mock://image.jpg', { onSuccess: setLastAnalysis });
  };

  const logFromAnalysis = () => {
    if (!lastAnalysis?.is_drink || lastAnalysis.estimated_volume_ml == null) return;
    addLog.mutate({
      beverage_type: lastAnalysis.beverage_type ?? 'other',
      estimated_volume_ml: lastAnalysis.estimated_volume_ml,
      hydration_coefficient: lastAnalysis.hydration_coefficient ?? 1.0,
      ai_confidence_score: lastAnalysis.confidence,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerClassName="p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-900">Data-layer check</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-hydro-600">Close</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-slate-400">source: {dataSource}</Text>

        {/* Profile + summary */}
        <View className="rounded-xl bg-slate-50 p-4">
          {profile.isLoading || summary.isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <Text className="text-base font-semibold text-slate-800">
                {profile.data?.display_name ?? 'No name'}
              </Text>
              <Text className="mt-1 text-slate-600">
                {summary.data
                  ? formatProgress(
                      summary.data.total_intake_ml,
                      summary.data.goal_ml,
                      unit,
                    )
                  : '—'}
                {summary.data?.goal_met ? '  ✅ goal met' : ''}
              </Text>
            </>
          )}
        </View>

        {/* Analyzer */}
        <View className="gap-2 rounded-xl bg-slate-50 p-4">
          <Text className="font-semibold text-slate-800">Analyzer (cycles cases)</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Btn label={analyze.isPending ? 'Analyzing…' : 'Analyze image'} onPress={runAnalyze} />
            </View>
            <View className="flex-1">
              <Btn label="Log result" onPress={logFromAnalysis} />
            </View>
          </View>
          {lastAnalysis && (
            <Text className="text-xs text-slate-500">
              {lastAnalysis.is_drink
                ? `${lastAnalysis.beverage_type} · ${lastAnalysis.estimated_volume_ml}ml · conf ${lastAnalysis.confidence}`
                : lastAnalysis.reasoning}
            </Text>
          )}
        </View>

        {/* Mutations */}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Btn
              label="+ Quick water 250ml"
              onPress={() =>
                addLog.mutate({
                  beverage_type: 'water',
                  estimated_volume_ml: 250,
                  hydration_coefficient: 1.0,
                })
              }
            />
          </View>
        </View>

        {/* Today's entries */}
        <Text className="mt-2 font-semibold text-slate-800">
          Today · {entries.data?.length ?? 0} entries
        </Text>
        {entries.isLoading ? (
          <ActivityIndicator />
        ) : (
          entries.data?.map((e) => (
            <View
              key={e.id}
              className="flex-row items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
            >
              <View>
                <Text className="font-medium capitalize text-slate-800">
                  {e.beverage_type}
                </Text>
                <Text className="text-xs text-slate-500">
                  {formatVolume(e.user_adjusted_volume_ml ?? e.estimated_volume_ml, unit)} ·{' '}
                  {formatVolume(e.effective_hydration_ml, unit)} effective
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() =>
                    updateLog.mutate({
                      id: e.id,
                      patch: {
                        user_adjusted_volume_ml:
                          (e.user_adjusted_volume_ml ?? e.estimated_volume_ml) + 50,
                      },
                    })
                  }
                >
                  <Text className="text-hydro-600">+50</Text>
                </Pressable>
                <Pressable onPress={() => deleteLog.mutate(e.id)}>
                  <Text className="text-red-500">Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* History */}
        <Text className="mt-2 font-semibold text-slate-800">Last 7 days</Text>
        {history.data?.map((d) => (
          <View key={d.date} className="flex-row justify-between">
            <Text className="text-slate-600">{d.date}</Text>
            <Text className={d.goal_met ? 'text-hydro-600' : 'text-slate-400'}>
              {formatVolume(d.total_intake_ml, unit)} {d.goal_met ? '✅' : ''}
            </Text>
          </View>
        ))}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
