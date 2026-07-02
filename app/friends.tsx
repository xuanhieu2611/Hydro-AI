import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerCard } from '@/components/PartnerCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/StateViews';
import {
  useProfile,
  useConnections,
  useCreateInvite,
  useClaimInvite,
  useRemoveConnection,
} from '@/lib/query/hooks';
import { inviteMessage } from '@/lib/invite';
import { colors, gradients } from '@/lib/theme';
import type { ConnectionSummary } from '@/lib/data/types';

export default function FriendsScreen() {
  const router = useRouter();
  const profile = useProfile();
  const connections = useConnections();
  const createInvite = useCreateInvite();
  const claimInvite = useClaimInvite();
  const removeConnection = useRemoveConnection();

  const unit = profile.data?.unit_preference ?? 'ml';
  const [code, setCode] = useState('');

  const shareInvite = async () => {
    try {
      const invite = await createInvite.mutateAsync();
      await Share.share({ message: `${inviteMessage(invite.code)}\n${invite.url}` });
    } catch {
      Alert.alert('Something went wrong', 'Could not create an invite. Try again.');
    }
  };

  const connect = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const partner = await claimInvite.mutateAsync(trimmed);
      setCode('');
      Alert.alert(
        'Connected 💧',
        `You're now sharing progress with ${partner.partner.display_name ?? 'them'}.`,
      );
    } catch (err) {
      // InviteError carries a friendly message; fall back for anything else.
      Alert.alert(
        "Couldn't connect",
        err instanceof Error ? err.message : 'Please check the code and try again.',
      );
    }
  };

  const confirmRemove = (c: ConnectionSummary) => {
    Alert.alert(
      `Remove ${c.partner.display_name ?? 'this connection'}?`,
      "You'll both stop seeing each other's progress.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeConnection.mutate(c.connection_id),
        },
      ],
    );
  };

  const items = connections.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <ScrollView contentContainerClassName="px-6 pt-4 pb-16" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-3xl font-bold text-hydro-950">Your circle</Text>
            <Text className="mt-1 text-base text-slate-500">
              Share today's hydration with the people who keep you accountable.
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8} className="mt-1">
            <Ionicons name="close" size={26} color={colors.slate[400]} />
          </Pressable>
        </View>

        {/* Invite — hand out a code / deep link */}
        <Pressable
          onPress={shareInvite}
          disabled={createInvite.isPending}
          className="mt-6 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
        >
          {createInvite.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="white" />
              <Text className="text-base font-semibold text-white">Invite someone</Text>
            </>
          )}
        </Pressable>

        {/* Join — enter a code someone shared */}
        <View className="mt-4 flex-row items-center gap-2">
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Enter a code"
            placeholderTextColor={colors.slate[400]}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={connect}
            maxLength={8}
            className="h-14 flex-1 rounded-2xl border border-slate-200 bg-white/70 px-4 text-base font-semibold tracking-widest text-hydro-950"
          />
          <Pressable
            onPress={connect}
            disabled={claimInvite.isPending || code.trim().length === 0}
            className={`h-14 items-center justify-center rounded-2xl px-5 ${
              code.trim().length === 0 ? 'bg-slate-200' : 'bg-hydro-600 active:bg-hydro-700'
            }`}
          >
            {claimInvite.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Connect</Text>
            )}
          </Pressable>
        </View>

        {/* The circle */}
        <Text className="mb-1 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Connected
        </Text>
        {connections.isLoading ? (
          <LoadingState />
        ) : connections.isError ? (
          <ErrorState subtitle="Couldn't load your circle." onRetry={() => connections.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            emoji="🤝"
            title="No connections yet"
            subtitle="Invite someone or enter their code to get started."
          />
        ) : (
          <>
            <View className="flex-row flex-wrap">
              {items.map((c) => (
                <PartnerCard
                  key={c.connection_id}
                  summary={c}
                  unit={unit}
                  onLongPress={() => confirmRemove(c)}
                />
              ))}
            </View>
            <Text className="mt-2 text-center text-xs text-slate-400">
              Long-press a friend to remove them.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
