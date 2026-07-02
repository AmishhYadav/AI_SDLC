import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionResolverService, PERMISSIONS_CLS_KEY } from './permission-resolver.service';

// ── Mock dependencies ──────────────────────────────────────────────────────
// PrismaService and ClsService are mocked with vi.fn() so we can assert call
// counts, control return values per-test, and avoid any real DB or CLS wiring.

const mockPrisma = { user: { findFirst: vi.fn() } };
const mockCls = { get: vi.fn(), set: vi.fn() };

// ── Helper: a user shape with one active role containing the given codes ───
function makeUserWithCodes(codes: string[]) {
  return {
    userRoles: [
      {
        role: {
          rolePermissions: codes.map((code) => ({ permission: { code } })),
        },
      },
    ],
  };
}

describe('PermissionResolverService', () => {
  let service: PermissionResolverService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermissionResolverService(mockPrisma as never, mockCls as never);
  });

  // ── (a) Happy path ───────────────────────────────────────────────────────
  it('happy path — findFirst returns a user with rolePermissions → resolve returns a Set containing all codes and cls.set is called', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue(
      makeUserWithCodes(['organization:read', 'project:manage']),
    );

    const result = await service.resolve('dev@example.com');

    expect(result).toBeInstanceOf(Set);
    expect(result.has('organization:read')).toBe(true);
    expect(result.has('project:manage')).toBe(true);
    expect(mockCls.set).toHaveBeenCalledWith(PERMISSIONS_CLS_KEY, result);
  });

  // ── (b) Fail-closed: unknown user ────────────────────────────────────────
  it('fail-closed — findFirst returns null (unknown user) → empty Set, no throw, findFirst called exactly once', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await service.resolve('unknown@example.com');

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1);
    // cls.set must still be called with the empty Set to memoize the fail-closed result
    expect(mockCls.set).toHaveBeenCalledWith(PERMISSIONS_CLS_KEY, result);
  });

  // ── (c) Empty roles ──────────────────────────────────────────────────────
  it('empty roles — user exists but userRoles is empty → empty Set (no active memberships)', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue({ userRoles: [] });

    const result = await service.resolve('noroles@example.com');

    expect(result.size).toBe(0);
  });

  // ── (d) CLS memoization ──────────────────────────────────────────────────
  it('memoization — cls.get returns a pre-seeded Set → resolve returns it and findFirst is NOT called (D-08)', async () => {
    const preSeeded = new Set(['organization:read']);
    mockCls.get.mockReturnValue(preSeeded);

    const result = await service.resolve('cached@example.com');

    expect(result).toBe(preSeeded);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockCls.set).not.toHaveBeenCalled();
  });

  // ── (e) Query argument shape ─────────────────────────────────────────────
  it('query args — findFirst where-clause includes email, User.deletedAt: null, userRole deleted/expired filters, and NO organizationId', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue({ userRoles: [] });

    await service.resolve('filter-check@example.com');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1);

    // noUncheckedIndexedAccess: use non-null assertion since toHaveBeenCalledTimes(1) guarantees the call exists
    const callArg = mockPrisma.user.findFirst.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      select: { userRoles: { where: Record<string, unknown> } };
    };

    // User-level filters
    expect(callArg.where['email']).toBe('filter-check@example.com');
    expect(callArg.where['deletedAt']).toBeNull();

    // UserRole-level filters (D-07)
    const urWhere = callArg.select.userRoles.where as {
      deletedAt: unknown;
      OR: Array<{ expiresAt: unknown }>;
    };
    expect(urWhere.deletedAt).toBeNull();
    expect(Array.isArray(urWhere.OR)).toBe(true);

    // One branch: expiresAt null (no expiry); other: expiresAt gt some Date
    const expiresAtNullBranch = urWhere.OR.find((b) => b.expiresAt === null);
    const expiresAtGtBranch = urWhere.OR.find(
      (b) => b.expiresAt !== null && b.expiresAt !== undefined,
    );
    expect(expiresAtNullBranch).toBeDefined();
    expect(expiresAtGtBranch).toBeDefined();

    // No organizationId filter anywhere in the top-level where (D-01)
    expect(callArg.where).not.toHaveProperty('organizationId');
  });

  // ── (f) Soft-deleted user — D-04 least-privilege ─────────────────────────
  it('soft-deleted user — findFirst returns null (query excludes deletedAt != null users) → empty Set, proving deactivated principal cannot authorize', async () => {
    mockCls.get.mockReturnValue(undefined);
    // findFirst returns null because the query filters `deletedAt: null` at the User level,
    // so a soft-deleted User (deletedAt set) is indistinguishable from an unknown user (D-04).
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await service.resolve('deleted@example.com');

    expect(result.size).toBe(0);

    // Verify the query carries the User-level deletedAt: null filter (D-04, CLAUDE.md §11)
    const callArg = mockPrisma.user.findFirst.mock.calls[0]![0] as {
      where: { deletedAt: unknown };
    };
    expect(callArg.where.deletedAt).toBeNull();
  });

  // ── Multi-role union across memberships ──────────────────────────────────
  it('union — user has two active roles each with different codes → Set contains all codes (org-agnostic union, D-01)', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue({
      userRoles: [
        {
          role: {
            rolePermissions: [{ permission: { code: 'organization:read' } }],
          },
        },
        {
          role: {
            rolePermissions: [
              { permission: { code: 'project:manage' } },
              { permission: { code: 'repository:read' } },
            ],
          },
        },
      ],
    });

    const result = await service.resolve('multirole@example.com');

    expect(result.size).toBe(3);
    expect(result.has('organization:read')).toBe(true);
    expect(result.has('project:manage')).toBe(true);
    expect(result.has('repository:read')).toBe(true);
  });
});
