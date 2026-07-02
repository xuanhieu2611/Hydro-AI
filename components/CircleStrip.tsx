import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerCard } from './PartnerCard';
import { useConnections } from '@/lib/query/hooks';
import { colors } from '@/lib/theme';
import type { UnitPreference } from '@/lib/data/types';

/**
 * Home-screen accountability widget: a glanceable row of connected partners'
 * hydration for today. Tapping any tile (or "Add") opens the Friends screen to
 * manage the circle. Empty state doubles as the primary call to add someone.
 */
export function CircleStrip({ unit }: { unit: UnitPreference }) {
  const connections = useConnections();
  const router = useRouter();

  // Stay quiet on error/first load — this is a secondary widget, not the core loop.
  if (connections.isError) return null;

  const items = connections.data ?? [];

  return (
    <View className="mt-8">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-slate-800">Your circle</Text>
        {items.length > 0 && (
          <Link href="/friends" asChild>
            <Pressable hitSlop={8} className="flex-row items-center gap-0.5">
              <Text className="text-sm font-medium text-hydro-600">Manage</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.hydro[600]} />
            </Pressable>
          </Link>
        )}
      </View>

      {connections.isLoading ? (
        <ActivityIndicator className="py-6" color={colors.hydro[500]} />
      ) : items.length === 0 ? (
        <EmptyCircle onPress={() => router.push('/friends')} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-1 pr-2"
        >
          {items.map((c) => (
            <PartnerCard
              key={c.connection_id}
              summary={c}
              unit={unit}
              onPress={() => router.push('/friends')}
            />
          ))}
          <AddTile onPress={() => router.push('/friends')} />
        </ScrollView>
      )}
    </View>
  );
}

function AddTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-28 items-center justify-center rounded-3xl px-2 py-3 active:bg-white/60"
    >
      <View className="h-[78px] w-[78px] items-center justify-center rounded-full border-2 border-dashed border-hydro-200">
        <Ionicons name="add" size={30} color={colors.hydro[500]} />
      </View>
      <Text className="mt-2 text-sm font-semibold text-hydro-600">Add</Text>
    </Pressable>
  );
}

function EmptyCircle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-3xl border border-hydro-100 bg-hydro-50 px-4 py-4 active:bg-hydro-100"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
        <Ionicons name="people" size={22} color={colors.hydro[500]} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-hydro-800">
          Stay accountable together 💧
        </Text>
        <Text className="mt-0.5 text-sm text-hydro-600">
          Add a partner, family, or friend to share progress.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.hydro[400]} />
    </Pressable>
  );
}
