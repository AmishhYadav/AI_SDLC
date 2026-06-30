import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  it('Test 1: coerces PORT string to number and parses valid env', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://x',
      PORT: '3000',
      NODE_ENV: 'test',
    });
    expect(result).toEqual({
      DATABASE_URL: 'postgresql://x',
      PORT: 3000,
      NODE_ENV: 'test',
    });
  });

  it('Test 2: defaults PORT to 3000 when omitted', () => {
    const result = envSchema.parse({
      DATABASE_URL: 'postgresql://x',
      NODE_ENV: 'test',
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
      }),
    ).toThrow();
  });

  it('Test 5: throws ZodError when PORT is not coercible to a number', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: 'postgresql://x',
        PORT: 'abc',
        NODE_ENV: 'test',
      }),
    ).toThrow();
  });

  it('Test 6: throws ZodError when DATABASE_URL is an empty string', () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: '',
        PORT: '3000',
        NODE_ENV: 'test',
      }),
    ).toThrow();
  });
});
