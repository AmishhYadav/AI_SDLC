import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from './organization.service';

// ── Mock dependencies ─────────────────────────────────────────────────────────
const mockOrgRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByMemberUserId: vi.fn(),
};

// mockTx is the fake Prisma transaction client passed to the $transaction callback
const mockTx = {
  organization: { create: vi.fn() },
  organizationMember: { create: vi.fn() },
};

const mockPrisma = {
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

const mockCtx = {
  getOrganizationId: vi.fn(),
  getUserId: vi.fn(),
  getOrganizationMemberId: vi.fn(),
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm $transaction after clearAllMocks wipes the implementation.
    // It invokes the callback with the mock transaction client and returns its result.
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx));
    service = new OrganizationService(mockOrgRepo as never, mockPrisma as never, mockCtx as never);
  });

  // ── Test 1: createOrganization — USER_NOT_FOUND when user does not exist ─────
  it('createOrganization — user.findFirst returns null → throws NotFoundException with USER_NOT_FOUND; $transaction never called', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.createOrganization('nobody@test.com', { name: 'X', slug: 'x' } as never),
    ).rejects.toMatchObject({
      response: { errorCode: expect.stringContaining('USER_NOT_FOUND') },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Test 2: createOrganization — atomic creator-as-ACTIVE-member (D-10) ──────
  it('createOrganization — user found → $transaction creates org; organizationMember.create called with status:ACTIVE and Date joinedAt', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mockTx.organization.create.mockResolvedValue({ id: 'org-1', name: 'X', slug: 'x' });

    const result = await service.createOrganization('creator@test.com', {
      name: 'X',
      slug: 'x',
    } as never);

    expect(result).toMatchObject({ id: 'org-1' });
    expect(mockTx.organizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', status: 'ACTIVE' }),
      }),
    );
    expect(mockTx.organizationMember.create.mock.calls[0]![0].data.joinedAt).toBeInstanceOf(Date);
  });

  // ── Test 3: findById — IDOR guard (T-06-12) ────────────────────────────────
  it('findById — id does not match CLS organizationId → throws ForbiddenException with ORG_ACCESS_DENIED; orgRepo.findById never called', async () => {
    mockCtx.getOrganizationId.mockReturnValue('org-123');

    await expect(service.findById('different-org')).rejects.toMatchObject({
      response: { errorCode: expect.stringContaining('ORG_ACCESS_DENIED') },
    });
    expect(mockOrgRepo.findById).not.toHaveBeenCalled();
  });

  // ── Test 4: findById — happy path ─────────────────────────────────────────
  it('findById — id matches CLS organizationId → returns org from repository', async () => {
    mockCtx.getOrganizationId.mockReturnValue('org-123');
    mockOrgRepo.findById.mockResolvedValue({ id: 'org-123' });

    const result = await service.findById('org-123');

    expect(result).toMatchObject({ id: 'org-123' });
  });
});
