/**
 * Connection-invite deep links. A code is handed to a partner/family/friend
 * (native Share sheet or typed by hand); opening the link routes to
 * `app/invite/[code].tsx`, which redeems it. `Linking.createURL` uses the app
 * scheme (`hydroai://`, see app.json) and the right host in dev/Expo Go.
 */
import * as Linking from 'expo-linking';

/**
 * Public App Store listing. Used in the share message so friends without the
 * app can install it. (The `hydroai://` deep link is paused until a real
 * website / universal link exists — it doesn't resolve from Messages/social.)
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6785374266';

/** Deep-link URL for an invite `code`, e.g. `hydroai:///invite/AB12CD34`. */
export function inviteUrl(code: string): string {
  return Linking.createURL(`/invite/${code}`);
}

/**
 * Full message for the Share sheet. The code sits on its own line (so it's
 * easy to read/select) and we point friends to the App Store to install —
 * they join by typing the code into "Enter a code".
 */
export function inviteMessage(code: string): string {
  return (
    `Join my circle on Hydro AI 💧\n\n` +
    `My code: ${code}\n\n` +
    `Get the app:\n${APP_STORE_URL}`
  );
}
