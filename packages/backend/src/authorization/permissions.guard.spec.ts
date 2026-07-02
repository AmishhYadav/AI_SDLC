import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.type';
import { PermissionsGuard } from './permissions.guard';

// ── Mock dependencies ──────────────────────────────────────────────────────
const mockReflector = { getAllAndOverride: vi.fn() };
const mockResolver = { resolve: vi.fn() };

// ── Mock context factory ───────────────────────────────────────────────────
function buildMockContext(user?: CurrentUser): {
  mockContext: ExecutionContext;
  mockRequest: { user?: CurrentUser };
} {
  const mockRequest: { user?: CurrentUser } = { user };
  const mockContext = {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { mockContext, mockRequest };
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new PermissionsGuard(mockReflector as never, mockResolver as never);
  });

  it('@Public() metadata true → returns true immediately; resolver NOT called (D-05)', async () => {
    // isPublic = true, requiredCodes = undefined
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(true) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined); // REQUIRE_PERMISSIONS_KEY (never reached)
    const { mockContext } = buildMockContext();

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockResolver.resolve).not.toHaveBeenCalled();
  });

  it('No @RequirePermissions metadata (undefined) → returns true; resolver NOT called (D-05)', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined); // REQUIRE_PERMISSIONS_KEY — no decorator
    const { mockContext } = buildMockContext({ entraId: 'id', email: 'u@test.com', tenantId: 't' });

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockResolver.resolve).not.toHaveBeenCalled();
  });

  it('Empty required codes array → returns true; resolver NOT called (D-05)', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce([]); // REQUIRE_PERMISSIONS_KEY — empty
    const { mockContext } = buildMockContext({ entraId: 'id', email: 'u@test.com', tenantId: 't' });

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockResolver.resolve).not.toHaveBeenCalled();
  });

  it('request.user undefined → throws ForbiddenException; resolver NOT called (fail-closed D-04)', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['projects.read']); // REQUIRE_PERMISSIONS_KEY
    const { mockContext } = buildMockContext(undefined); // no user

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockResolver.resolve).not.toHaveBeenCalled();
  });

  it('Principal has all required codes → returns true (D-02 AND)', async () => {
    const user: CurrentUser = { entraId: 'id', email: 'u@test.com', tenantId: 't' };
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['projects.read', 'projects.write']); // REQUIRE_PERMISSIONS_KEY
    mockResolver.resolve.mockResolvedValue(new Set(['projects.read', 'projects.write', 'admin.read']));
    const { mockContext } = buildMockContext(user);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockResolver.resolve).toHaveBeenCalledWith('u@test.com');
  });

  it('Principal missing one of two required codes → throws ForbiddenException with AUTHZ.PERMISSION_DENIED (D-02 AND, D-06 403, D-54)', async () => {
    const user: CurrentUser = { entraId: 'id', email: 'u@test.com', tenantId: 't' };
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['projects.read', 'projects.write']); // REQUIRE_PERMISSIONS_KEY
    mockResolver.resolve.mockResolvedValue(new Set(['projects.read'])); // missing projects.write
    const { mockContext } = buildMockContext(user);

    const error = await guard.canActivate(mockContext).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
    expect(response.errorCode).toBe('AUTHZ.PERMISSION_DENIED');
    expect(response.message).toBe('You do not have permission to perform this action.');
    // D-54: message must not leak the missing code or role name
    expect(JSON.stringify(response)).not.toContain('projects.write');
  });

  it('Principal has zero permissions → throws ForbiddenException (fail-closed)', async () => {
    const user: CurrentUser = { entraId: 'id', email: 'u@test.com', tenantId: 't' };
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(['admin.access']); // REQUIRE_PERMISSIONS_KEY
    mockResolver.resolve.mockResolvedValue(new Set<string>()); // empty
    const { mockContext } = buildMockContext(user);

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
