import { useState } from 'react';
import { View, Text, Pressable, Image, Modal } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { VolumeAdjuster } from './VolumeAdjuster';
import { useDeleteLog, useUpdateLog } from '@/lib/query/hooks';
import { beverageEmoji, beverageLabel } from '@/lib/beverage';
import { formatTime } from '@/lib/date';
import { formatVolume } from '@/lib/units';
import type { LogEntry, UnitPreference } from '@/lib/data/types';

interface LogFeedProps {
  entries: LogEntry[];
  unit: UnitPreference;
}

/** Today's logged drinks. Tap a row to adjust its volume or delete it. */
export function LogFeed({ entries, unit }: LogFeedProps) {
  const [editing, setEditing] = useState<LogEntry | null>(null);

  if (entries.length === 0) {
    return (
      <View className="items-center py-10">
        <Text className="text-4xl">🥤</Text>
        <Text className="mt-3 text-base font-medium text-slate-500">
          No drinks logged yet today
        </Text>
        <Text className="text-sm text-slate-400">
          Tap the camera to log your first.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {entries.map((entry) => (
        <LogRow key={entry.id} entry={entry} unit={unit} onPress={() => setEditing(entry)} />
      ))}
      <EditSheet entry={editing} unit={unit} onClose={() => setEditing(null)} />
    </View>
  );
}

function LogRow({
  entry,
  unit,
  onPress,
}: {
  entry: LogEntry;
  unit: UnitPreference;
  onPress: () => void;
}) {
  const volume = entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 active:bg-slate-50"
    >
      {entry.thumbnail_url ? (
        <Image source={{ uri: entry.thumbnail_url }} className="h-11 w-11 rounded-xl" />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-hydro-50">
          <Text className="text-xl">{beverageEmoji(entry.beverage_type)}</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-slate-800">
          {beverageLabel(entry.beverage_type)}
        </Text>
        <Text className="text-xs text-slate-400">{formatTime(entry.logged_at)}</Text>
      </View>
      <Text className="text-base font-semibold text-slate-700">
        {formatVolume(volume, unit)}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </Pressable>
  );
}

function EditSheet({
  entry,
  unit,
  onClose,
}: {
  entry: LogEntry | null;
  unit: UnitPreference;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      {entry && <EditSheetBody entry={entry} unit={unit} onClose={onClose} />}
    </Modal>
  );
}

function EditSheetBody({
  entry,
  unit,
  onClose,
}: {
  entry: LogEntry;
  unit: UnitPreference;
  onClose: () => void;
}) {
  const updateLog = useUpdateLog();
  const deleteLog = useDeleteLog();
  const [volumeMl, setVolumeMl] = useState(
    entry.user_adjusted_volume_ml ?? entry.estimated_volume_ml,
  );

  const save = () => {
    updateLog.mutate({ id: entry.id, patch: { user_adjusted_volume_ml: volumeMl } });
    onClose();
  };

  const remove = () => {
    deleteLog.mutate(entry.id);
    onClose();
  };

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20).mass(0.6)}
      className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pb-10 pt-3"
    >
      <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-slate-200" />
      <Animated.View entering={FadeIn.delay(100)}>
        <View className="mb-6 flex-row items-center gap-3">
          <Text className="text-3xl">{beverageEmoji(entry.beverage_type)}</Text>
          <Text className="text-xl font-bold text-slate-900">
            {beverageLabel(entry.beverage_type)}
          </Text>
        </View>

        <VolumeAdjuster valueMl={volumeMl} onChange={setVolumeMl} unit={unit} />

        <Pressable
          onPress={save}
          className="mt-6 h-14 items-center justify-center rounded-2xl bg-hydro-500 active:bg-hydro-600"
        >
          <Text className="text-lg font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable onPress={remove} className="mt-2 h-12 flex-row items-center justify-center gap-2">
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text className="text-base font-medium text-red-500">Delete</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
