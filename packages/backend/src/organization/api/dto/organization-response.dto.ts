import { Organization } from '@repo/database';

/**
 * API response shape for an Organization.
 *
 * Explicit allowlist of client-safe fields — maps from the Prisma entity via
 * `from()` so internal audit columns (updatedBy, deletedAt, deletedBy) never
 * cross the API boundary (CLAUDE.md §11).
 */
export class OrganizationResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: string;
  createdAt!: Date;
  createdBy!: string | null;

  static from(org: Organization): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
      createdBy: org.createdBy,
    };
  }
}
