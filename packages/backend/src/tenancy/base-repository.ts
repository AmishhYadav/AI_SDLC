import { ClsService } from 'nestjs-cls';
import { TenantedPrismaService } from './tenanted-prisma.service';

/**
 * Abstract base for org-scoped domain repositories backed by TenantedPrismaService.
 *
 * Subclasses access the auto-scoped Prisma client via `this.scopedPrisma.client`.
 * The $extends query hook in TenantedPrismaService automatically injects
 * `{ organizationId, deletedAt: null }` into every eligible operation.
 *
 * IMPORTANT: Subclasses MUST use `scopedPrisma.client.<model>.findFirst` (never
 * `findUnique`) for org-scoped lookups. Injecting `organizationId` into a
 * `findUnique.where` violates Prisma's unique-constraint type requirements.
 *
 * For re-add upsert operations, use raw PrismaService injected separately —
 * the extension's where injection conflicts with upsert's unique-key argument
 * (RESEARCH A3).
 */
export abstract class BaseRepository {
  constructor(
    protected readonly scopedPrisma: TenantedPrismaService,
    protected readonly cls: ClsService,
  ) {}

  /**
   * Returns soft-delete metadata for use in update `data` objects.
   * Reads `userId` from the current request's CLS context (set by TenantGuard).
   */
  protected getSoftDeleteData(): { deletedAt: Date; deletedBy: string | null } {
    return {
      deletedAt: new Date(),
      deletedBy: this.cls.get<string>('userId') ?? null,
    };
  }
}
