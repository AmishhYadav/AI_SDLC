import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@repo/database';
import { PrismaService } from '@repo/database';
import { ClsService } from 'nestjs-cls';
import { TENANT_ERROR_CODES } from './tenancy-error-codes';

/**
 * Org-owned models with a direct organizationId FK (camelCase Prisma model names).
 * 'organization' is intentionally absent — Organization has no organizationId FK;
 * it IS the root entity.
 *
 * ⚠️ FAIL-OPEN ON OMISSION — MAINTENANCE-CRITICAL (WR-05):
 * Scoping (and the D-08 fail-closed guard) is applied ONLY to models listed here.
 * A model that has an `organizationId` column but is absent from this set is NOT
 * scoped: the extension passes its queries through unmodified, yielding a
 * full-table cross-tenant read/write with no error. This is a deliberate
 * allowlist (ADR-001) — the schema declares many org-owned models for future
 * phases that are not yet reachable through any repository, and scoping them
 * eagerly is out of scope for this phase.
 *
 * INVARIANT: before a new org-owned model becomes reachable via the scoped
 * client (i.e. a repository extends BaseRepository and queries it), its
 * camelCase name MUST be added here. Adding a model to the schema without
 * adding it here silently disables tenant isolation for that model.
 *
 * A CI guardrail that cross-checks every `organizationId`-bearing model against
 * this set (or an explicit UNSCOPED opt-out list) is the durable fix and is
 * tracked as follow-up; it is intentionally deferred because a naive
 * completeness assertion would fail today against the many not-yet-wired models.
 */
const ORG_SCOPED_MODELS = new Set([
  'organizationMember',
  'project',
  'projectMember',
  'team',
  'repository',
  'role',
  'permission',
]);

/**
 * Operations with no `where` arg — skip injection entirely.
 * (Prisma type system forbids a `where` clause on these operations.)
 */
const NO_WHERE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * Operations to skip for findUnique type safety.
 * Prisma enforces that findUnique.where contains only unique-constraint fields.
 * BaseRepository MUST use findFirst/findFirstOrThrow for all org-scoped lookups.
 */
const UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow']);

/**
 * Wraps PrismaService with a $extends query hook that auto-injects
 * `{ organizationId, deletedAt: null }` into eligible operations on org-owned models.
 *
 * D-08 fail-closed: when a scoped-model query is attempted with no organizationId
 * in CLS (i.e., TenantGuard has not run), throws ForbiddenException with
 * TENANT.NO_ORG_CONTEXT — never a silent full-table read.
 *
 * A reference to ClsService is captured in a closure (as `clsRef`) and read at
 * query execution time (not at service construction time), so the singleton
 * service correctly reads the per-request organizationId from AsyncLocalStorage
 * on every query.
 */
@Injectable()
export class TenantedPrismaService {
  readonly client: PrismaClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    // Capture cls reference before entering the $extends closure.
    // Using `clsRef` (not `cls`) avoids an OXC/SWC identifier-redeclaration error
    // since `cls` is already declared as the constructor parameter in this scope.
    // Inside $allOperations, `this` refers to the extension object (not the service),
    // so the captured reference is required for per-request CLS reads.
    const clsRef = this.cls;

    this.client = prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({
            model,
            operation,
            args,
            query,
          }: {
            model: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) {
            if (
              ORG_SCOPED_MODELS.has(model) &&
              !NO_WHERE_OPERATIONS.has(operation) &&
              !UNIQUE_OPERATIONS.has(operation)
            ) {
              const orgId = clsRef.get<string>('organizationId');

              if (orgId === undefined || orgId === null) {
                // D-08 fail-closed: no active org context on a scoped model operation
                throw new ForbiddenException({
                  errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT,
                  message: 'No active organization context.',
                });
              }

              const a = args as { where?: Record<string, unknown> };
              a.where = { ...(a.where ?? {}), organizationId: orgId, deletedAt: null };
            }

            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
}
