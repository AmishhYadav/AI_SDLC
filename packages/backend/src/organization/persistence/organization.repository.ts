import { Injectable } from '@nestjs/common';
import { Organization, PrismaService } from '@repo/database';

/**
 * Repository for Organization root entity.
 *
 * Uses raw PrismaService exclusively — Organization has no organizationId FK
 * (it IS the root entity). The scoped client must never be used here:
 * the extension would fail-closed with NO_ORG_CONTEXT on unscoped routes.
 */
@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { name: string; slug: string; createdBy: string }): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  /**
   * Returns all active organizations the given user is an ACTIVE member of.
   * Unscoped by design — used in the @NoTenantScope "list my orgs" route (D-12).
   */
  findByMemberUserId(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: {
        members: { some: { userId, status: 'ACTIVE', deletedAt: null } },
        deletedAt: null,
      },
    });
  }
}
