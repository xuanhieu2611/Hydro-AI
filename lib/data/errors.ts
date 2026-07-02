/**
 * Typed errors crossing the data boundary, so screens can branch on them
 * without sniffing strings. Thrown by the real (Supabase) implementations;
 * the mock layer never hits these paths.
 */

/**
 * The `analyze-image` Edge Function refused the request because the user hit
 * the per-user AI rate limit (cost guardrail). Carries the friendly message
 * from the server plus how long to wait.
 */
export class RateLimitError extends Error {
  readonly kind: 'minute' | 'day' | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    kind: 'minute' | 'day' | null,
    retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * The user dismissed a native sign-in dialog (Apple/Google). Not a failure —
 * the auth screen swallows it (no error Alert) and just stays put.
 */
export class AuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'AuthCancelledError';
  }
}

/**
 * Claiming a connection invite failed for a reason worth showing the user
 * (bad/expired code, already connected, or their own code). `reason` lets the
 * UI branch; `message` is a friendly line safe to surface in an Alert.
 */
export type InviteFailure =
  | 'not_found'
  | 'expired'
  | 'already_claimed'
  | 'already_connected'
  | 'self';

export class InviteError extends Error {
  readonly reason: InviteFailure;

  constructor(reason: InviteFailure, message: string) {
    super(message);
    this.name = 'InviteError';
    this.reason = reason;
  }
}
