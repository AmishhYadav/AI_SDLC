import { Injectable } from '@nestjs/common';
import { OrganizationMember, PrismaService } from '@repo/database';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '../../tenancy/base-repository';
import { TenantedPrismaService } from '../../tenancy/tenanted-prisma.service';

/**
 * Repository for OrganizationMember.
 *
 * - findManyByOrg / findById use TenantedPrismaService.client so the $extends
 *   hook auto-injects organizationId + deletedAt:null.
 * - upsertMember uses raw PrismaService to avoid the extension's where-injection
 *   conflicting with upsert's unique-key argument (RESEARCH A3).
 */
@Injectable()
export class MemberRepository extends BaseRepository {
  constructor(
    scopedPrisma: TenantedPrismaService,
    cls: ClsService,
    private readonly prisma: PrismaService,
  ) {
    super(scopedPrisma, cls);
  }

  findManyByOrg(): Promise<OrganizationMember[]> {
    return this.scopedPrisma.client.organizationMember.findMany();
  }

  findById(id: string): Promise<OrganizationMember | null> {
    return this.scopedPrisma.client.organizationMember.findFirst({ where: { id } });
  }

  /**
   * Upserts a member row by the unique (organizationId, userId) constraint.
   *
   * Uses raw PrismaService (not scopedPrisma.client) to avoid the extension
   * injecting organizationId into the upsert.where unique-key clause (RESEARCH A3).
   *
   * On create: status=ACTIVE, joinedAt=now().
   * On update (re-add of removed member): reactivate with status=ACTIVE, deletedAt=null.
   *
   * Audit columns record `actorUserId` (the member performing the add), NOT
   * `userId` (the member being added). (CLAUDE.md §14, D-16)
   */
  upsertMember(
    organizationId: string,
    userId: string,
    actorUserId: string,
  ): Promise<OrganizationMember> {
    return this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: {
        organizationId,
        userId,
        status: 'ACTIVE',
        joinedAt: new Date(),
        createdBy: actorUserId,
      },
      update: {
        status: 'ACTIVE',
        deletedAt: null,
        joinedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }
}
