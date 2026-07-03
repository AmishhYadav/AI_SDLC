import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationMember, Prisma, PrismaService } from '@repo/database';
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

    const actorUserId = this.ctx.getUserId()!;
    return this.memberRepo.upsertMember(organizationId, user.id, actorUserId);
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
   * The last-ACTIVE-member count check and the soft-delete run inside a single
   * Serializable transaction (D-15). Without this, two concurrent removals on a
   * 2-member org could both observe activeCount=2, both pass the guard, and both
   * delete — leaving zero active members (TOCTOU). Serializable isolation forces
   * one of the racing transactions to abort.
   *
   * The delete is a scoped updateMany (id + organizationId + deletedAt:null) so
   * the raw transaction client — which does not run the $extends org filter —
   * still cannot cross tenant boundaries. Sets status=REMOVED + deletedAt +
   * deletedBy. (D-14)
   */
  async removeMember(id: string, memberId: string): Promise<void> {
    const organizationId = this.assertPathMatchesContext(id);
    const actorUserId = this.ctx.getUserId() ?? null;

    await this.prisma.$transaction(
      async (tx) => {
        const activeCount = await tx.organizationMember.count({
          where: { organizationId, status: 'ACTIVE', deletedAt: null },
        });
        if (activeCount <= 1) {
          throw new ForbiddenException({
            errorCode: TENANT_ERROR_CODES.LAST_MEMBER_REMOVAL,
            message: 'Cannot remove the last active member of an organization.',
          });
        }

        await tx.organizationMember.updateMany({
          where: { id: memberId, organizationId, deletedAt: null },
          data: { status: 'REMOVED', deletedAt: new Date(), deletedBy: actorUserId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
