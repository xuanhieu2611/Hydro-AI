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
