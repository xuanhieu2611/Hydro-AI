import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BeveragePicker } from '@/components/BeveragePicker';
import { VolumeAdjuster } from '@/components/VolumeAdjuster';
import { useAddLog, useProfile } from '@/lib/query/hooks';
import { DEFAULT_HYDRATION_COEFFICIENT } from '@/lib/beverage';
import type { BeverageType } from '@/lib/data/types';

/**
 * Manual log fallback (US-06): pick a beverage type + volume, no photo, no AI.
 * Logs via the same optimistic `useAddLog` path as the camera flow.
 */
export default function ManualLogModal() {
  const router = useRouter();
  const profile = useProfile();
  const addLog = useAddLog();

  const unit = profile.data?.unit_preference ?? 'ml';
  const [beverage, setBeverage] = useState<BeverageType>('water');
  const [volumeMl, setVolumeMl] = useState(250);

  const handleLog = () => {
    addLog.mutate(
      {
        beverage_type: beverage,
        estimated_volume_ml: volumeMl,
        hydration_coefficient: DEFAULT_HYDRATION_COEFFICIENT[beverage],
        thumbnail_url: null,
        ai_confidence_score: null,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-900">Log a drink</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={26} color="#94A3B8" />
          </Pressable>
        </View>

        <Text className="mt-8 mb-3 text-sm font-semibold text-slate-500">
          Beverage
        </Text>
        <BeveragePicker value={beverage} onChange={setBeverage} />

        <Text className="mt-8 mb-4 text-sm font-semibold text-slate-500">
          Volume
        </Text>
        <VolumeAdjuster valueMl={volumeMl} onChange={setVolumeMl} unit={unit} />
      </View>

      <View className="px-6 pb-10">
        <Pressable
          onPress={handleLog}
          disabled={addLog.isPending}
          className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
        >
          {addLog.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="water" size={20} color="white" />
              <Text className="text-lg font-semibold text-white">Log It</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
