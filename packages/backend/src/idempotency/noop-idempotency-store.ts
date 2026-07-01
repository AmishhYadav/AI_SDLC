import { Injectable } from '@nestjs/common';
import { IdempotencyStore } from './idempotency-store.interface';

/**
 * WARNING: In-memory, single-instance only. Safe for single-replica local/test deployments only.
 * Replace with a Redis-backed implementation when persistent idempotency is required (D-09).
 */
@Injectable()
export class NoOpIdempotencyStore extends IdempotencyStore {
  private readonly store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
