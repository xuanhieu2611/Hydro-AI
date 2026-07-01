import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UnitPreference } from '../data/types';

/**
 * Onboarding answers buffered locally until sign-in. The app is onboarding-first
 * (name → goal → units → reminders → sign-in), but writes to `profiles` are
 * RLS-scoped, so an unauthenticated user can't persist anything. We stash the
 * answers here and a root-level finalize (see `useFinalizeOnboarding`) flushes
 * them to the profile once a session exists. Persisted (not just in memory) so
 * the answers survive the onboarding screen unmounting during the post-sign-in
 * profile-load splash — and a force-quit mid-flow.
 */
export interface OnboardingDraft {
  display_name: string | null; // null when the user left it blank
  daily_goal_ml: number;
  unit_preference: UnitPreference;
  reminders_enabled: boolean;
}

const KEY = 'hydro.onboarding.draft';

export async function saveDraft(draft: OnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<OnboardingDraft | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
