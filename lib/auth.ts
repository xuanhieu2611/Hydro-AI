import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';

import { supabase } from './supabase/client';
import { AuthCancelledError } from './data/errors';

/**
 * Native sign-in (CLAUDE.md: required Apple/Google auth, RLS does the rest).
 * Both providers use the OS dialog → ID token → `signInWithIdToken`, so there's
 * no web redirect (the client keeps `detectSessionInUrl: false`). Supabase
 * validates the ID token and creates/links the user; the `handle_new_user`
 * trigger seeds their `profiles` row.
 *
 * These only ever run from the sign-in step of onboarding (`app/onboarding.tsx`,
 * via `components/SignInButtons`), which is reachable only in `supabase`
 * data-source mode — mock mode is always "authenticated" and skips it entirely.
 */

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Configure Google sign-in once at startup. Safe to call repeatedly. */
export function configureGoogleSignin(): void {
  // Mock mode never shows the gate and may run on a build without the native
  // module (e.g. a simulator that hasn't been rebuilt) — keep it a true no-op.
  if (process.env.EXPO_PUBLIC_DATA_SOURCE !== 'supabase') return;
  GoogleSignin.configure({
    // The Web client id is what Supabase's Google provider is configured with;
    // it must be the audience of the ID token we hand to signInWithIdToken.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
}

/** Apple is iOS-only natively; the gate hides the button elsewhere. */
export const isAppleSignInSupported = Platform.OS === 'ios';

/**
 * Sign in with Apple. Apple returns the user's full name only on the *first*
 * authorization, so we opportunistically seed `display_name` from it then.
 * @throws AuthCancelledError if the user dismisses the dialog.
 */
export async function signInWithApple(): Promise<void> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    if (isAppleCancellation(e)) throw new AuthCancelledError();
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  const fullName = [
    credential.fullName?.givenName,
    credential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ');
  // Apple never returns a photo, so there's no avatar to seed.
  await seedIdentity(fullName);
}

/**
 * Sign in with Google.
 * @throws AuthCancelledError if the user dismisses the dialog.
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // v13+ returns a discriminated response; a cancel yields type === 'cancelled'.
    if (response.type === 'cancelled') throw new AuthCancelledError();

    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('Google sign-in did not return an ID token.');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;

    await seedIdentity(
      response.data?.user?.name ?? '',
      response.data?.user?.photo ?? undefined,
    );
  } catch (e) {
    if (e instanceof AuthCancelledError) throw e;
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new AuthCancelledError();
    }
    throw e;
  }
}

/** Sign out of the current session; the auth-state listener routes to the gate. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/* --------------------------------- helpers -------------------------------- */

function isAppleCancellation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

/**
 * Best-effort: seed `display_name` and `avatar_url` from the provider, but only
 * for fields the profile doesn't already have (don't clobber values the user
 * set, and — for the name — let onboarding's finalize override it afterward).
 * Failures are non-fatal — sign-in already succeeded.
 */
async function seedIdentity(name: string, avatarUrl?: string): Promise<void> {
  const trimmedName = name.trim();
  const trimmedAvatar = avatarUrl?.trim();
  if (!trimmedName && !trimmedAvatar) return;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', uid)
      .maybeSingle();
    if (!data) return;

    const patch: { display_name?: string; avatar_url?: string } = {};
    if (trimmedName && !data.display_name) patch.display_name = trimmedName;
    if (trimmedAvatar && !data.avatar_url) patch.avatar_url = trimmedAvatar;
    if (Object.keys(patch).length === 0) return;

    await supabase.from('profiles').update(patch).eq('id', uid);
  } catch {
    // Ignore — name/avatar are niceties, not part of the sign-in contract.
  }
}
