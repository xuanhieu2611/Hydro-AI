import { View, Text, Pressable } from 'react-native';

import { useAddLog } from '@/lib/query/hooks';
import { QUICK_LOG_TILES, tileToLogEntry, type QuickLogTile } from '@/lib/quicklog';
import { formatVolume } from '@/lib/units';
import type { UnitPreference } from '@/lib/data/types';

interface QuickLogBarProps {
  unit: UnitPreference;
}

/**
 * One-tap common-drink tiles (PRD §4.3). Logs without a photo via the same
 * optimistic `useAddLog` path, so the progress ring reacts instantly.
 */
export function QuickLogBar({ unit }: QuickLogBarProps) {
  const addLog = useAddLog();

  return (
    <View className="flex-row gap-2">
      {QUICK_LOG_TILES.map((tile) => (
        <QuickTile
          key={tile.id}
          tile={tile}
          unit={unit}
          onPress={() => addLog.mutate(tileToLogEntry(tile))}
        />
      ))}
    </View>
  );
}

function QuickTile({
  tile,
  unit,
  onPress,
}: {
  tile: QuickLogTile;
  unit: UnitPreference;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-1 rounded-2xl border border-slate-100 bg-white py-3 active:bg-hydro-50"
    >
      <Text className="text-2xl">{tile.emoji}</Text>
      <Text className="text-xs font-semibold text-slate-700">{tile.label}</Text>
      <Text className="text-[11px] text-slate-400">
        +{formatVolume(tile.volumeMl, unit)}
      </Text>
    </Pressable>
  );
}
