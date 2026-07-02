import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt } from 'passport-jwt';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { TokenValidator } from './token-validator';
import { CurrentUser } from './current-user.type';
import { AppConfigService } from '../config/app-config.service';

/**
 * Global authentication guard — registered as APP_GUARD in AppModule (second, after ThrottlerGuard).
 * D-09 (Phase 4): ThrottlerGuard runs first to rate-limit unauthenticated brute-force attempts.
 * D-07: @Public() routes bypass this guard entirely, regardless of AUTH_MODE.
 * T-04-03: X-Dev-User header is ONLY read when AUTH_MODE=stub; ignored in entra mode.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenValidator: TokenValidator,
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // D-07: @Public() at class or method level bypasses all auth checks
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: CurrentUser;
    }>();

    // T-04-03: Token source branches on AUTH_MODE — stub mode reads X-Dev-User header only
    let rawToken: string | null | undefined;
    if (this.config.get('AUTH_MODE') === 'stub') {
      const devUser = request.headers['x-dev-user'];
      rawToken = Array.isArray(devUser) ? devUser[0] : devUser;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request as any);
    }

    if (!rawToken) {
      throw new UnauthorizedException('AUTH.MISSING_TOKEN');
    }

    // Do NOT catch — UnauthorizedException propagates to GlobalExceptionFilter (D-09 note: guard never swallows auth errors)
    const currentUser = await this.tokenValidator.validate(rawToken);

    request.user = currentUser;
    this.cls.set('user', currentUser);

    return true;
  }
}
