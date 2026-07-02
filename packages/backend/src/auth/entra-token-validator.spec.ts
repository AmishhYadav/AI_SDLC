import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';

// Generate a real RSA keypair once for all tests — PEM strings for full jwt.verify compatibility
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const TEST_KID = 'test-kid-1';
const TENANT_ID = 'test-tenant-id';
const CLIENT_ID = 'test-client-id';

// vi.hoisted: create mock functions in the hoisted execution context so they are available
// in the vi.mock factory below. vi.fn() does NOT work inside vi.mock factories directly.
const { mockGetSigningKey } = vi.hoisted(() => ({
  mockGetSigningKey: vi.fn(),
}));

// vi.mock factory can reference the hoisted mockGetSigningKey because vi.hoisted runs first.
// The JwksClient mock is a plain class (not vi.fn) — the constructor just wires getSigningKey.
vi.mock('jwks-rsa', () => ({
  JwksClient: class {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSigningKey: any;
    constructor() {
      this.getSigningKey = mockGetSigningKey;
    }
  },
}));

// Import subject AFTER mocks are registered so jwks-rsa is intercepted on load.
import { EntraTokenValidator } from './entra-token-validator';

const mockConfig = {
  get: vi.fn((key: string): string => {
    const cfg: Record<string, string> = {
      ENTRA_TENANT_ID: TENANT_ID,
      ENTRA_AUDIENCE: CLIENT_ID,
    };
    return cfg[key] ?? '';
  }),
};

/**
 * Signs a test RS256 token using the local private key.
 * Default claims include all required fields; individual tests override specific ones.
 * Passing undefined for a claim key causes JSON.stringify to omit it from the JWT payload.
 */
function signToken(
  claims: Record<string, unknown>,
  options: Partial<jwt.SignOptions> = {},
): string {
  const baseClaims = {
    oid: 'test-oid',
    tid: TENANT_ID,
    preferred_username: 'user@example.com',
    name: 'Test User',
  };
  const mergedClaims = Object.fromEntries(
    Object.entries({ ...baseClaims, ...claims }).filter(([, v]) => v !== undefined),
  );

  return jwt.sign(mergedClaims, privateKey, {
    algorithm: 'RS256',
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: CLIENT_ID,
    expiresIn: '1h',
    keyid: TEST_KID,
    ...options,
  });
}

describe('EntraTokenValidator', () => {
  let validator: EntraTokenValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getSigningKey resolves with the test public key
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => publicKey });
    validator = new EntraTokenValidator(mockConfig as never);
  });

  it('valid RS256 token with all claims returns correct CurrentUser', async () => {
    const token = signToken({});
    const user = await validator.validate(token);

    expect(user.entraId).toBe('test-oid');
    expect(user.email).toBe('user@example.com');
    expect(user.tenantId).toBe(TENANT_ID);
    expect(user.displayName).toBe('Test User');
  });

  it('preferred_username absent but email present uses email as fallback (D-03)', async () => {
    const token = signToken({ preferred_username: undefined, email: 'fallback@example.com' });
    const user = await validator.validate(token);

    expect(user.email).toBe('fallback@example.com');
  });

  it('token missing oid claim throws AUTH.MISSING_REQUIRED_CLAIMS', async () => {
    const token = signToken({ oid: undefined });

    await expect(validator.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(validator.validate(token)).rejects.toThrow('AUTH.MISSING_REQUIRED_CLAIMS');
  });

  it('expired token throws AUTH.TOKEN_INVALID', async () => {
    // Set exp 1 hour in the past; jwt.verify() raises TokenExpiredError which is caught → TOKEN_INVALID
    const expiredClaims = {
      oid: 'test-oid',
      tid: TENANT_ID,
      preferred_username: 'user@example.com',
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const token = jwt.sign(expiredClaims, privateKey, {
      algorithm: 'RS256',
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
      keyid: TEST_KID,
    });

    await expect(validator.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(validator.validate(token)).rejects.toThrow('AUTH.TOKEN_INVALID');
  });

  it('JwksClient.getSigningKey throwing gives AUTH.KEY_NOT_FOUND', async () => {
    mockGetSigningKey.mockRejectedValue(new Error('Signing key not found'));
    const token = signToken({});

    await expect(validator.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(validator.validate(token)).rejects.toThrow('AUTH.KEY_NOT_FOUND');
  });

  it('completely invalid (non-JWT) string throws UnauthorizedException', async () => {
    // jwt.decode('not-a-jwt') returns null → AUTH.INVALID_TOKEN_FORMAT
    await expect(validator.validate('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
