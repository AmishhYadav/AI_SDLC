import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { StubTokenValidator } from './stub-token-validator';

describe('StubTokenValidator', () => {
  const validator = new StubTokenValidator();

  it('returns stub CurrentUser for a valid email rawToken', async () => {
    const user = await validator.validate('user@example.com');

    expect(user.entraId).toBe('stub-user@example.com');
    expect(user.email).toBe('user@example.com');
    expect(user.tenantId).toBe('stub-tenant');
    expect(user.displayName).toBeNull();
  });

  it('trims surrounding whitespace from rawToken', async () => {
    const user = await validator.validate('  user@example.com  ');

    expect(user.email).toBe('user@example.com');
    expect(user.entraId).toBe('stub-user@example.com');
  });

  it('empty rawToken throws AUTH.STUB_MISSING_DEV_USER_HEADER', async () => {
    await expect(validator.validate('')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(validator.validate('')).rejects.toThrow('AUTH.STUB_MISSING_DEV_USER_HEADER');
  });

  it('whitespace-only rawToken throws AUTH.STUB_MISSING_DEV_USER_HEADER', async () => {
    await expect(validator.validate('   ')).rejects.toThrow('AUTH.STUB_MISSING_DEV_USER_HEADER');
  });

  it('undefined rawToken (falsy) throws AUTH.STUB_MISSING_DEV_USER_HEADER', async () => {
    // Guard passes X-Dev-User header value as rawToken; missing header → undefined → falsy check
    await expect(
      validator.validate(undefined as unknown as string),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      validator.validate(undefined as unknown as string),
    ).rejects.toThrow('AUTH.STUB_MISSING_DEV_USER_HEADER');
  });
});
