import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, PrismaService } from '@repo/database';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TENANT_ERROR_CODES } from '../../tenancy/tenancy-error-codes';
import { CreateOrganizationDto } from '../api/dto/create-organization.dto';
import { OrganizationRepository } from '../persistence/organization.repository';

/**
 * Business logic for Organization CRUD.
 *
 * createOrganization and listMyOrgs run on @NoTenantScope routes (Plan 06-04)
 * where CLS has no userId. Identity is resolved from the authenticated email
 * (the service — not the controller — owns this lookup per CLAUDE.md §6).
 *
 * findById enforces IDOR prevention: the path id must match the CLS organizationId.
 */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  /**
   * Creates an organization and records the creator as an ACTIVE member atomically.
   *
   * Resolves the platform User by email (raw PrismaService, deletedAt:null).
   * Throws USER_NOT_FOUND if absent — the @NoTenantScope route has no CLS userId
   * so identity comes from the authenticated email.
   *
   * Uses $transaction with the raw tx client — $extends does not propagate into
   * interactive transactions (RESEARCH A2), so the tx is naturally unscoped. (D-10)
   */
  async createOrganization(creatorEmail: string, dto: CreateOrganizationDto): Promise<Organization> {
    const user = await this.prisma.user.findFirst({
      where: { email: creatorEmail, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: TENANT_ERROR_CODES.USER_NOT_FOUND,
        message: 'No user found for the authenticated account.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name, slug: dto.slug, createdBy: user.id },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
          createdBy: user.id,
        },
      });
      return org;
    });
  }

  /**
   * Lists all organizations the authenticated user is an ACTIVE member of.
   * Unscoped by design — called from a @NoTenantScope route (D-12).
   */
  async listMyOrgs(creatorEmail: string): Promise<Organization[]> {
    const user = await this.prisma.user.findFirst({
      where: { email: creatorEmail, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: TENANT_ERROR_CODES.USER_NOT_FOUND,
        message: 'No user found for the authenticated account.',
      });
    }
    return this.orgRepo.findByMemberUserId(user.id);
  }

  /**
   * Reads one organization by id, validating against the CLS organizationId.
   *
   * Throws ORG_ACCESS_DENIED if the path id does not match the request's active
   * organization — prevents IDOR via mismatched X-Organization-Id / path param. (T-06-12)
   */
  async findById(id: string): Promise<Organization> {
    const ctxOrgId = this.ctx.getOrganizationId();
    if (id !== ctxOrgId) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
        message: 'Access denied.',
      });
    }
    const org = await this.orgRepo.findById(id);
    if (!org) {
      throw new NotFoundException({
        errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
        message: 'Organization not found.',
      });
    }
    return org;
  }
}
