import { useEffect, useRef, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';

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

  // Load (or reuse) this user's invite code once on mount so the card can show
  // it. The server RPC reuses an existing unclaimed, unexpired invite, so this
  // is idempotent and the code stays stable.
  const [myCode, setMyCode] = useState<string | null>(null);
  const requestedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const loadCode = async () => {
    try {
      const invite = await createInvite.mutateAsync();
      setMyCode(invite.code);
    } catch {
      // Leave myCode null → the card shows a retry.
    }
  };

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    loadCode();
  }, []);

  const copyCode = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareInvite = async () => {
    if (!myCode) return;
    try {
      await Share.share({ message: inviteMessage(myCode) });
    } catch {
      // User cancelled the share sheet — nothing to do.
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

        {/* Invite — show a copyable code + share the App Store link */}
        <View className="mt-6 rounded-3xl border border-white/60 bg-white/70 p-5">
          <Text className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            Your invite code
          </Text>

          {myCode ? (
            <>
              <Text
                selectable
                className="mt-2 text-center text-4xl font-bold tracking-[8px] text-hydro-950"
              >
                {myCode}
              </Text>
              <Text className="mt-1 text-center text-sm text-slate-500">
                Share this code — your friend enters it below to join.
              </Text>

              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={copyCode}
                  className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-hydro-500 active:bg-hydro-600"
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={20}
                    color="white"
                  />
                  <Text className="text-base font-semibold text-white">
                    {copied ? 'Copied' : 'Copy code'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={shareInvite}
                  className="h-14 w-14 items-center justify-center rounded-2xl border border-hydro-200 bg-white active:bg-hydro-50"
                >
                  <Ionicons name="share-outline" size={22} color={colors.hydro[600]} />
                </Pressable>
              </View>
            </>
          ) : createInvite.isPending ? (
            <View className="h-24 items-center justify-center">
              <ActivityIndicator color={colors.hydro[500]} />
            </View>
          ) : (
            <Pressable
              onPress={loadCode}
              className="mt-3 h-12 items-center justify-center rounded-2xl bg-hydro-500 active:bg-hydro-600"
            >
              <Text className="text-base font-semibold text-white">Get my code</Text>
            </Pressable>
          )}
        </View>

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
