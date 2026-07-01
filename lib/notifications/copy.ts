/**
 * Notification copy engine — the "voice" of Hydro AI's reminders.
 *
 * Persona: an indignant, deeply-invested 7-year-old who has appointed themself
 * in charge of your hydration. Cute + dramatic: they poured the glass already,
 * they're watching, and they WILL be disappointed if you don't drink it. This
 * is where all the personality lives; the scheduling layer (`../notifications`)
 * just asks for a line and delivers it.
 *
 * Because reminders are device-local and scheduled ahead of time, the copy is
 * frozen when scheduled — so day-state (`NotifState`) is a best-effort snapshot
 * from the last app foreground/log, not live. Templates that need a field
 * gracefully opt out (return null) when it's missing, so a cold cache just
 * yields the generic, always-safe lines.
 */

import type { Profile } from '../data/types';

export type NotifKind = 'reminder' | 'nudge' | 'streak_danger' | 'celebration';

/** Best-effort day-state the copy can weave in. All optional. */
export interface NotifState {
  /** Consecutive goal-met days (from `computeStreaks`). */
  streak?: number;
  /** ml left to hit today's goal (0 once met). */
  remaining_ml?: number;
  goal_ml?: number;
}

/** Everything a template function reads. */
interface Ctx extends NotifState {
  /** First name, already extracted; null when unknown. */
  name: string | null;
  /** Delivery hour (0–23) — drives time-of-day flavor. */
  hour: number;
}

/** A template returns its line, or null to opt out for this context. */
type Template = (c: Ctx) => string | null;

/** First name only, or null if the profile has no usable name. */
export function firstName(displayName: string | null | undefined): string | null {
  const n = displayName?.trim().split(/\s+/)[0];
  return n && n.length > 0 ? n : null;
}

/** Vocative that reads fine with or without a name ("Hieu" / "hey"). */
const who = (c: Ctx) => c.name ?? 'hey';

/** "This close" range — small enough that "one more glass" is honest. */
const almostDone = (c: Ctx) => c.remaining_ml != null && c.remaining_ml > 0 && c.remaining_ml <= 350;
/** Behind, but not almost done. */
const behind = (c: Ctx) => c.remaining_ml != null && c.remaining_ml > 350;

const TEMPLATES: Record<NotifKind, Template[]> = {
  // Scheduled daytime nudges. Bossy, adorable, escalating.
  reminder: [
    (c) => `${who(c)}. I poured it already. With ICE. Are you gonna drink it or NOT 😤`,
    (c) => `You said "in a minute" like an hour ago. I'm watching you 👀💧`,
    (c) => `HELLO this is your water talking. ${cap(who(c))} said you'd drink me. 🥤`,
    (c) => `I made it the good temperature. Don't waste my effort. Sip. Now. 😠`,
    (c) => (c.hour < 11 ? `Good morning! Rule #1 of today: water. I don't make the rules. (I do.) ☀️💧` : null),
    (c) => (c.hour >= 18 ? `It's basically night and you've been ignoring your water ALL day 😾 fix it` : null),
    (c) => (behind(c) ? `${cap(who(c))} you are BEHIND on water and I am telling on you 💧` : null),
    (c) => (almostDone(c) ? `You're SO close. Literally one glass. Do it for me?? 🥹` : null),
  ],
  // "Haven't logged in a while" one-shot. Needy, wounded, guilt-lite.
  nudge: [
    (c) => `Your water is getting warm and sad and it misses you 🥺`,
    (c) => `${cap(who(c))}?? Helloooo?? It's been FOREVER. Drink something 😩`,
    (c) => `I've been holding this glass this WHOLE time. My arms hurt. Please. 💧`,
    (c) => `You forgot about me AND the water. I'm not crying, YOU'RE crying 😢`,
    (c) => (behind(c) ? `You're way behind today and I'm getting nervous. Big sip? 🥤` : null),
  ],
  // Evening streak-saver. Maximum drama — this is the loss-aversion lever.
  streak_danger: [
    (c) =>
      c.streak && c.streak > 0
        ? `🚨 Our ${c.streak}-day water streak ENDS at midnight and it'll be YOUR fault 😭 drink!!`
        : null,
    (c) =>
      c.streak && c.streak > 0
        ? `${cap(who(c))}. ${c.streak} days. DO NOT ruin this now. One more glass. GO 🏃💧`
        : `Don't break the streak, ${who(c)}! Midnight is coming for it 😱`,
    (c) =>
      c.streak && c.streak >= 3
        ? `${c.streak} whole days!! I made a chart!! Don't make me erase it 😤💧`
        : null,
    (c) => (almostDone(c) ? `SO close to saving the streak. One glass. I'll love you forever 🥹` : null),
  ],
  // Goal reached. Grudging, over-the-top pride.
  celebration: [
    (c) => `FINE. You drank it all. I'm proud of you. Don't tell anyone I said that 😌`,
    (c) => `YOU DID IT ${cap(who(c))}!!! 🎉 I never doubted you (I did, a little) 💧`,
    (c) =>
      c.streak && c.streak >= 3
        ? `${c.streak} DAYS IN A ROW?! You're basically a plant now. A hydrated one 🌱🎉`
        : null,
    (c) => `Goal: destroyed. Water: consumed. Me: emotional. Great job 🥹`,
  ],
};

/** Short bold titles per kind (the notification headline). */
const TITLES: Record<NotifKind, string[]> = {
  reminder: ['💧 Ahem.', 'Excuse me!', 'Water time.'],
  nudge: ['Helloooo?? 💧', "I'm waiting…", 'Psst.'],
  streak_danger: ['🚨 EMERGENCY 🚨', "Don't you DARE", 'Streak in danger!'],
  celebration: ['YAY! 🎉', 'Okay… good job.', '🏆'],
};

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const cap = (s: string) => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Compose one notification for `kind` in the given context. `exclude` (bodies
 * already chosen in the same batch) is avoided so a day's reminders don't repeat
 * — falls back to the full pool if everything's excluded.
 */
export function composeNotification(
  kind: NotifKind,
  profile: Pick<Profile, 'display_name'> | null,
  state: NotifState = {},
  opts: { hour?: number; exclude?: Set<string> } = {},
): { title: string; body: string } {
  const ctx: Ctx = {
    ...state,
    name: firstName(profile?.display_name),
    hour: opts.hour ?? new Date().getHours(),
  };

  const pool = TEMPLATES[kind].map((fn) => fn(ctx)).filter((s): s is string => !!s);
  const exclude = opts.exclude;
  const fresh = exclude ? pool.filter((s) => !exclude.has(s)) : pool;
  const body = pick(fresh.length ? fresh : pool);
  exclude?.add(body);

  return { title: pick(TITLES[kind]), body };
}
