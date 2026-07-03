import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationMember, PrismaService } from '@repo/database';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TENANT_ERROR_CODES } from '../../tenancy/tenancy-error-codes';
import { MemberRepository } from '../persistence/member.repository';

/**
 * Business logic for OrganizationMember CRUD.
 *
 * addMember resolves the target User from their email (raw PrismaService, deletedAt:null)
 * and delegates to MemberRepository.upsertMember — handles both new-add and re-add
 * reactivation transparently. No JIT User creation (D-13).
 *
 * removeMember enforces the last-ACTIVE-member guardrail (D-15) before soft-deleting.
 */
@Injectable()
export class MemberService {
  constructor(
    private readonly memberRepo: MemberRepository,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  /**
   * Adds an existing User as an ACTIVE member of the current organization.
   *
   * Upsert handles re-add: if the user was previously removed, the existing row
   * is reactivated (status=ACTIVE, deletedAt=null, joinedAt=now()). (D-14)
   *
   * Throws USER_NOT_FOUND if no User row exists with the given email — never
   * creates a User row on-the-fly. (D-13)
   */
  async addMember(id: string, email: string): Promise<OrganizationMember> {
    const organizationId = this.assertPathMatchesContext(id);

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: TENANT_ERROR_CODES.USER_NOT_FOUND,
        message: 'No user found with that email address.',
      });
    }

    return this.memberRepo.upsertMember(organizationId, user.id);
  }

  /**
   * Lists all active members of the current organization.
   * The $extends hook auto-injects organizationId + deletedAt:null filtering.
   */
  listMembers(id: string): Promise<OrganizationMember[]> {
    this.assertPathMatchesContext(id);
    return this.memberRepo.findManyByOrg();
  }

  /**
   * Soft-deletes a member from the current organization.
   *
   * Counts ACTIVE members first and blocks removal if count <= 1. (D-15)
   * Sets status=REMOVED + deletedAt + deletedBy via MemberRepository.softDelete. (D-14)
   */
  async removeMember(id: string, memberId: string): Promise<void> {
    const organizationId = this.assertPathMatchesContext(id);

    const activeCount = await this.prisma.organizationMember.count({
      where: { organizationId, status: 'ACTIVE', deletedAt: null },
    });
    if (activeCount <= 1) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.LAST_MEMBER_REMOVAL,
        message: 'Cannot remove the last active member of an organization.',
      });
    }

    await this.memberRepo.softDelete(memberId);
  }

  /**
   * Enforces path/header consistency: the `:id` path param must match the
   * active CLS organizationId set by TenantGuard. Prevents a client from
   * targeting one org in the URL while operating on another via the
   * X-Organization-Id header (mirrors OrganizationService.findById). (T-06-12)
   *
   * Returns the validated organizationId so callers avoid a redundant CLS read.
   */
  private assertPathMatchesContext(id: string): string {
    const organizationId = this.ctx.getOrganizationId();
    if (id !== organizationId) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
        message: 'Access denied.',
      });
    }
    return organizationId;
  }
}
