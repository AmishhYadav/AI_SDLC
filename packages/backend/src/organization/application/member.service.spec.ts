import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberService } from './member.service';

// ── Mock dependencies ─────────────────────────────────────────────────────────
const mockMemberRepo = {
  findManyByOrg: vi.fn(),
  upsertMember: vi.fn(),
  softDelete: vi.fn(),
  findById: vi.fn(),
};

const mockPrisma = {
  user: { findFirst: vi.fn() },
  organizationMember: { count: vi.fn() },
};

const mockCtx = {
  getOrganizationId: vi.fn().mockReturnValue('org-123'),
  getUserId: vi.fn().mockReturnValue('caller-user-id'),
  getOrganizationMemberId: vi.fn(),
};

describe('MemberService', () => {
  let service: MemberService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm ctx mock after clearAllMocks wipes implementations
    mockCtx.getOrganizationId.mockReturnValue('org-123');
    service = new MemberService(mockMemberRepo as never, mockPrisma as never, mockCtx as never);
  });

  // ── Test 1: addMember — USER_NOT_FOUND when user does not exist ──────────────
  it('addMember — user not found → throws NotFoundException with USER_NOT_FOUND; upsertMember never called', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(service.addMember('org-123', 'nonexistent@test.com')).rejects.toMatchObject({
      response: { errorCode: expect.stringContaining('USER_NOT_FOUND') },
    });
    expect(mockMemberRepo.upsertMember).not.toHaveBeenCalled();
  });

  // ── Test 2: addMember — re-add reactivation via upsert ──────────────────────
  it('addMember — existing user found → upsertMember called with (orgId, userId); confirms upsert path not create', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mockMemberRepo.upsertMember.mockResolvedValue({ id: 'member-1', userId: 'user-1', status: 'ACTIVE' });

    await service.addMember('org-123', 'existing@test.com');

    expect(mockMemberRepo.upsertMember).toHaveBeenCalledWith('org-123', 'user-1');
  });

  // ── Test 3: removeMember — LAST_MEMBER_REMOVAL guardrail (D-15) ─────────────
  it('removeMember — active member count is 1 → throws ForbiddenException with LAST_MEMBER_REMOVAL; softDelete never called', async () => {
    mockPrisma.organizationMember.count.mockResolvedValue(1);

    await expect(service.removeMember('org-123', 'member-1')).rejects.toMatchObject({
      response: { errorCode: expect.stringContaining('LAST_MEMBER_REMOVAL') },
    });
    expect(mockMemberRepo.softDelete).not.toHaveBeenCalled();
  });

  // ── Test 4: removeMember — happy path (count > 1) ───────────────────────────
  it('removeMember — active member count is 2 → softDelete called with memberId; no exception', async () => {
    mockPrisma.organizationMember.count.mockResolvedValue(2);

    await service.removeMember('org-123', 'member-1');

    expect(mockMemberRepo.softDelete).toHaveBeenCalledWith('member-1');
  });

  // ── Test 5: listMembers — delegates to scoped repository ────────────────────
  it('listMembers — calls findManyByOrg and returns its result', async () => {
    const fakeMembers = [{ id: 'm1' }, { id: 'm2' }];
    mockMemberRepo.findManyByOrg.mockResolvedValue(fakeMembers);

    const result = await service.listMembers('org-123');

    expect(result).toEqual(fakeMembers);
    expect(mockMemberRepo.findManyByOrg).toHaveBeenCalled();
  });

  // ── Test 6: path/header consistency (WR-02) ─────────────────────────────────
  it('addMember — path id differs from CLS organizationId → throws ForbiddenException with ORG_ACCESS_DENIED; user never looked up', async () => {
    await expect(service.addMember('org-OTHER', 'existing@test.com')).rejects.toMatchObject({
      response: { errorCode: expect.stringContaining('ORG_ACCESS_DENIED') },
    });
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});
