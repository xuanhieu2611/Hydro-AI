/**
 * Connection-invite deep links. A code is handed to a partner/family/friend
 * (native Share sheet or typed by hand); opening the link routes to
 * `app/invite/[code].tsx`, which redeems it. `Linking.createURL` uses the app
 * scheme (`hydroai://`, see app.json) and the right host in dev/Expo Go.
 */
import * as Linking from 'expo-linking';

/** Deep-link URL for an invite `code`, e.g. `hydroai:///invite/AB12CD34`. */
export function inviteUrl(code: string): string {
  return Linking.createURL(`/invite/${code}`);
}

/** Friendly one-liner for the Share sheet — the URL is appended by the caller. */
export function inviteMessage(code: string): string {
  return (
    `Let's keep each other hydrated 💧 Open this in Hydro AI to see my daily ` +
    `water progress (code ${code}):`
  );
}
