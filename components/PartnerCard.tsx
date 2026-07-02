import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ProgressRing } from './ProgressRing';
import { colors, gradients } from '@/lib/theme';
import type { ConnectionSummary, UnitPreference } from '@/lib/data/types';
import { formatVolume } from '@/lib/units';

/**
 * A single member of the accountability circle: their avatar inside a progress
 * ring (today's hydration toward their goal) with name + streak. Summary only —
 * this is the entire surface of another user's data we ever render (privacy
 * scope locked with the user). Used both in the Home `CircleStrip` and the
 * Friends screen; `onLongPress` powers remove-connection there.
 */
export function PartnerCard({
  summary,
  unit,
  onPress,
  onLongPress,
}: {
  summary: ConnectionSummary;
  unit: UnitPreference;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { partner, today, streak } = summary;
  const progress = today.goal_ml > 0 ? today.total_intake_ml / today.goal_ml : 0;
  const pct = Math.round(progress * 100);
  const name = partner.display_name ?? 'Friend';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="w-28 items-center rounded-3xl px-2 py-3 active:bg-white/60"
    >
      <ProgressRing
        progress={progress}
        size={78}
        strokeWidth={7}
        progressColor={today.goal_met ? colors.aqua[500] : colors.hydro[500]}
      >
        <Avatar name={name} avatarUrl={partner.avatar_url} />
      </ProgressRing>

      <Text
        numberOfLines={1}
        className="mt-2 max-w-full text-sm font-semibold text-hydro-950"
      >
        {name}
      </Text>

      <View className="mt-0.5 flex-row items-center gap-1">
        {today.goal_met ? (
          <Ionicons name="checkmark-circle" size={13} color={colors.aqua[500]} />
        ) : null}
        <Text className="text-xs font-medium text-slate-500">
          {formatVolume(today.total_intake_ml, unit)}
        </Text>
      </View>

      {streak > 0 && (
        <View className="mt-1 flex-row items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5">
          <Ionicons name="flame" size={11} color="#F97316" />
          <Text className="text-[11px] font-bold text-orange-600">{streak}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name.trim()[0]?.toUpperCase() ?? null;
  if (avatarUrl) {
    return (
      <Image source={{ uri: avatarUrl }} style={{ width: 54, height: 54, borderRadius: 27 }} />
    );
  }
  return (
    <LinearGradient
      colors={gradients.hero}
      style={{ width: 54, height: 54, borderRadius: 27 }}
      className="items-center justify-center"
    >
      {initial ? (
        <Text className="text-xl font-bold text-white">{initial}</Text>
      ) : (
        <Text className="text-2xl">💧</Text>
      )}
    </LinearGradient>
  );
}
