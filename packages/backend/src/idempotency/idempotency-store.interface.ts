/** The HTTP header name for the idempotency key. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Abstract class used as NestJS DI token (not interface — interfaces are erased at runtime).
 * D-09: Seam contract exists now; enforcement interceptor wired in a future phase.
 */
export abstract class IdempotencyStore {
  abstract get(key: string): Promise<unknown | undefined>;
  abstract set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}
