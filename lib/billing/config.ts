/**
 * Billing (RevenueCat) configuration, read from public env. Like the Supabase
 * URL + anon key, the RevenueCat *public* SDK key is safe to ship in the app —
 * it can only read offerings and make purchases scoped to the signed-in user.
 * The secret API key lives only in the RevenueCat dashboard, never here.
 *
 * See `docs/PAYMENTS_SETUP.md` for where each value comes from.
 */
export const billingConfig = {
  /** RevenueCat "Public SDK Key" for the Apple App Store (starts `appl_`). */
  iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  /** RevenueCat "Public SDK Key" for Google Play (starts `goog_`). */
  androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  /**
   * The entitlement identifier that unlocks the app. A customer is "premium"
   * iff this entitlement is active in their CustomerInfo. Configure it in
   * RevenueCat → Entitlements. Defaults to `premium`.
   */
  entitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? 'premium',
  /**
   * Which offering to show on the paywall. Empty → RevenueCat's *current*
   * offering (recommended: set the current offering in the dashboard so you can
   * swap plans without an app release).
   */
  offeringId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING ?? '',
} as const;

/**
 * Dev-only: force the paywall to show even in mock mode (which is otherwise
 * always entitled, so the app stays fully clickable for UI iteration). Pair
 * `EXPO_PUBLIC_DATA_SOURCE=mock` + `EXPO_PUBLIC_FORCE_PAYWALL=1` to iterate on
 * the paywall UI at zero cost — a "purchase" just flips the mock entitlement.
 */
export const FORCE_PAYWALL = process.env.EXPO_PUBLIC_FORCE_PAYWALL === '1';

/** Terms (EULA) + Privacy links the paywall must surface for App Review. */
export const legalUrls = {
  // Apple's standard EULA is an acceptable Terms of Use for auto-renewing subs.
  terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  privacy: 'https://hieule.ca/hydro-ai/privacy',
} as const;
