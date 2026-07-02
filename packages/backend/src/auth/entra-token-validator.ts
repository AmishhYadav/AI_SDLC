import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/app-config.service';
import { TokenValidator } from './token-validator';
import { CurrentUser } from './current-user.type';

/**
 * Validates Entra ID v2.0 access tokens using JWKS key retrieval and RS256 signature verification.
 * AUTH-01 (Phase 4): Real token validation path; active when AUTH_MODE=entra.
 *
 * T-04-02: algorithms whitelist prevents alg:none and HS256 confusion attacks.
 * T-04-04: issuer + audience validation rejects cross-tenant and cross-audience tokens.
 * T-04-05: raw token, public key, and payload are never logged.
 */
@Injectable()
export class EntraTokenValidator extends TokenValidator {
  private readonly client: JwksClient;

  constructor(private readonly config: AppConfigService) {
    super();
    this.client = new JwksClient({
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes — safely below Microsoft's rotation window
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://login.microsoftonline.com/${this.config.get('ENTRA_TENANT_ID')}/discovery/v2.0/keys`,
    });
  }

  async validate(rawToken: string): Promise<CurrentUser> {
    // Step 1: decode header to extract kid — no signature verification yet
    const decoded = jwt.decode(rawToken, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedException('AUTH.INVALID_TOKEN_FORMAT');
    }
    if (!decoded.header.kid) {
      throw new UnauthorizedException('AUTH.INVALID_TOKEN_FORMAT');
    }

    // Step 2: fetch the RSA public key for this token's kid from the JWKS endpoint
    let publicKey: string;
    try {
      const key = await this.client.getSigningKey(decoded.header.kid);
      publicKey = key.getPublicKey();
    } catch {
      throw new UnauthorizedException('AUTH.KEY_NOT_FOUND');
    }

    // Step 3: verify signature and standard claims (exp, nbf, iss, aud)
    // SECURITY (T-04-02): algorithms whitelist rejects alg:none and confusion attacks
    let payload: Record<string, unknown>;
    try {
      payload = jwt.verify(rawToken, publicKey, {
        issuer: `https://login.microsoftonline.com/${this.config.get('ENTRA_TENANT_ID')}/v2.0`,
        audience: this.config.get('ENTRA_AUDIENCE'),
        algorithms: ['RS256'],
      }) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('AUTH.TOKEN_INVALID');
    }

    // Step 4: map Entra v2.0 claims to CurrentUser
    // D-03: preferred_username is the v2.0 email claim; upn is v1.0-only and absent here.
    // email is an optional claim requiring explicit configuration in App Registration.
    const entraId = payload['oid'] as string | undefined;
    const email = (payload['preferred_username'] ?? payload['email']) as string | undefined;
    const tenantId = payload['tid'] as string | undefined;

    if (!entraId || !email || !tenantId) {
      throw new UnauthorizedException('AUTH.MISSING_REQUIRED_CLAIMS');
    }

    const expectedTenantId = this.config.get('ENTRA_TENANT_ID');
    if (tenantId !== expectedTenantId) {
      throw new UnauthorizedException('AUTH.TOKEN_INVALID');
    }

    return {
      entraId,
      email,
      tenantId,
      displayName: (payload['name'] as string | undefined) ?? null,
    };
  }
}
