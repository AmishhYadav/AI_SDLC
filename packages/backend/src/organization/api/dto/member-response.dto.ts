import { OrganizationMember } from '@repo/database';

/**
 * API response shape for an OrganizationMember.
 *
 * Explicit allowlist of client-safe fields — maps from the Prisma entity via
 * `from()` so internal audit columns (createdBy, updatedBy, deletedAt,
 * deletedBy) never cross the API boundary (CLAUDE.md §11).
 */
export class MemberResponseDto {
  id!: string;
  organizationId!: string;
  userId!: string;
  status!: string;
  joinedAt!: Date | null;
  createdAt!: Date;

  static from(member: OrganizationMember): MemberResponseDto {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      status: member.status,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    };
  }
}
