import type { SubscriptionOption } from './types';

/** Fired with the latest entitlement whenever CustomerInfo changes. */
export type EntitlementListener = (entitled: boolean) => void;

/**
 * The single billing contract the app codes against (mirrors `DataRepository`).
 * Screens/hooks depend on THIS; the concrete impl is chosen by env in
 * `lib/billing/index.ts` — `RevenueCatBilling` for the real store, `MockBilling`
 * for fast, offline UI iteration. Swapping billing = change the provider, not
 * the screens.
 */
export interface Billing {
  /** One-time SDK setup at startup. Safe to call repeatedly; no-op if unkeyed. */
  configure(): void;

  /** Identify the customer by our stable user id (the Supabase auth uid), so
   * entitlements follow the account across devices and reinstalls. */
  logIn(userId: string): Promise<void>;
  /** Return to an anonymous customer on sign-out. */
  logOut(): Promise<void>;

  /** Current premium entitlement for the active customer. */
  getEntitlement(): Promise<boolean>;

  /** The plans to render on the paywall (from the current/selected offering). */
  getOfferings(): Promise<SubscriptionOption[]>;

  /**
   * Buy a plan. Resolves with the post-purchase entitlement.
   * @throws PurchaseCancelledError if the user dismisses the store sheet.
   */
  purchase(option: SubscriptionOption): Promise<boolean>;

  /** Restore prior purchases; resolves with the resulting entitlement. */
  restore(): Promise<boolean>;

  /** Subscribe to entitlement changes (e.g. a purchase completing). Returns an
   * unsubscribe fn. */
  addEntitlementListener(listener: EntitlementListener): () => void;
}
