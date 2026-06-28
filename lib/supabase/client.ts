import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Single Supabase client for the app (CLAUDE.md: one client singleton, never
 * ad-hoc fetch). Only the URL + anon key live in the app — every privileged
 * secret stays server-side (EAS / Edge Function env). RLS does the rest.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in .env (see .env.example) or switch EXPO_PUBLIC_DATA_SOURCE=mock.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based OAuth redirects in a native app.
    detectSessionInUrl: false,
  },
});

/**
 * Lazily ensure an authenticated session. The PRD/onboarding flow signs users
 * in anonymously on first launch (zero friction, camera-first). The DB trigger
 * `handle_new_user` creates their `profiles` row, so once this resolves the
 * rest of the data layer can assume a current user + profile exist.
 *
 * Memoized so concurrent first calls share one sign-in round-trip.
 */
let sessionPromise: Promise<void> | null = null;

export function ensureSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
    })();
  }
  return sessionPromise;
}

/** Current user id (after ensuring a session). */
export async function currentUserId(): Promise<string> {
  await ensureSession();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user after sign-in.');
  return data.user.id;
}

/**
 * Sign out and forget the cached session. Next `ensureSession()` mints a fresh
 * anonymous user (with a fresh, un-onboarded profile via the DB trigger) — used
 * by account deletion to reset to first-run state.
 */
export async function resetSession(): Promise<void> {
  await supabase.auth.signOut();
  sessionPromise = null;
}
