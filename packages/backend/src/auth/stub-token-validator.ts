import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenValidator } from './token-validator';
import { CurrentUser } from './current-user.type';

/**
 * Dev/test stub activated by AUTH_MODE=stub.
 * The guard reads the X-Dev-User request header and passes its value as rawToken.
 * NEVER active in production — Zod superRefine enforces NODE_ENV≠production + AUTH_MODE=stub.
 * D-06 (Phase 4): stub-prefixed entraId ensures stub identity is distinguishable in logs.
 */
@Injectable()
export class StubTokenValidator extends TokenValidator {
  async validate(rawToken: string): Promise<CurrentUser> {
    const email = rawToken?.trim() ?? '';
    if (!email) {
      throw new UnauthorizedException('AUTH.STUB_MISSING_DEV_USER_HEADER');
    }
    return {
      entraId: `stub-${email}`,
      email,
      tenantId: 'stub-tenant',
      displayName: null,
    };
  }
}
