import { describe, it, expect } from 'vitest';

describe('workspace sanity', () => {
  it('resolves @repo/database barrel export', async () => {
    const database = await import('@repo/database');
    expect(database).toBeDefined();
  });
});
