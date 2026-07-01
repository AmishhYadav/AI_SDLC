import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  it('Test 1: coerces PORT string to number and parses valid env', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://x',
      PORT: '3000',
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:3001',
    });
    expect(result).toEqual({
      DATABASE_URL: 'postgresql://x',
      PORT: 3000,
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:3001',
      LOG_LEVEL: 'info',
      THROTTLER_TTL_SECONDS: 60,
      THROTTLER_LIMIT: 100,
    });
  });

  it('Test 2: defaults PORT to 3000 when omitted', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://x',
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:3001',
    });
    expect(result.PORT).toBe(3000);
  });

  it('Test 3: throws ZodError when DATABASE_URL is missing', () => {
    expect(() =>
      envSchema.parse({ PORT: '3000', NODE_ENV: 'test' }),
    ).toThrow();
  });

  it('Test 4: throws ZodError when PORT is 0 (below min(1))', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: 'postgresql://x',
        PORT: '0',
        NODE_ENV: 'test',
        CORS_ORIGINS: 'http://localhost:3001',
      }),
    ).toThrow();
  });

  it('Test 5: throws ZodError when PORT is not coercible to a number', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: 'postgresql://x',
        PORT: 'abc',
        NODE_ENV: 'test',
        CORS_ORIGINS: 'http://localhost:3001',
      }),
    ).toThrow();
  });

  it('Test 6: throws ZodError when DATABASE_URL is an empty string', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: '',
        PORT: '3000',
        NODE_ENV: 'test',
        CORS_ORIGINS: 'http://localhost:3001',
      }),
    ).toThrow();
  });

  it('Test 7: parses valid env with CORS_ORIGINS and defaults LOG_LEVEL, THROTTLER values', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://a:b@localhost/db',
      CORS_ORIGINS: 'http://localhost:3001',
    });
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.THROTTLER_TTL_SECONDS).toBe(60);
    expect(result.THROTTLER_LIMIT).toBe(100);
  });

  it('Test 8: throws ZodError when CORS_ORIGINS is missing (no default)', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: 'postgresql://x',
        NODE_ENV: 'test',
      }),
    ).toThrow();
  });

  it('Test 9: throws ZodError when LOG_LEVEL is not in allowed enum', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: 'postgresql://x',
        CORS_ORIGINS: 'http://localhost:3001',
        LOG_LEVEL: 'invalid',
      }),
    ).toThrow();
  });

  it('Test 10: coerces THROTTLER_TTL_SECONDS string to number', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://x',
      CORS_ORIGINS: 'http://localhost:3001',
      THROTTLER_TTL_SECONDS: '30',
    });
    expect(result.THROTTLER_TTL_SECONDS).toBe(30);
  });
});
