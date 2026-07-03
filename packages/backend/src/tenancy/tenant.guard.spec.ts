import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.type';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { IS_NO_TENANT_SCOPE_KEY } from './decorators/no-tenant-scope.decorator';
import { TenantGuard } from './tenant.guard';

// ── Mock dependencies ──────────────────────────────────────────────────────
const mockReflector = { getAllAndOverride: vi.fn() };
const mockPrisma = { organizationMember: { findFirst: vi.fn() } };
const mockCls = { get: vi.fn(), set: vi.fn() };

// ── Mock context factory ───────────────────────────────────────────────────
function buildMockContext(
  user?: CurrentUser,
  headers: Record<string, string | string[] | undefined> = {},
): {
  mockContext: ExecutionContext;
  mockRequest: { user?: CurrentUser; headers: Record<string, string | string[] | undefined> };
} {
  const mockRequest = { user, headers };
  const mockContext = {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { mockContext, mockRequest };
}

// ── Helper: configure reflector mock per metadata key ─────────────────────
// mockImplementation (not mockReturnValueOnce) keeps tests immune to queue
// accumulation when vi.clearAllMocks() doesn't reset the once-queue.
function setupReflector(isPublic: boolean, isNoTenantScope: boolean): void {
  mockReflector.getAllAndOverride.mockImplementation((key: string) => {
    if (key === IS_PUBLIC_KEY) return isPublic;
    if (key === IS_NO_TENANT_SCOPE_KEY) return isNoTenantScope;
    return undefined;
  });
}

const MOCK_USER: CurrentUser = { entraId: 'eid', email: 'user@test.com', tenantId: 'tid' };
const MOCK_ORG_ID = 'org-001';
const MOCK_MEMBER = { id: 'member-001', userId: 'user-001' };

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new TenantGuard(mockReflector as never, mockPrisma as never, mockCls as never);
  });

  it('@Public() metadata true → returns true immediately; prisma NOT called', async () => {
    setupReflector(true, false);
    const { mockContext } = buildMockContext();

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockPrisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('@NoTenantScope() metadata true → returns true immediately; prisma NOT called', async () => {
    setupReflector(false, true);
    const { mockContext } = buildMockContext();

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockPrisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('request.user undefined → throws ForbiddenException with TENANT.NO_ORG_CONTEXT', async () => {
    setupReflector(false, false);
    const { mockContext } = buildMockContext(undefined, { 'x-organization-id': MOCK_ORG_ID });

    const error = await guard.canActivate(mockContext).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
    expect(response['errorCode']).toBe('TENANT.NO_ORG_CONTEXT');
    expect(mockPrisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('missing X-Organization-Id header → throws ForbiddenException with TENANT.MISSING_ORG_HEADER', async () => {
    setupReflector(false, false);
    const { mockContext } = buildMockContext(MOCK_USER, {}); // no header

    const error = await guard.canActivate(mockContext).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
    expect(response['errorCode']).toBe('TENANT.MISSING_ORG_HEADER');
    expect(mockPrisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('non-ACTIVE membership (findFirst returns null) → throws ForbiddenException with TENANT.ORG_ACCESS_DENIED', async () => {
    setupReflector(false, false);
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    const { mockContext } = buildMockContext(MOCK_USER, { 'x-organization-id': MOCK_ORG_ID });

    const error = await guard.canActivate(mockContext).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
    expect(response['errorCode']).toBe('TENANT.ORG_ACCESS_DENIED');
  });

  it('ACTIVE membership found → returns true; cls.set called with organizationId, organizationMemberId, userId', async () => {
    setupReflector(false, false);
    mockPrisma.organizationMember.findFirst.mockResolvedValue(MOCK_MEMBER);
    const { mockContext } = buildMockContext(MOCK_USER, { 'x-organization-id': MOCK_ORG_ID });

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockCls.set).toHaveBeenCalledWith('organizationId', MOCK_ORG_ID);
    expect(mockCls.set).toHaveBeenCalledWith('organizationMemberId', MOCK_MEMBER.id);
    expect(mockCls.set).toHaveBeenCalledWith('userId', MOCK_MEMBER.userId);
    expect(mockCls.set).toHaveBeenCalledTimes(3);
  });

  it('array X-Organization-Id header → takes first value only; second value ignored (T-06-08)', async () => {
    setupReflector(false, false);
    mockPrisma.organizationMember.findFirst.mockResolvedValue(MOCK_MEMBER);
    const { mockContext } = buildMockContext(MOCK_USER, {
      'x-organization-id': ['org-1', 'org-2'],
    });

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    // cls.set must use only the first array element as organizationId
    expect(mockCls.set).toHaveBeenCalledWith('organizationId', 'org-1');
    // prisma lookup must also use first element only
    const callArgs = mockPrisma.organizationMember.findFirst.mock.calls[0]![0] as {
      where: { organizationId: string };
    };
    expect(callArgs.where.organizationId).toBe('org-1');
  });
});
