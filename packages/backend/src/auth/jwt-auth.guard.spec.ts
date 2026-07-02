import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from './current-user.type';
import { JwtAuthGuard } from './jwt-auth.guard';

// ── Mock dependencies ──────────────────────────────────────────────────────
// All four guard constructor dependencies mocked with vi.fn() so we can assert
// call counts and control return values per-test.

const mockTokenValidator = { validate: vi.fn() };
const mockReflector = { getAllAndOverride: vi.fn() };
const mockConfig = { get: vi.fn() };
const mockCls = { set: vi.fn() };

// ── Mock context factory ───────────────────────────────────────────────────
// Returns both the ExecutionContext mock and the underlying request object so
// tests can inspect request.user after canActivate resolves.

function buildMockContext(headers: Record<string, string | undefined>): {
  mockContext: ExecutionContext;
  mockRequest: { headers: Record<string, string | string[] | undefined>; user?: CurrentUser };
} {
  const mockRequest: { headers: Record<string, string | string[] | undefined>; user?: CurrentUser } = {
    headers: headers as Record<string, string | string[] | undefined>,
    user: undefined,
  };
  const mockContext = {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { mockContext, mockRequest };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new JwtAuthGuard(
      mockTokenValidator as never,
      mockReflector as never,
      mockConfig as never,
      mockCls as never,
    );
  });

  it('@Public() metadata set → returns true immediately without calling tokenValidator (D-07 bypass)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const { mockContext } = buildMockContext({});

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockTokenValidator.validate).not.toHaveBeenCalled();
  });

  it('Authorization header absent in entra mode → throws AUTH.MISSING_TOKEN', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockConfig.get.mockReturnValue('entra');
    const { mockContext } = buildMockContext({}); // no Authorization header

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow('AUTH.MISSING_TOKEN');
  });

  it('x-dev-user header absent in stub mode → throws AUTH.MISSING_TOKEN', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockConfig.get.mockReturnValue('stub');
    const { mockContext } = buildMockContext({}); // no x-dev-user header

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow('AUTH.MISSING_TOKEN');
  });

  it('x-dev-user header present in stub mode → canActivate returns true; request.user and cls.set populated', async () => {
    const mockUser: CurrentUser = {
      entraId: 'stub-user@test.com',
      email: 'user@test.com',
      tenantId: 'stub-tenant',
      displayName: null,
    };
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockConfig.get.mockReturnValue('stub');
    mockTokenValidator.validate.mockResolvedValue(mockUser);

    const { mockContext, mockRequest } = buildMockContext({ 'x-dev-user': 'user@test.com' });

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockTokenValidator.validate).toHaveBeenCalledWith('user@test.com');
    expect(mockRequest.user).toEqual(mockUser);
    expect(mockCls.set).toHaveBeenCalledWith('user', mockUser);
  });
});
