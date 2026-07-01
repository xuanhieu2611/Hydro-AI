import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/lib/theme';
import {
  signInWithApple,
  signInWithGoogle,
  isAppleSignInSupported,
} from '@/lib/auth';
import { AuthCancelledError } from '@/lib/data/errors';

type Provider = 'apple' | 'google';

/**
 * Apple/Google native sign-in buttons (CLAUDE.md: auth is required). Used as the
 * final step of onboarding — `onBeforeSignIn` runs first (we persist the
 * onboarding draft there) and, on success, the auth-state listener flips the gate
 * so the root finalize can flush the draft; nothing to do here on success.
 * Cancelling a native dialog is a no-op (no error surfaced).
 */
export function SignInButtons({
  onBeforeSignIn,
}: {
  onBeforeSignIn?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<Provider | null>(null);

  const run = async (provider: Provider, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(provider);
    try {
      await onBeforeSignIn?.();
      await fn();
    } catch (e) {
      if (!(e instanceof AuthCancelledError)) {
        Alert.alert(
          'Sign-in failed',
          e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-3">
      {isAppleSignInSupported && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={16}
          style={{ height: 56, width: '100%' }}
          onPress={() => run('apple', signInWithApple)}
        />
      )}

      <GoogleButton
        loading={busy === 'google'}
        disabled={busy != null}
        onPress={() => run('google', signInWithGoogle)}
      />
    </View>
  );
}

/** White "Continue with Google" button (Google brand: light theme). */
function GoogleButton({
  loading,
  disabled,
  onPress,
}: {
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-14 flex-row items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white active:bg-slate-50"
      style={{
        shadowColor: '#0C4A6E',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.slate[500]} />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text className="text-base font-semibold text-slate-800">
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}
