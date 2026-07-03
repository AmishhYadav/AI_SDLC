import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@repo/database';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { IS_NO_TENANT_SCOPE_KEY } from './decorators/no-tenant-scope.decorator';
import { TENANT_ERROR_CODES } from './tenancy-error-codes';
import { CurrentUser } from '../auth/current-user.type';

/**
 * Global tenant guard — registered as APP_GUARD after PermissionsGuard (D-04, TENANT-01).
 *
 * Decision order:
 *   1. @Public() → allow (no principal; org scoping inapplicable)
 *   2. @NoTenantScope() → allow (cross-org routes: create org, list my orgs)
 *   3. Missing request.user → deny 403 TENANT.NO_ORG_CONTEXT (wrong guard order; fail-closed)
 *   4. Missing X-Organization-Id header → deny 403 TENANT.MISSING_ORG_HEADER
 *   5. Non-ACTIVE / missing OrganizationMember → deny 403 TENANT.ORG_ACCESS_DENIED
 *      (D-02: same code for "org not found" and "not a member" — no org-existence oracle)
 *   6. ACTIVE membership found → populate CLS with organizationId, organizationMemberId,
 *      userId and return true.
 *
 * CRITICAL: Uses raw PrismaService — NOT TenantedPrismaService.
 * TenantGuard is the entity that POPULATES the CLS context that TenantedPrismaService reads.
 * Using the scoped client here creates a circular deadlock (Pitfall 4, D-08).
 *
 * T-06-05: X-Organization-Id header is untrusted input validated against a real DB row.
 * T-06-06: D-02 — same error code for "org not found" and "not a member."
 * T-06-08: Array header → takes first value only (header injection guard).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() at class or method level — no principal to scope
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. @NoTenantScope() — cross-org routes that explicitly opt out of tenant scoping
    const isNoTenantScope = this.reflector.getAllAndOverride<boolean>(IS_NO_TENANT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isNoTenantScope) return true;

    // 3. Fail-closed: missing principal means JwtAuthGuard has not run or guard order is wrong
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: CurrentUser;
    }>();
    if (!request.user) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT,
        message: 'Authentication required for tenant-scoped access.',
      });
    }

    // 4. T-06-08: Array.isArray guard prevents header injection via multi-value headers
    const rawHeader = request.headers['x-organization-id'];
    const organizationId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!organizationId) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.MISSING_ORG_HEADER,
        message: 'X-Organization-Id header is required.',
      });
    }

    // 5. Validate ACTIVE membership using RAW PrismaService (never TenantedPrismaService)
    //    D-02: same TENANT.ORG_ACCESS_DENIED for "org not found" and "user not a member"
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        user: { email: request.user.email, deletedAt: null },
      },
      select: { id: true, userId: true },
    });
    if (!member) {
      throw new ForbiddenException({
        errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
        message: 'Access denied. Verify your organization membership.',
      });
    }

    // 6. Populate CLS atomically — all three keys in sequence with no early returns
    this.cls.set('organizationId', organizationId);
    this.cls.set('organizationMemberId', member.id);
    this.cls.set('userId', member.userId);

    return true;
  }
}
