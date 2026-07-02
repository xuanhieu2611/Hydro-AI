import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useClaimInvite } from '@/lib/query/hooks';
import { colors, gradients } from '@/lib/theme';

/**
 * Deep-link target for `hydroai://invite/<code>` (native Share sheet / typed
 * link). Redeems the code once on mount, then shows the outcome. The auth gate
 * (app/_layout) guarantees we only mount here signed-in + onboarded, so an
 * unauthenticated tap flows through onboarding/sign-in first and lands here.
 */
export default function ClaimInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const claimInvite = useClaimInvite();

  const [status, setStatus] = useState<'claiming' | 'success' | 'error'>('claiming');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !code) return;
    ran.current = true;
    (async () => {
      try {
        const partner = await claimInvite.mutateAsync(code);
        setMessage(
          `You're now sharing hydration with ${partner.partner.display_name ?? 'your friend'}.`,
        );
        setStatus('success');
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : 'That invite link could not be used.',
        );
        setStatus('error');
      }
    })();
  }, [code]);

  const goHome = () => router.replace('/');

  return (
    <SafeAreaView className="flex-1 bg-white">
      <LinearGradient
        colors={gradients.sky}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="flex-1 items-center justify-center px-8">
        {status === 'claiming' ? (
          <>
            <ActivityIndicator color={colors.hydro[500]} />
            <Text className="mt-4 text-base font-medium text-slate-500">
              Connecting you…
            </Text>
          </>
        ) : (
          <>
            <View
              className={`h-20 w-20 items-center justify-center rounded-full ${
                status === 'success' ? 'bg-hydro-50' : 'bg-red-50'
              }`}
            >
              <Ionicons
                name={status === 'success' ? 'water' : 'alert-circle-outline'}
                size={40}
                color={status === 'success' ? colors.hydro[500] : '#EF4444'}
              />
            </View>
            <Text className="mt-5 text-center text-2xl font-bold text-hydro-950">
              {status === 'success' ? 'Connected 💧' : "Couldn't connect"}
            </Text>
            <Text className="mt-2 text-center text-base text-slate-500">{message}</Text>

            <Pressable
              onPress={goHome}
              className="mt-8 h-14 w-full items-center justify-center rounded-2xl bg-hydro-500 active:bg-hydro-600"
            >
              <Text className="text-base font-semibold text-white">Go to Hydro AI</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
