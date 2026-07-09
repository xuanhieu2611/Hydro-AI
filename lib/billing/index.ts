import type { Billing } from './billing';
import { dataSource } from '../data';
import { RevenueCatBilling } from './RevenueCatBilling';
import { MockBilling } from './MockBilling';

/**
 * Billing provider selector. Tied to the same `EXPO_PUBLIC_DATA_SOURCE` flag as
 * the data layer: `supabase` → real RevenueCat, anything else → the in-memory
 * mock (bypassed paywall by default; see MockBilling). Singleton so the mock's
 * entitlement flag + listeners are shared across the app session.
 */
export const billing: Billing =
  dataSource === 'supabase' ? new RevenueCatBilling() : new MockBilling();

export type { Billing, EntitlementListener } from './billing';
export type { SubscriptionOption, EntitlementStatus } from './types';
export { PurchaseCancelledError } from './errors';
export { legalUrls, FORCE_PAYWALL } from './config';
