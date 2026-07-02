import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { REQUIRE_PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import { AUTHZ_ERROR_CODES } from './authorization-error-codes';
import { PermissionResolverService } from './permission-resolver.service';
import { CurrentUser } from '../auth/current-user.type';

/**
 * Global authorization guard — registered as APP_GUARD after JwtAuthGuard (D-05, RBAC-03).
 *
 * Decision order:
 *   1. @Public() → allow (no principal to authorize)
 *   2. No @RequirePermissions metadata → allow (route is auth-gated but not permission-gated)
 *   3. request.user undefined → deny 403 (fail-closed; wrong guard order or missing principal)
 *   4. AND-match resolved Set against required codes → allow or deny 403
 *
 * RBAC-04 / D-06: authorization derives solely from the resolved permission Set, never
 * from the fact that authentication succeeded. A valid token with no required permissions
 * produces 403, not 401.
 *
 * D-03 / T-05-09: exact-code membership only — no role-name bypass, no hierarchy.
 * D-54 / T-05-10: deny message is a fixed generic constant; missing codes, roles, and IDs
 * are never included in the response body.
 * D-09 / T-05-11: no AUTH_MODE/stub branch — stub identities resolve permissions from the
 * DB identically to real principals.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() at class or method level bypasses RBAC — no principal to authorize
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. No @RequirePermissions decorator → route is auth-gated only (D-05)
    const requiredCodes = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredCodes || requiredCodes.length === 0) return true;

    // 3. Fail-closed: no principal means no authorization possible
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    if (!request.user) {
      throw new ForbiddenException({
        errorCode: AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        message: 'You do not have permission to perform this action.',
      });
    }

    // 4. AND-match: every required code must be in the resolved permission Set (D-02, D-03)
    const effective = await this.resolver.resolve(request.user.email);
    if (requiredCodes.every((code) => effective.has(code))) {
      return true;
    }

    // D-54: fixed generic message; never names the missing permission/role/ID
    throw new ForbiddenException({
      errorCode: AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      message: 'You do not have permission to perform this action.',
    });
  }
}
