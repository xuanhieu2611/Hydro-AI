import { View, Text, Pressable } from 'react-native';
import { tapLight } from '@/lib/haptics';
import { useAddLog } from '@/lib/query/hooks';
import { QUICK_LOG_TILES, tileToLogEntry, type QuickLogTile } from '@/lib/quicklog';
import { analytics } from '@/lib/analytics';
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
          onPress={() => {
            tapLight();
            const entry = tileToLogEntry(tile);
            addLog.mutate(entry);
            analytics.track('log_added', {
              method: 'quick',
              beverage_type: entry.beverage_type,
              volume_ml: entry.estimated_volume_ml,
            });
          }}
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
      className="flex-1 items-center gap-1 rounded-3xl border border-white/80 bg-white/70 py-3.5 active:bg-hydro-50"
      style={{
        shadowColor: '#0C4A6E',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text className="text-2xl">{tile.emoji}</Text>
      <Text className="text-xs font-semibold text-slate-700">{tile.label}</Text>
      <Text className="text-[11px] font-medium text-hydro-500">
        +{formatVolume(tile.volumeMl, unit)}
      </Text>
    </Pressable>
  );
}
