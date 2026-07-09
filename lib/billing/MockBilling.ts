import type { Billing, EntitlementListener } from './billing';
import type { SubscriptionOption } from './types';
import { FORCE_PAYWALL } from './config';

/**
 * In-memory billing for `mock` data-source mode. Needs no store connection, so
 * the app stays fully clickable for UI iteration (CLAUDE.md).
 *
 * By default the mock customer is already entitled, so the hard paywall is
 * bypassed — same spirit as mock mode being always "authenticated". Set
 * `EXPO_PUBLIC_FORCE_PAYWALL=1` to start unentitled and actually exercise the
 * paywall: a "purchase" (or "restore") flips the flag and notifies listeners,
 * so the gate swaps to the app exactly as it will in production.
 */

// Module-level so the flag + listeners survive across the singleton's lifetime.
let entitled = !FORCE_PAYWALL;
const listeners = new Set<EntitlementListener>();

function setEntitled(next: boolean): void {
  entitled = next;
  listeners.forEach((l) => l(entitled));
}

/** Dev toggle used by the Dev screen to fake entitlement on/off. */
export function setMockEntitled(next: boolean): void {
  setEntitled(next);
}
export function getMockEntitled(): boolean {
  return entitled;
}

const MOCK_OPTIONS: SubscriptionOption[] = [
  {
    id: '$rc_annual',
    title: 'Yearly',
    priceString: '$39.99',
    period: 'year',
    perWeekString: '$0.77',
    perWeek: 0.77,
    trialDays: 7,
    raw: 'mock:annual',
  },
  {
    id: '$rc_monthly',
    title: 'Monthly',
    priceString: '$6.99',
    period: 'month',
    perWeekString: '$1.61',
    perWeek: 1.61,
    trialDays: 7,
    raw: 'mock:monthly',
  },
];

export class MockBilling implements Billing {
  configure(): void {}
  async logIn(): Promise<void> {}
  async logOut(): Promise<void> {
    // Sign-out returns an anonymous, unentitled customer (unless bypassed).
    setEntitled(!FORCE_PAYWALL ? true : false);
  }
  async getEntitlement(): Promise<boolean> {
    return entitled;
  }
  async getOfferings(): Promise<SubscriptionOption[]> {
    return MOCK_OPTIONS;
  }
  async purchase(): Promise<boolean> {
    // Simulate a brief store round-trip, then unlock.
    await new Promise((r) => setTimeout(r, 600));
    setEntitled(true);
    return true;
  }
  async restore(): Promise<boolean> {
    return entitled;
  }
  addEntitlementListener(listener: EntitlementListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
}
