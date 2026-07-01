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
 * Current user id for the active session. Sign-in is required (Apple/Google,
 * see `lib/auth.ts`), so the auth gate in `app/_layout.tsx` guarantees a
 * session exists before any data-layer call runs — and the query layer gates
 * `useProfile` on the session too. If neither held, this throws rather than
 * silently creating a user. The DB trigger `handle_new_user` creates the
 * caller's `profiles` row at sign-up, so callers can assume it exists.
 */
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in.');
  return data.user.id;
}

/**
 * Sign out of the current session. Used by account deletion and the Profile
 * "Sign out" action; the auth-state listener then routes the app back to the
 * sign-in gate.
 */
export async function resetSession(): Promise<void> {
  await supabase.auth.signOut();
}
