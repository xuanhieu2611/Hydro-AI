/**
 * Typed errors crossing the billing boundary, so the paywall can branch without
 * sniffing strings (mirrors `lib/data/errors`).
 */

/**
 * The user dismissed the native purchase sheet. Not a failure — the paywall
 * swallows it (no error Alert) and just stays put, like `AuthCancelledError`.
 */
export class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase was cancelled.');
    this.name = 'PurchaseCancelledError';
  }
}
