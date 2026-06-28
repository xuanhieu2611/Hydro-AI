import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Profile } from './data/types';

/**
 * Local notifications for Phase 4 retention (US-13, US-14).
 *
 * Everything here is device-local (no push server) — scheduled reminders within
 * the user's chosen window, a "haven't logged in a while" nudge, and a goal-met
 * celebration. The reminder schedule is driven entirely by the persisted Profile
 * fields (`reminders_*`), so `syncReminders(profile)` is the single source of
 * truth: call it whenever those settings change.
 *
 * We tag our notifications via `content.data.kind` so we can cancel just our own
 * (`reminder` / `nudge`) without clobbering anything else.
 */

type NotifKind = 'reminder' | 'nudge' | 'celebration';

/** How long without a log before the nudge fires (hours). */
const INACTIVITY_HOURS = 5;

/** Rotated so reminders don't read identically all day. */
const REMINDER_MESSAGES = [
  'Time for a sip 💧',
  'Hydration check — grab a glass of water.',
  'Your body called. It wants water. 🚰',
  "Quick break? Drink up and snap it.",
];

/**
 * Foreground handler — without this, notifications never present while the app
 * is open. SDK 56 uses `shouldShowBanner`/`shouldShowList` (the old
 * `shouldShowAlert` is deprecated). Safe to call once at startup.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ask the OS for permission. Returns whether it's granted. */
export async function requestPermissions(): Promise<boolean> {
  // Android needs a channel for notifications to display.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Hydration reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.granted;
}

/** Cancel only the scheduled notifications we tagged with one of `kinds`. */
async function cancelKinds(...kinds: NotifKind[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => kinds.includes(n.content.data?.kind as NotifKind))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** The reminder slots (local hours) implied by the window + interval. */
function reminderHours(profile: Profile): number[] {
  const { reminder_window_start_hour: start, reminder_window_end_hour: end } = profile;
  const step = Math.max(1, profile.reminder_interval_hours);
  const hours: number[] = [];
  for (let h = start; h <= end; h += step) hours.push(h);
  return hours;
}

/**
 * Reconcile the OS's scheduled reminders with the user's settings. Cancels the
 * previous schedule and re-creates it from the Profile — idempotent, so it's
 * safe to call on every profile change. No-op (just clears) when disabled.
 */
export async function syncReminders(profile: Profile): Promise<void> {
  await cancelKinds('reminder');
  if (!profile.reminders_enabled) return;

  const granted = await requestPermissions();
  if (!granted) return;

  await Promise.all(
    reminderHours(profile).map((hour, i) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hydro AI',
          body: REMINDER_MESSAGES[i % REMINDER_MESSAGES.length],
          data: { kind: 'reminder' satisfies NotifKind },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      }),
    ),
  );
}

/**
 * (Re)arm the "haven't logged in a while" nudge. Call after each successful log
 * to push it back out, and on app open. Only fires within the active window via
 * a same-day check at delivery isn't possible offline, so we keep it simple: a
 * one-shot timer `INACTIVITY_HOURS` out. No-op when reminders are off.
 */
export async function bumpInactivityNudge(profile: Profile): Promise<void> {
  await cancelKinds('nudge');
  if (!profile.reminders_enabled) return;
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Still hydrating? 💧',
      body: "You haven't logged a drink in a while — a quick sip counts.",
      data: { kind: 'nudge' satisfies NotifKind },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: INACTIVITY_HOURS * 3600,
      repeats: false,
    },
  });
}

/**
 * Fire a one-off celebration when the daily goal is reached. The richer
 * celebration is in-app (Home); this is the out-of-app pat on the back. Best
 * effort — silently ignored if permission isn't granted.
 */
export async function celebrateGoalMet(): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Goal reached! 🎉',
      body: "You hit your hydration goal today. Nice work.",
      data: { kind: 'celebration' satisfies NotifKind },
    },
    trigger: null, // present immediately
  });
}

/** Cancel everything we scheduled — used on data/account deletion. */
export async function cancelAllReminders(): Promise<void> {
  await cancelKinds('reminder', 'nudge');
}
