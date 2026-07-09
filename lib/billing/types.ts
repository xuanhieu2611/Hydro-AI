/**
 * Billing types the app codes against — the paywall and gate depend on THESE,
 * never on `react-native-purchases` directly (same net rule as the data layer:
 * a screen importing the RevenueCat SDK is a bug). `RevenueCatBilling` maps the
 * SDK's `PurchasesPackage`/`CustomerInfo` onto these; `MockBilling` fabricates
 * them so mock mode needs no store connection.
 */

/** Whether the current customer has the premium entitlement. */
export type EntitlementStatus = 'loading' | 'entitled' | 'unentitled';

export type BillingPeriod = 'year' | 'month' | 'week' | 'unknown';

/** One purchasable plan shown on the paywall. */
export interface SubscriptionOption {
  /** Stable package id, e.g. `$rc_annual` / `$rc_monthly`. */
  id: string;
  /** Human label, e.g. "Yearly". */
  title: string;
  /** Localized price for one billing period, e.g. "$39.99". */
  priceString: string;
  /** The billing cadence. */
  period: BillingPeriod;
  /**
   * Localized price divided down to a per-week figure for cross-plan compares,
   * e.g. "$0.77/wk" on the yearly plan. Null when it can't be derived.
   */
  perWeekString: string | null;
  /** The same per-week figure as a raw number, for computing "save X%". */
  perWeek: number | null;
  /** Free-trial length in days if the plan has a zero-price intro offer. */
  trialDays: number | null;
  /**
   * Opaque handle passed straight back to `Billing.purchase()`. Holds the raw
   * `PurchasesPackage` for RevenueCat (or a marker string for the mock) so
   * callers never touch the SDK type. Do not read this outside the impl.
   */
  raw: unknown;
}
