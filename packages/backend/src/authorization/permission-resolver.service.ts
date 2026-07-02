import { Injectable } from '@nestjs/common';
import { PrismaService } from '@repo/database';
import { ClsService } from 'nestjs-cls';

/**
 * CLS key for the per-request memoized effective permission set (D-08).
 * A single clearly-named constant prevents magic-string duplication.
 */
export const PERMISSIONS_CLS_KEY = 'effectivePermissions';

/**
 * Resolves a principal's effective `Set<string>` of permission codes.
 *
 * RBAC-02: Issues a single indexed query keyed on the unique `User.email` and
 * memoizes the result in the request-scoped CLS store so repeated permission
 * checks within one request incur no additional DB round-trips (D-08).
 *
 * Fail-closed (D-04): unknown users, soft-deleted users, and users with no
 * active roles all resolve to an empty Set — the service never throws on
 * absence and never writes to the database during authorization (T-05-05).
 *
 * Phase-6 seam (D-01): once tenant context is available, Phase 6 will apply
 * an `organizationId` filter on `userRoles` to narrow resolution to the active
 * organization. The parameter is declared here to mark that boundary clearly
 * without scattering TODOs. No org filter is applied this phase.
 */
@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Returns the union of permission codes across all active memberships for
   * the given principal email.
   *
   * @param email - Matched against `User.email` (@@unique index — single indexed round-trip).
   * @param organizationId - Phase-6 org-narrowing seam. Declared but NOT applied this phase.
   *   Phase 6 will filter `userRoles` by `organizationId` once tenant context exists.
   */
  async resolve(email: string, organizationId?: string): Promise<Set<string>> {
    // D-08: short-circuit on CLS-memoized Set — no second query within the same request
    const cached = this.cls.get<Set<string>>(PERMISSIONS_CLS_KEY);
    if (cached !== undefined) {
      return cached;
    }

    const now = new Date();

    // Single indexed query on the unique User.email (D-08, T-05-06).
    // findFirst (not findUnique) so the non-unique `deletedAt: null` filter can live
    // in the where-clause while still resolving via the unique email index.
    //
    // SECURITY (T-05-03, D-04): `deletedAt: null` on User enforces least-privilege —
    // a soft-deleted (deactivated) principal matches nothing and resolves to an empty
    // Set, identical to an unknown user. No DB writes occur during authorization (T-05-05).
    //
    // D-01: NO `organizationId` filter is applied; resolution is org-agnostic this phase.
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        userRoles: {
          // D-07: exclude soft-deleted and time-expired UserRole rows
          where: {
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            role: { deletedAt: null },
          },
          select: {
            role: {
              select: {
                rolePermissions: {
                  // D-07: exclude soft-deleted RolePermission and Permission rows
                  where: {
                    deletedAt: null,
                    permission: { deletedAt: null },
                  },
                  select: {
                    permission: {
                      select: { code: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // D-04 fail-closed: null user (unknown or soft-deleted) or no active roles ⇒ empty Set
    // No throw — the empty Set propagates upward and the guard returns 403.
    const resolved = new Set<string>(
      user?.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.code),
      ) ?? [],
    );

    // D-08: memoize for the duration of this request — no cross-request cache
    this.cls.set(PERMISSIONS_CLS_KEY, resolved);

    return resolved;

    // Suppress "unused variable" lint error: organizationId is intentionally declared
    // as the Phase-6 org-narrowing seam (D-01) but not applied this phase.
    void organizationId;
  }
}
