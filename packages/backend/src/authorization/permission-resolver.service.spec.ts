import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionResolverService } from './permission-resolver.service';

// ── Mock dependencies ──────────────────────────────────────────────────────
const mockPrisma = { user: { findFirst: vi.fn() } };
const mockCls = { get: vi.fn(), set: vi.fn() };

describe('PermissionResolverService', () => {
  let service: PermissionResolverService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermissionResolverService(mockPrisma as never, mockCls as never);
  });

  it('happy path — findFirst returns a user with rolePermissions → resolve returns a Set containing the permission codes', async () => {
    mockCls.get.mockReturnValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue({
      userRoles: [
        {
          role: {
            rolePermissions: [{ permission: { code: 'organization:read' } }],
          },
        },
      ],
    });

    const result = await service.resolve('known@x.com');

    expect(result).toBeInstanceOf(Set);
    expect(result.has('organization:read')).toBe(true);
  });
});
