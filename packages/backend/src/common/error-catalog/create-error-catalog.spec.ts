import { describe, it, expect } from 'vitest';
import { createErrorCatalog } from './create-error-catalog';

describe('createErrorCatalog', () => {
  it('Test A: produces PREFIX.CODE entries for multiple codes', () => {
    const catalog = createErrorCatalog('AUTH', ['INVALID_TOKEN', 'EXPIRED_TOKEN'] as const);
    expect(catalog).toEqual({
      INVALID_TOKEN: 'AUTH.INVALID_TOKEN',
      EXPIRED_TOKEN: 'AUTH.EXPIRED_TOKEN',
    });
  });

  it('Test B: works with PLATFORM prefix and single code', () => {
    const catalog = createErrorCatalog('PLATFORM', ['NOT_FOUND'] as const);
    expect(catalog).toEqual({ NOT_FOUND: 'PLATFORM.NOT_FOUND' });
  });

  it('Test C: returns empty object for empty codes array', () => {
    const catalog = createErrorCatalog('X', [] as const);
    expect(catalog).toEqual({});
  });
});
