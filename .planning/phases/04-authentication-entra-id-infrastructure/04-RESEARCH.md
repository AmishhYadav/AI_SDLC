# Phase 4: Authentication (Entra ID) Infrastructure — Research

**Researched:** 2026-07-01
**Domain:** NestJS 11 JWT authentication with Microsoft Entra ID JWKS validation
**Confidence:** HIGH (standard stack + Microsoft official docs verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `CurrentUser` carries JWT claims only — no DB hit per request. Shape: `{ entraId: string; email: string; tenantId: string; displayName?: string | null }`. `entraId` from `oid`, no DB write.
- **D-02:** `CurrentUser` includes no roles or permissions. Role/permission resolution is Phase 5.
- **D-03:** `tenantId` ← `tid`; `displayName` ← `name` (nullable); `email` ← `upn` or `email` claim. Additional claims ignored.
- **D-04:** Phase 4 performs zero DB writes. JIT User provisioning deferred to Phase 6+.
- **D-05:** Stub activated by `AUTH_MODE=stub`. Fail-fast on startup if `NODE_ENV=production` && `AUTH_MODE=stub`. Production value is `AUTH_MODE=entra`.
- **D-06:** When `AUTH_MODE=stub`, protected endpoints authenticate via `X-Dev-User` request header. Stub constructs `CurrentUser` with `entraId = 'stub-${email}'`, `tenantId = 'stub-tenant'`.
- **D-07:** `@Public()` endpoints bypass the guard entirely regardless of `AUTH_MODE`. `CurrentUser` is `null` in public handler parameters.
- **D-08:** Auth infrastructure lives in `src/auth/` — flat, standalone `AuthModule`. Separate from Phase 9's identity bounded context.
- **D-09:** `JwtAuthGuard` registered as global `APP_GUARD` in `AppModule`. Guard order: `ThrottlerGuard` (already registered) → `JwtAuthGuard`.
- **D-10:** Only health endpoints and Swagger UI (non-prod) are marked `@Public()` out of the box.

### Claude's Discretion

- Exact `@CurrentUser()` implementation: `createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().user)`.
- `TokenValidator` abstract class shape: `abstract validate(token: string): Promise<CurrentUser>`.
- JWKS key caching: `cache: true, cacheMaxEntries: 5, cacheMaxAge: 10 * 60 * 1000` (10 min). Verify against current docs at plan time.
- Entra token claim shape: verify `iss`, `aud`, `oid`, `tid`, `upn`/`email`, `name` against v2.0 docs. (Research has resolved this — see findings below.)

### Deferred Ideas (OUT OF SCOPE)

- JIT User provisioning — Phase 6+.
- Live Entra tenant E2E SSO verification — explicitly out of scope this milestone (RT-05).
- Authenticated Swagger in production — Phase 3 D-14 still deferred.
- `IAuditContextProvider` with `organizationId` — Phase 6.
- RBAC, `@RequirePermissions()`, `PermissionsGuard` — Phase 5.
- Tenant/actor context (organizationId) in ALS — Phase 6.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Protected endpoints require a valid Entra-issued JWT, validated via `passport-jwt` + `jwks-rsa` against the tenant JWKS | `jwks-rsa` v4.1.0 `JwksClient` + `jsonwebtoken.verify()` pattern with JWKS URI `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys` |
| AUTH-02 | Token validation sits behind a swappable `TokenValidator` interface with no dependency on deprecated `passport-azure-ad` | Abstract class DI seam pattern (same as `IAuditContextProvider`); `passport-azure-ad` deprecated August 2023 — confirmed not used |
| AUTH-03 | A `@Public()` decorator marks endpoints that bypass authentication | `SetMetadata('isPublic', true)` + `Reflector.getAllAndOverride` in guard |
| AUTH-04 | An authenticated principal (`CurrentUser`) is resolvable in handlers | `createParamDecorator` reading `request.user`, set by guard |
| AUTH-05 | A stub/dev token validator enables local development without a live Entra tenant | `StubTokenValidator` reads `X-Dev-User` header; activated by `AUTH_MODE=stub` |
</phase_requirements>

---

## Summary

Phase 4 implements a global JWT authentication guard for the NestJS 11 backend using Microsoft Entra ID as the identity provider. The design uses a `TokenValidator` abstract-class seam (the same DI pattern as `IAuditContextProvider` from Phase 3) so the guard never directly depends on JWKS validation details. The real validator uses `jwks-rsa` v4.1.0 for signing-key retrieval and `jsonwebtoken` for signature + claims verification. The stub validator reads an `X-Dev-User` header, activated by `AUTH_MODE=stub` env var with a Zod fail-fast refinement that prevents stub mode in production.

The most important finding that resolves the MEDIUM-confidence research flag in STATE.md: **`upn` is a v1.0-only claim and is NOT present in v2.0 access tokens.** For v2.0 tokens the email-equivalent claim is `preferred_username` (present when `profile` scope is requested). The `email` claim is an optional claim that must be explicitly configured in the API app registration. The `CurrentUser.email` mapping should be `preferred_username ?? email` (drop `upn` from the priority chain for v2.0 tokens). This is the authoritative correction to D-03.

Microsoft Entra ID v2.0 access tokens use a client-ID GUID as the `aud` claim (not `api://` URI), and the issuer for single-tenant apps is `https://login.microsoftonline.com/{tenantId}/v2.0`. All four auth packages (`@nestjs/passport`, `passport`, `passport-jwt`, `jwks-rsa`) passed slopcheck and are well-established libraries.

**Primary recommendation:** Implement `JwtAuthGuard` as a pure `CanActivate` (not `AuthGuard('jwt')`). Use `ExtractJwt.fromAuthHeaderAsBearerToken()` from `passport-jwt` for token extraction. Implement `EntraTokenValidator` using `jwks-rsa` `JwksClient` directly for key retrieval and `jsonwebtoken.verify()` for signature + claims validation. Register `PassportModule` in `AuthModule` imports for ecosystem consistency. This satisfies AUTH-01 ("passport-jwt + jwks-rsa") while keeping the guard logic simple and independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT extraction from request | API / Backend (Guard) | — | Server-side — must never trust client to pre-parse tokens |
| Token signature verification | API / Backend (TokenValidator) | — | Cryptographic verification belongs in the API tier; never in the browser |
| JWKS key retrieval + caching | API / Backend (EntraTokenValidator) | — | jwks-rsa is a server-side library; cache lives in-process |
| Principal population (`request.user`) | API / Backend (Guard) | — | Guard runs as middleware in the request pipeline; only server can set `request.user` safely |
| `@Public()` bypass metadata | API / Backend (Reflector) | — | Metadata is evaluated at the guard in the backend pipeline |
| `@CurrentUser()` param resolution | API / Backend (Decorator) | — | Reads `request.user` set by guard — pure server-side |
| Env var validation (`AUTH_MODE`) | API / Backend (AppConfigModule) | — | Zod schema at startup; Phase 2 pattern |
| Stub validator selection | API / Backend (AuthModule DI) | — | `useClass` conditional registration based on `AUTH_MODE` env var |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/passport` | 11.0.5 | NestJS passport adapter, `PassportModule`, `PassportStrategy` mixin | Official NestJS module; peer-compatible with NestJS 11 |
| `passport` | 0.7.0 | Passport.js core; required peer for `@nestjs/passport` | Universal Node.js authentication middleware |
| `passport-jwt` | 4.0.1 | JWT `Strategy` and `ExtractJwt` utilities | The standard JWT bearer extraction library for NestJS auth |
| `jwks-rsa` | 4.1.0 | JWKS key retrieval client with caching; exports `passportJwtSecret` | The canonical library for Entra/Auth0 JWKS key fetching |
| `jsonwebtoken` | 9.0.3 | JWT signature verification (`jwt.verify`); explicit install for type safety | Direct dep of `passport-jwt`; install explicitly to pin version and get `@types/jsonwebtoken` |

All packages are slopcheck `[OK]`. [VERIFIED: npm registry]

### Supporting (devDependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/passport-jwt` | 4.0.1 | TypeScript types for `Strategy` and `ExtractJwt` | Always when using passport-jwt in TypeScript |
| `@types/passport` | 1.0.17 | TypeScript types for passport core | Always when importing passport types |
| `@types/jsonwebtoken` | 9.0.10 | TypeScript types for `jwt.verify`, `jwt.decode` | Always when using jsonwebtoken in TypeScript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jwks-rsa` JwksClient | `passport-azure-ad` | `passport-azure-ad` was deprecated August 2023; do NOT use (AUTH-02 explicitly forbids it) |
| Custom `CanActivate` guard | `AuthGuard('jwt')` from `@nestjs/passport` | `AuthGuard('jwt')` delegates to passport middleware pipeline; custom guard gives cleaner `TokenValidator` seam integration and doesn't require passport session infrastructure |
| `jsonwebtoken.verify()` | `jose` library | `jsonwebtoken` is already a direct dep of `passport-jwt`; `jose` is a valid modern alternative (used internally by `jwks-rsa` v4.x) but adds a new dep for equivalent functionality |

**Installation:**
```bash
# Runtime dependencies
npm install --workspace=packages/backend @nestjs/passport passport passport-jwt jwks-rsa jsonwebtoken

# Dev dependencies (types only)
npm install --workspace=packages/backend --save-dev @types/passport-jwt @types/passport @types/jsonwebtoken
```

**Version verification (confirmed 2026-07-01):** [VERIFIED: npm registry]
- `@nestjs/passport@11.0.5` (2025-01-23), peer: `@nestjs/common ^10||^11`
- `passport@0.7.0` (2025-01-10)
- `passport-jwt@4.0.1` (2025-01-10)
- `jwks-rsa@4.1.0` (2026-06-25) — recently updated
- `jsonwebtoken@9.0.3` (transitive via passport-jwt)

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | slopcheck | Disposition |
|---------|----------|-----|-----------|-----------|-------------|
| `@nestjs/passport` | npm | ~7 yrs | Millions/wk | [OK] | Approved |
| `passport` | npm | ~13 yrs | Millions/wk | [OK] | Approved |
| `passport-jwt` | npm | ~10 yrs | Millions/wk | [OK] | Approved |
| `jwks-rsa` | npm | ~8 yrs (updated 2026-06-25) | Millions/wk | [OK] | Approved |
| `jsonwebtoken` | npm | ~11 yrs | Millions/wk | [OK] | Approved |
| `@types/passport-jwt` | npm | ~8 yrs | High | [OK] | Approved |
| `@types/passport` | npm | ~9 yrs | Millions/wk | [OK] | Approved |
| `@types/jsonwebtoken` | npm | ~8 yrs | Millions/wk | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No postinstall scripts found in any of the above packages.

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
  │
  ▼
ThrottlerGuard (APP_GUARD, already registered)
  │ rate limit check
  ▼
JwtAuthGuard (APP_GUARD, registered after Throttler)
  │
  ├─ [Reflector reads @Public() metadata]
  │   └─ isPublic=true ──► allow through (request.user remains null)
  │
  ├─ [ExtractJwt.fromAuthHeaderAsBearerToken()(request)]
  │   └─ no token ──► throw UnauthorizedException (401)
  │
  └─ TokenValidator.validate(rawBearerToken)
      │
      ├─ [AUTH_MODE=entra] EntraTokenValidator
      │     │
      │     ├── JwksClient.getSigningKey(kid)  ← jwks-rsa
      │     │     └── JWKS endpoint: https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys
      │     │
      │     ├── jwt.verify(token, publicKey, { issuer, audience })  ← jsonwebtoken
      │     │
      │     ├── claim mapping: oid→entraId, tid→tenantId, preferred_username→email, name→displayName
      │     │
      │     └── returns CurrentUser (or throws UnauthorizedException on failure)
      │
      └─ [AUTH_MODE=stub] StubTokenValidator
            ├── reads X-Dev-User request header
            ├── header missing → throw UnauthorizedException
            └── returns CurrentUser { entraId: 'stub-${email}', email, tenantId: 'stub-tenant' }

Guard sets request.user = CurrentUser
Handler accesses via @CurrentUser() param decorator
```

### Recommended Project Structure

```
packages/backend/src/
├── auth/
│   ├── auth.module.ts              # AuthModule — flat, leaf-level, imports only AppConfigModule
│   ├── token-validator.abstract.ts # abstract class TokenValidator (DI token)
│   ├── current-user.interface.ts   # CurrentUser interface/type
│   ├── entra-token-validator.ts    # EntraTokenValidator (real JWKS validation)
│   ├── stub-token-validator.ts     # StubTokenValidator (X-Dev-User header)
│   ├── jwt-auth.guard.ts           # JwtAuthGuard (global APP_GUARD)
│   ├── decorators/
│   │   ├── public.decorator.ts     # @Public() = SetMetadata('isPublic', true)
│   │   └── current-user.decorator.ts  # @CurrentUser() param decorator
│   └── auth-audit-context-provider.ts  # AuthAuditContextProvider (replaces no-op)
└── config/
    └── env.schema.ts               # Extended with AUTH_MODE, ENTRA_* vars + superRefine
```

### Pattern 1: TokenValidator Abstract Class (DI Seam)

```typescript
// Source: Phase 3 IAuditContextProvider pattern (same project — verified in codebase)
// packages/backend/src/auth/token-validator.abstract.ts

import { UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from './current-user.interface';

export abstract class TokenValidator {
  abstract validate(rawToken: string): Promise<CurrentUser>;
}

// packages/backend/src/auth/current-user.interface.ts
export interface CurrentUser {
  entraId: string;    // ← Entra oid claim (immutable user identifier)
  email: string;      // ← preferred_username || email (v2.0 token)
  tenantId: string;   // ← tid claim
  displayName?: string | null;  // ← name claim (nullable; requires profile scope)
}
```

### Pattern 2: Custom JwtAuthGuard (CanActivate, Not AuthGuard)

```typescript
// Source: NestJS official docs pattern + Reflector.getAllAndOverride [CITED: docs.nestjs.com/security/authentication]
// packages/backend/src/auth/jwt-auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractJwt } from 'passport-jwt';
import { TokenValidator } from './token-validator.abstract';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenValidator: TokenValidator,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    if (!token) throw new UnauthorizedException('AUTH.MISSING_TOKEN');

    // TokenValidator.validate() throws UnauthorizedException on invalid token.
    // The guard never catches — the GlobalExceptionFilter handles it.
    request.user = await this.tokenValidator.validate(token);
    return true;
  }
}
```

### Pattern 3: EntraTokenValidator (Real JWKS Validation)

```typescript
// Source: jwks-rsa JwksClient API [VERIFIED: npm registry], Microsoft Entra docs [CITED: learn.microsoft.com]
// packages/backend/src/auth/entra-token-validator.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/app-config.service';
import { TokenValidator } from './token-validator.abstract';
import { CurrentUser } from './current-user.interface';

@Injectable()
export class EntraTokenValidator extends TokenValidator {
  private readonly client: JwksClient;

  constructor(private readonly config: AppConfigService) {
    super();
    // Cache defaults from jwks-rsa v4: cacheMaxEntries=5, cacheMaxAge=600000 (10 min)
    this.client = new JwksClient({
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,   // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://login.microsoftonline.com/${this.config.get('ENTRA_TENANT_ID')}/discovery/v2.0/keys`,
    });
  }

  async validate(rawToken: string): Promise<CurrentUser> {
    // Step 1: decode header to extract kid (key ID) — no verification yet
    const decoded = jwt.decode(rawToken, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedException('AUTH.INVALID_TOKEN_FORMAT');
    }

    // Step 2: fetch the correct RSA public key from JWKS endpoint
    let publicKey: string;
    try {
      const key = await this.client.getSigningKey(decoded.header.kid);
      publicKey = key.getPublicKey();
    } catch {
      throw new UnauthorizedException('AUTH.KEY_NOT_FOUND');
    }

    // Step 3: verify signature + standard claims (exp, nbf, iss, aud)
    let payload: Record<string, unknown>;
    try {
      payload = jwt.verify(rawToken, publicKey, {
        issuer: `https://login.microsoftonline.com/${this.config.get('ENTRA_TENANT_ID')}/v2.0`,
        audience: this.config.get('ENTRA_AUDIENCE'),
        algorithms: ['RS256'],
      }) as Record<string, unknown>;
    } catch (err) {
      throw new UnauthorizedException('AUTH.TOKEN_INVALID');
    }

    // Step 4: map Entra v2.0 claims to CurrentUser
    // IMPORTANT: upn is v1.0-only. v2.0 equivalent is preferred_username (requires profile scope).
    // email claim requires optional claim configuration in the API app registration.
    const entraId = payload['oid'] as string | undefined;
    const email = (payload['preferred_username'] ?? payload['email']) as string | undefined;
    const tenantId = payload['tid'] as string | undefined;

    if (!entraId || !email || !tenantId) {
      throw new UnauthorizedException('AUTH.MISSING_REQUIRED_CLAIMS');
    }

    return {
      entraId,
      email,
      tenantId,
      displayName: (payload['name'] as string | undefined) ?? null,
    };
  }
}
```

### Pattern 4: StubTokenValidator (Dev/Test Mode)

```typescript
// packages/backend/src/auth/stub-token-validator.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenValidator } from './token-validator.abstract';
import { CurrentUser } from './current-user.interface';

@Injectable()
export class StubTokenValidator extends TokenValidator {
  // Stub does NOT parse a JWT — it reads a plain email from the X-Dev-User header.
  // The guard already extracted the bearer token from Authorization; the stub
  // must reach back to the raw request for the X-Dev-User header.
  // Design note: guard passes the raw token string. Stub ignores it.
  // For stub mode: guard should pass request instead, OR stub reads header via ClsService.
  // Recommended: guard injects the raw request HTTP context and passes it to the stub.

  async validate(rawToken: string): Promise<CurrentUser> {
    // rawToken in stub mode is the X-Dev-User header value (guard adapts extraction).
    if (!rawToken) throw new UnauthorizedException('AUTH.STUB_MISSING_DEV_USER_HEADER');
    const email = rawToken.trim();
    return {
      entraId: `stub-${email}`,
      email,
      tenantId: 'stub-tenant',
      displayName: null,
    };
  }
}
```

**Stub mode guard adaptation:** The guard must extract the `X-Dev-User` header when `AUTH_MODE=stub`. One clean approach: the guard itself checks `AUTH_MODE` and either extracts the Bearer token or the `X-Dev-User` header before calling `tokenValidator.validate()`. An alternative is to have the guard always pass the raw request to the validator (changing the seam to `validate(request: Request)`). The locked seam is `validate(token: string)` so the guard should do the extraction logic.

### Pattern 5: @Public() Decorator and @CurrentUser() Decorator

```typescript
// Source: NestJS SetMetadata pattern [CITED: docs.nestjs.com/security/authentication]

// packages/backend/src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// packages/backend/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../current-user.interface';
export const GetCurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUser | null =>
    ctx.switchToHttp().getRequest().user ?? null,
);
```

### Pattern 6: Env Schema Extension with Zod superRefine

```typescript
// Source: Zod v4 docs — .superRefine() API [ASSUMED]
// packages/backend/src/config/env.schema.ts — ADD to existing schema

// Replace z.object({...}) with z.object({...}).superRefine()
// New fields added to the SAME object literal:

AUTH_MODE: z.enum(['stub', 'entra']).default('stub'),
ENTRA_TENANT_ID: z.string().min(1).optional(),
ENTRA_CLIENT_ID: z.string().min(1).optional(),
ENTRA_AUDIENCE: z.string().min(1).optional(),

// .superRefine added after .object():
.superRefine((data, ctx) => {
  // Fail-fast: production must not run stub
  if (data.NODE_ENV === 'production' && data.AUTH_MODE === 'stub') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AUTH_MODE=stub is not permitted when NODE_ENV=production',
      path: ['AUTH_MODE'],
    });
  }
  // When AUTH_MODE=entra, Entra vars are required
  if (data.AUTH_MODE === 'entra') {
    const required = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_AUDIENCE'] as const;
    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required when AUTH_MODE=entra`,
          path: [key],
        });
      }
    }
  }
})
```

**Zod v4 note:** The project uses `zod@^4.4.3`. In Zod v4, `z.ZodIssueCode.custom` is `'custom'`. Verify the exact constant name against Zod v4 docs. [ASSUMED — Zod v4 API was in flux at training cutoff; verify in implementation.]

### Pattern 7: AuthModule Wiring

```typescript
// packages/backend/src/auth/auth.module.ts

@Module({
  imports: [
    AppConfigModule,           // For ENTRA_* env vars
    PassportModule,            // Structural consistency; @nestjs/passport ecosystem
  ],
  providers: [
    // Conditional: pick real or stub validator based on AUTH_MODE
    {
      provide: TokenValidator,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.get('AUTH_MODE') === 'entra'
          ? new EntraTokenValidator(config)
          : new StubTokenValidator(),
    },
    JwtAuthGuard,
    AuthAuditContextProvider,
  ],
  exports: [TokenValidator, JwtAuthGuard],
})
export class AuthModule {}
```

**AppModule additions:**

```typescript
// In AppModule.imports: add AuthModule
// In AppModule.providers (after ThrottlerGuard):
{ provide: APP_GUARD, useClass: JwtAuthGuard },          // Order: ThrottlerGuard → JwtAuthGuard
// Replace IAuditContextProvider no-op with AuthAuditContextProvider:
{ provide: IAuditContextProvider, useClass: AuthAuditContextProvider },
```

### Pattern 8: AuthAuditContextProvider (Replaces No-Op)

```typescript
// packages/backend/src/auth/auth-audit-context-provider.ts
// Source: Phase 3 IAuditContextProvider seam — D-01 from 03-CONTEXT.md

@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) { super(); }

  getContext(): AuditContext | null {
    const user: CurrentUser | undefined = this.cls.get('user');
    if (!user) return null;
    // D-04 from Phase 3: no organizationId yet — audit writes still skip (AuditLog.organizationId non-nullable)
    // Phase 6 will supply organizationId; for now return null to preserve skip behavior.
    return null;
    // When Phase 6 is ready:
    // const orgId = this.cls.get('organizationId');
    // return orgId ? { organizationId: orgId, userId: user.entraId } : null;
  }
}
```

**Note:** The guard sets `request.user`. For `AuthAuditContextProvider` to read it, `CurrentUser` must also be stored in CLS. The guard should `cls.set('user', currentUser)` in addition to `request.user = currentUser`. [ASSUMED — verify CLS store pattern matches nestjs-cls v6 API.]

### Anti-Patterns to Avoid

- **Using `AuthGuard('jwt')` as guard base class:** Triggers passport middleware pipeline and loses the clean `TokenValidator` seam. Use pure `CanActivate` instead.
- **Using `passport-azure-ad`:** Deprecated August 2023. AUTH-02 explicitly forbids it.
- **Hard-coding `upn` as the email claim:** `upn` is a v1.0-only claim. v2.0 tokens use `preferred_username`. Always check `preferred_username` first.
- **Setting `aud` to `api://` App ID URI for v2.0 tokens:** v2.0 tokens use the client ID GUID as `aud`. Set `ENTRA_AUDIENCE` to the client ID.
- **Passing the token to `StubTokenValidator`:** Stub needs the `X-Dev-User` header, not a JWT. The guard must branch on `AUTH_MODE` for extraction.
- **Importing `AuthModule` into business domain modules:** `AuthModule` is cross-cutting infrastructure; cyclic DI risk. The guard is global via `APP_GUARD`; no import needed in domain modules.
- **`EntraTokenValidator` constructor calling `config.get('ENTRA_TENANT_ID')` when `AUTH_MODE=stub`:** The factory pattern in `AuthModule` ensures `EntraTokenValidator` is never instantiated in stub mode.
- **Catching `UnauthorizedException` in the guard:** Let it propagate to `GlobalExceptionFilter`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWKS key retrieval and caching | Custom JWKS HTTP client | `jwks-rsa` JwksClient | Handles RSA key parsing, `kid` lookup, cache, rate limiting, stale-cache fallback |
| JWT signature verification | Custom RS256 verifier | `jsonwebtoken.verify()` | Handles `exp`, `nbf`, `iss`, `aud`, algorithm whitelisting, clock skew |
| Entra key rotation | Periodic key refresh cron job | `jwks-rsa` cache with 10-min TTL | `cacheMaxAge` + `cacheMaxAgeFallback` handles rotation automatically |
| Bearer token extraction from `Authorization` header | Manual string split on `Bearer ` | `ExtractJwt.fromAuthHeaderAsBearerToken()` | Handles edge cases; standard from passport-jwt |

**Key insight:** JWT signature verification looks simple but has 15+ edge cases: algorithm confusion attacks, `none` algorithm, clock skew, `nbf` enforcement, missing required claims. Always use `jsonwebtoken.verify()` with explicit `algorithms: ['RS256']`.

---

## Microsoft Entra ID v2.0 Token — Verified Claim Reference

> All findings below are `[CITED: learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference]` (updated 2026-06-25) and `[CITED: learn.microsoft.com/en-us/entra/identity-platform/access-tokens]` (updated 2026-06-15).

### iss (Issuer) Claim

| Tenant Type | iss value in token | Validation approach |
|-------------|-------------------|---------------------|
| Single-tenant | `https://login.microsoftonline.com/{tenantId}/v2.0` | Exact match against `ENTRA_TENANT_ID` |
| Multi-tenant | `https://login.microsoftonline.com/{tid}/v2.0` | Template match: substitute `tid` claim into template; verify match |

**For this phase (single-tenant):** Configure `jwt.verify({ issuer: 'https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0' })`.

### aud (Audience) Claim

| Token version | aud value |
|---------------|-----------|
| **v2.0 tokens** | **Always the client ID GUID** (e.g., `6e74172b-be56-4843-9ff4-e66a39bb12e3`) |
| v1.0 tokens | Can be the client ID or the resource URI (`api://...`) |

**Critical:** Set `ENTRA_AUDIENCE` to the **client ID GUID** (from App Registration → Application (client) ID), NOT `api://`. [CITED: learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference]

### Claims Present in v2.0 Access Tokens

| Claim | Type | Present | Requires | Maps to |
|-------|------|---------|----------|---------|
| `oid` | GUID string | Always | (no extra scope) | `CurrentUser.entraId` |
| `tid` | GUID string | Always | `profile` scope | `CurrentUser.tenantId` |
| `preferred_username` | string | Yes (v2.0 only) | `profile` scope | `CurrentUser.email` (primary) |
| `name` | string | Yes (v2.0) | `profile` scope | `CurrentUser.displayName` |
| `email` | string | Optional | Optional claim config | `CurrentUser.email` (fallback) |
| `upn` | string | **v1.0 ONLY** | — | **DO NOT USE for v2.0** |
| `sub` | string | Always | — | Pairwise, app-specific — NOT a stable cross-app key (use `oid` instead) |
| `azp` | GUID | Yes (v2.0) | — | Client app ID (not used in CurrentUser) |
| `ver` | string "2.0" | Always | — | Token version indicator |

**CRITICAL FINDING (resolves MEDIUM-confidence flag):** The `upn` claim specified in CONTEXT.md D-03 as a source for `email` is a **v1.0-only claim** and is absent from v2.0 access tokens. The correct mapping chain for `CurrentUser.email` in v2.0 tokens is: `preferred_username ?? email`. The `email` claim itself requires the API app registration to configure it as an optional claim (Entra admin center → App registrations → Token configuration → Add optional claim → Access token → email). If neither `preferred_username` nor `email` is present in a token, the validator must throw `UnauthorizedException('AUTH.MISSING_REQUIRED_CLAIMS')`.

### JWKS Endpoint URL

| Type | URL |
|------|-----|
| Tenant-specific (single-tenant, recommended) | `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys` |
| Common / multi-tenant | `https://login.microsoftonline.com/common/discovery/v2.0/keys` |
| From OIDC discovery doc | `https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration` → `jwks_uri` field |

**Use the tenant-specific URL** since this is a single-tenant deployment. This prevents tokens from other tenants from being accepted even if a cross-tenant key collision exists.

---

## Common Pitfalls

### Pitfall 1: `upn` Claim in v2.0 Access Tokens

**What goes wrong:** Code accesses `payload.upn` expecting the user's email. The claim is absent in v2.0 tokens, email resolves to `undefined`, `CurrentUser.email` is empty, and downstream code breaks.

**Why it happens:** The `upn` claim exists in v1.0 tokens, and many tutorials/older docs reference it. Microsoft's v2.0 documentation moved to `preferred_username` but this isn't obvious when reading cross-version docs.

**How to avoid:** Always use `preferred_username ?? email` for v2.0 tokens. If `preferred_username` is absent (guest accounts, service principals), fall back to `email`. Log a warning if neither is present and throw `UnauthorizedException`.

**Warning signs:** `CurrentUser.email` resolving to `undefined` in integration tests with real tokens; `payload.upn` being `undefined` in token decode output.

### Pitfall 2: Wrong `aud` Claim Value for v2.0 Tokens

**What goes wrong:** `jwt.verify()` fails with "jwt audience invalid" because `ENTRA_AUDIENCE` is set to `api://{clientId}` instead of the GUID client ID.

**Why it happens:** v1.0 tokens can have the App ID URI as `aud`. v2.0 tokens always use the GUID client ID. Docs and App Registration UI show both; developers pick the wrong one.

**How to avoid:** Set `ENTRA_AUDIENCE` to the **client ID GUID** from App Registration → Overview → "Application (client) ID". Verify by decoding a real token with `jwt.decode()` and checking the `aud` field.

**Warning signs:** `jsonwebtoken` throwing `JsonWebTokenError: jwt audience invalid` in non-test environments.

### Pitfall 3: Guard Registration Order (ThrottlerGuard Must Come First)

**What goes wrong:** `JwtAuthGuard` is registered as the first `APP_GUARD` provider. NestJS executes guards in registration order. Authentication runs before throttling, meaning unauthenticated brute-force attempts bypass rate limiting.

**Why it happens:** New `APP_GUARD` providers are naively prepended or placed in wrong order in `providers[]`.

**How to avoid:** In `AppModule.providers`, `ThrottlerGuard` registration must appear BEFORE `JwtAuthGuard` registration (they're both `{ provide: APP_GUARD, useClass: ... }` entries).

**Warning signs:** Brute-force 401 attempts not being throttled; rate limit tests failing unexpectedly.

### Pitfall 4: Stub Mode Backdoor in Production

**What goes wrong:** `AUTH_MODE=stub` is set in a production environment (e.g., via misconfigured CI/CD env vars). Any request with any `X-Dev-User` header gets authenticated as that user.

**Why it happens:** Zod schema allows the enum value without a cross-field validation against `NODE_ENV`.

**How to avoid:** The `.superRefine()` refinement in `env.schema.ts` must fail-fast at startup if `NODE_ENV === 'production'` AND `AUTH_MODE === 'stub'`. This is enforced at module initialization, not at request time.

**Warning signs:** Application starting without error in production with `AUTH_MODE=stub` in the environment; missing `.superRefine()` in `env.schema.ts`.

### Pitfall 5: JWKS Cache Miss on Key Rotation

**What goes wrong:** Microsoft rotates JWKS signing keys periodically. If the in-process cache TTL is too long (e.g., 24 hours), an old key may be cached after rotation, causing all tokens signed with the new key to fail validation.

**Why it happens:** Setting `cacheMaxAge` too high.

**How to avoid:** Use `cacheMaxAge: 10 * 60 * 1000` (10 minutes). `jwks-rsa` v4 also supports `cacheMaxAgeFallback` for serving stale keys when the JWKS endpoint is temporarily unavailable. Microsoft recommends checking for key updates every 24 hours maximum; 10 minutes is safely below that threshold.

**Warning signs:** Sporadic `AUTH.KEY_NOT_FOUND` errors in production after a Microsoft key rotation event.

### Pitfall 6: Cyclic DI with AuthModule

**What goes wrong:** `AuthModule` imports a module that depends on an auth-protected service, creating a circular dependency that NestJS cannot resolve.

**Why it happens:** Developers import domain modules into `AuthModule` for convenience.

**How to avoid:** `AuthModule` imports ONLY `AppConfigModule` and `PassportModule`. The guard is global via `APP_GUARD`; domain modules never need to import `AuthModule`.

**Warning signs:** NestJS `Error: Nest can't resolve dependencies of the XXX` at startup; circular dependency warning in module resolution.

### Pitfall 7: `HealthController` Missing `@Public()` After Guard Wires

**What goes wrong:** After `JwtAuthGuard` is registered as global `APP_GUARD`, the existing `HealthController` starts returning 401 for `/api/v1/health/liveness` and `/api/v1/health/readiness`. Kubernetes/container health probes fail; the pod is restarted in a loop.

**Why it happens:** The guard secures all routes by default. `HealthController` was written before the guard existed and has no `@Public()` decorator.

**How to avoid:** Add `@Public()` to `HealthController` class-level in the SAME plan/wave that wires the global guard. D-10 mandates this.

**Warning signs:** Health endpoint returning 401 after `APP_GUARD` registration; existing `HealthController` integration tests failing.

---

## Code Examples

### Verified: jwks-rsa JwksClient API (v4.1.0)

```typescript
// Source: jwks-rsa source (auth0/node-jwks-rsa) [VERIFIED: npm registry]

import { JwksClient } from 'jwks-rsa';

const client = new JwksClient({
  jwksUri: 'https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys',
  cache: true,             // default: true
  cacheMaxEntries: 5,      // default: 5
  cacheMaxAge: 600000,     // default: 600000 (10 min in ms)
  rateLimit: true,         // optional: throttle JWKS requests
  jwksRequestsPerMinute: 5,
});

// Usage:
const key = await client.getSigningKey(kid);      // kid from JWT header
const publicKey = key.getPublicKey();              // RSA public key string
```

### Verified: passportJwtSecret Function (for secretOrKeyProvider pattern)

```typescript
// Source: jwks-rsa/src/integrations/passport.js [VERIFIED: github.com/auth0/node-jwks-rsa]

import { passportJwtSecret } from 'jwks-rsa';

// Returns a secretProvider(req, rawJwtToken, cb) function
// Compatible with passport-jwt secretOrKeyProvider option
const secretProvider = passportJwtSecret({
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  jwksUri: 'https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys',
});
// secretProvider(req, rawToken, (err, key) => { ... })
```

### Verified: jwt.verify with issuer + audience

```typescript
// Source: jsonwebtoken npm package docs [VERIFIED: npm registry]

import * as jwt from 'jsonwebtoken';

const payload = jwt.verify(rawToken, publicKey, {
  issuer: 'https://login.microsoftonline.com/{tenantId}/v2.0',
  audience: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // client ID GUID
  algorithms: ['RS256'],   // whitelist only RS256; prevents algorithm confusion attack
}) as Record<string, unknown>;
```

### Verified: ExtractJwt from passport-jwt

```typescript
// Source: passport-jwt package [VERIFIED: npm registry]

import { ExtractJwt } from 'passport-jwt';

// Returns a function(request) => string | null
const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
const token: string | null = extractor(request);
// Parses "Authorization: Bearer <token>" header
```

### Verified: Reflector.getAllAndOverride for @Public()

```typescript
// Source: NestJS official auth docs [CITED: docs.nestjs.com/security/authentication]

import { Reflector } from '@nestjs/core';

const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
  context.getHandler(),  // method-level metadata
  context.getClass(),    // class-level metadata
]);
// Returns true if EITHER the handler OR the class has @Public()
```

### Verified: Testing with Local RSA Keypair (no live tenant)

```typescript
// Source: jsonwebtoken docs [VERIFIED: npm registry] + project test pattern

import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';

// Generate a test RSA keypair — do this once in a test helper
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

// Sign a test token with required claims
const testToken = jwt.sign(
  {
    oid: 'test-oid-1234',
    tid: 'test-tenant-id',
    preferred_username: 'user@example.com',
    name: 'Test User',
  },
  privateKey,
  {
    algorithm: 'RS256',
    issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
    audience: 'test-client-id',
    expiresIn: '1h',
    keyid: 'test-kid-1',
  },
);

// In tests: mock JwksClient.getSigningKey to return { getPublicKey: () => publicKey }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `passport-azure-ad` with OIDC strategy | `passport-jwt` + `jwks-rsa` JwksClient | August 2023 (deprecation) | AUTH-02 explicitly requires the new approach |
| v1.0 `upn` claim for user email | v2.0 `preferred_username` (or optional `email`) | v2.0 token format | D-03 must use `preferred_username` not `upn` for v2.0 tokens |
| `aud` = `api://{clientId}` App ID URI | `aud` = client ID GUID (v2.0) | v2.0 token format | `ENTRA_AUDIENCE` env var must be the GUID |
| `jwks-rsa` v3.x with `jwksUri` callback | `jwks-rsa` v4.x with `JwksClient` class | v4.0.0 (2023) | Direct `JwksClient` instantiation; `passportJwtSecret` helper available |
| `AuthGuard('jwt')` as global guard | Custom `CanActivate` + `TokenValidator` seam | This project design | Enables swappable stub validator without passport pipeline |

**Deprecated/outdated:**
- `passport-azure-ad`: Deprecated August 2023. Do NOT use. No replacement needed — use `passport-jwt` + `jwks-rsa` directly.
- `v1.0 access tokens`: Microsoft is moving to v2.0. Set `requestedAccessTokenVersion: 2` in the API app registration manifest.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zod v4.4.3 `superRefine` uses `z.ZodIssueCode.custom` as the code value | Pattern 6 (Env Schema) | Schema refinement may fail to compile; verify Zod v4 API at implementation time |
| A2 | `nestjs-cls` v6 ClsService supports `cls.set('user', value)` in a guard (called after `ClsMiddleware` runs) | Pattern 7 (AuthModule) | If CLS store is not accessible from guards, `AuthAuditContextProvider` cannot read `CurrentUser` |
| A3 | `ENTRA_AUDIENCE` should be the client ID GUID for single-tenant access tokens issued to this API | Entra Claims Reference | If the app registration uses an App ID URI override, `aud` could differ; confirm with ENTRA_AUDIENCE env value during integration testing |
| A4 | `preferred_username` claim is present in access tokens when the client requests `profile` scope | Claims Reference | If the client doesn't request `profile` scope, `preferred_username` may be absent; fallback to `email` optional claim |
| A5 | Guard sets `request.user` in the request lifecycle before ALS store access in `AuthAuditContextProvider` | Pattern 8 | If `getContext()` is called before the guard runs (e.g., in middleware), `user` will be null and audit writes will skip |

---

## Open Questions

1. **`email` claim vs `preferred_username` in practice**
   - What we know: `upn` is v1.0-only; `preferred_username` is present in v2.0 tokens with `profile` scope; `email` requires optional claim configuration.
   - What's unclear: Does the enterprise Entra tenant in use request `profile` scope by default? Are there guest accounts or service principals that might lack both claims?
   - Recommendation: Implement `preferred_username ?? email` with a fail-fast `UnauthorizedException` if both are absent. Document the optional `email` claim configuration requirement in the deployment guide.

2. **`ENTRA_AUDIENCE` value format for this specific app registration**
   - What we know: v2.0 access tokens use client ID GUID as `aud`. The `App ID URI` (`api://`) is only used in v1.0.
   - What's unclear: Some app registrations expose both formats. The correct value depends on what `requestedAccessTokenVersion` is set to in the API's app manifest.
   - Recommendation: Set `ENTRA_AUDIENCE` env var to the client ID GUID. Verify by decoding a real token from the tenant.

3. **`AuthAuditContextProvider` design — CLS vs request**
   - What we know: `IAuditContextProvider.getContext()` is called by `AuditInterceptor` which runs after the guard.
   - What's unclear: Is it simpler to read `request.user` via `HttpContextHost` or to store in CLS?
   - Recommendation: Store `CurrentUser` in CLS (nestjs-cls `cls.set('user', currentUser)`) from the guard. `AuthAuditContextProvider` reads it from CLS. This keeps the provider transport-agnostic (no HTTP dependency).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.22.3 | — |
| npm | Package install | Yes | 10.9.8 | — |
| Real Entra tenant | AUTH_MODE=entra integration | No (out of scope) | — | AUTH_MODE=stub for local/test |
| Live JWKS endpoint | EntraTokenValidator | No (test only) | — | Mock JwksClient in unit tests |

**Missing dependencies with no fallback:** None blocking this phase.

**Missing dependencies with fallback:** Live Entra tenant — all tests use `AUTH_MODE=stub` or mock JWKS. Full live integration testing is explicitly deferred (RT-05 in REQUIREMENTS.md).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 (SWC) |
| Config file | `packages/backend/vitest.config.ts` (inherited from Phase 1) |
| Quick run command | `npm run test --workspace=packages/backend` |
| Full suite command | `npm run test --workspace=packages/backend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | A protected endpoint rejects requests without a valid JWT (401) | integration | `npm run test --workspace=packages/backend -- --reporter verbose` | ❌ Wave 0 |
| AUTH-01 | `EntraTokenValidator.validate()` returns `CurrentUser` for a valid JWT signed with a local RSA key | unit | same | ❌ Wave 0 |
| AUTH-01 | `EntraTokenValidator.validate()` throws `UnauthorizedException` for a tampered/expired token | unit | same | ❌ Wave 0 |
| AUTH-02 | No `passport-azure-ad` import exists anywhere in `src/auth/` | static (grep) | `grep -r "passport-azure-ad" packages/backend/src && exit 1 \|\| exit 0` | ❌ Wave 0 |
| AUTH-03 | `@Public()` route returns 200 with no Authorization header | integration | same | ❌ Wave 0 |
| AUTH-03 | Non-`@Public()` route returns 401 with no Authorization header | integration | same | ❌ Wave 0 |
| AUTH-04 | `@CurrentUser()` in a handler resolves the correct principal from a stub token | integration | same | ❌ Wave 0 |
| AUTH-05 | `AUTH_MODE=stub` with `X-Dev-User: user@example.com` header returns 200 and resolves `CurrentUser.email` | integration | same | ❌ Wave 0 |
| AUTH-05 | `AUTH_MODE=stub` AND `NODE_ENV=production` causes Zod to throw at startup | unit | same | ❌ Wave 0 (env.schema.spec.ts extension) |

### Integration Test Strategy

The integration tests follow the pattern in `app.integration.spec.ts`:
- Use `AUTH_MODE=stub` env var in tests (no live Entra tenant needed)
- Create a test controller with one `@Public()` and one protected endpoint
- Test: no token → 401, stub header → 200 with `CurrentUser`, `@Public()` → 200 without header
- Unit tests for `EntraTokenValidator`: mock `JwksClient.getSigningKey`, sign test tokens with `crypto.generateKeyPairSync`

### Sampling Rate

- **Per task commit:** `npm run test --workspace=packages/backend`
- **Per wave merge:** `npm run test --workspace=packages/backend`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/src/auth/jwt-auth.guard.spec.ts` — unit tests for guard public/protected routing
- [ ] `packages/backend/src/auth/entra-token-validator.spec.ts` — unit tests with local RSA keypair + mocked JwksClient
- [ ] `packages/backend/src/auth/stub-token-validator.spec.ts` — unit tests for X-Dev-User header processing
- [ ] `packages/backend/src/config/env.schema.spec.ts` — EXTEND with AUTH_MODE + NODE_ENV=production superRefine test
- [ ] `packages/backend/src/app.integration.spec.ts` — EXTEND with Phase 4 auth integration test cases

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `JwtAuthGuard` + `TokenValidator` seam; fail-closed (missing token → 401) |
| V3 Session Management | No | Stateless JWT; no session store this phase |
| V4 Access Control | Partial | `@Public()` mechanism; full RBAC in Phase 5 |
| V5 Input Validation | Yes | `ExtractJwt` for token extraction; `jwt.verify()` for signature |
| V6 Cryptography | Yes | `jsonwebtoken.verify()` with `algorithms: ['RS256']`; never hand-roll crypto |

### Known Threat Patterns for JWT + JWKS Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Algorithm confusion (`"alg":"none"`) | Tampering | `algorithms: ['RS256']` whitelist in `jwt.verify()` |
| JWT replay (stolen valid token) | Elevation of Privilege | Short token lifetime (Entra default 60-90 min); no additional mitigation this phase |
| JWKS cache poisoning | Tampering | `jwksUri` uses HTTPS; `jwks-rsa` validates the key format |
| Stub mode exposure in production | Elevation of Privilege | Zod `superRefine` fail-fast; document in runbook |
| `X-Dev-User` header in entra mode | Elevation of Privilege | Guard only reads this header when `AUTH_MODE=stub` (validated via Zod at startup) |
| Missing `aud` validation | Elevation of Privilege | `jwt.verify({ audience: ENTRA_AUDIENCE })` mandatory; token for different audience rejected |
| Missing `iss` validation | Elevation of Privilege | `jwt.verify({ issuer: ... })` mandatory; cross-tenant token rejected |
| Secrets in logs | Information Disclosure | `Authorization` header already in redaction deny-list (Phase 3 D-13); JWT raw token must NOT be logged |

---

## Sources

### Primary (HIGH confidence)

- [CITED: learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference] — v2.0 claim reference; `upn` v1.0-only finding; `aud` is client ID GUID for v2.0; `preferred_username` v2.0-only; `tid`/`oid`/`name` claims (updated 2026-06-25)
- [CITED: learn.microsoft.com/en-us/entra/identity-platform/access-tokens] — JWKS URI format, issuer validation pseudocode, single-tenant vs multi-tenant `iss` formats, token version guidance (updated 2026-06-15)
- [CITED: learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc] — JWKS endpoint URL: `https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys` (confirmed from discovery document `jwks_uri` field); updated 2026-06-30
- [VERIFIED: npm registry] — `@nestjs/passport@11.0.5`, `passport@0.7.0`, `passport-jwt@4.0.1`, `jwks-rsa@4.1.0`, `jsonwebtoken@9.0.3` versions and publish dates
- [VERIFIED: github.com/auth0/node-jwks-rsa] — `passportJwtSecret` function signature, `JwksClient` cache defaults (`cacheMaxEntries: 5`, `cacheMaxAge: 600000`)
- Phase 3 codebase — `IAuditContextProvider` abstract class seam pattern, `app.module.ts` guard registration order, `env.schema.ts` Zod extension pattern, `health.controller.ts` and integration test patterns

### Secondary (MEDIUM confidence)

- [docs.nestjs.com/security/authentication] — `Reflector.getAllAndOverride` with `@Public()` pattern; canonical `APP_GUARD` registration
- [github.com/AzureAD/microsoft-identity-web/discussions/2405] — Community confirmation that `passport-azure-ad` is deprecated; `passport-jwt` + `jwks-rsa` is the recommended replacement
- [voitanos.io/blog/validating-entra-id-generated-oauth-tokens/] — Two-step validation process (JWKS key fetch + claim validation); `aud` claim validated against client ID

### Tertiary (LOW confidence)

- WebSearch — `passport-azure-ad` August 2023 deprecation date (cross-referenced with NestJS community posts; not directly verified from Microsoft source)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry; slopcheck OK
- Entra v2.0 claim behavior: HIGH — from official Microsoft docs updated June 2026
- JWKS cache defaults: HIGH — verified from jwks-rsa source code
- Architecture pattern: HIGH — seam pattern follows existing Phase 3 codebase precedent
- Zod v4 superRefine API: MEDIUM — `[ASSUMED]` until confirmed against zod@4.4.3 changelog
- nestjs-cls guard integration: MEDIUM — `[ASSUMED]` until verified against nestjs-cls v6 docs

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (stable libraries; Entra docs change rarely for these fundamentals)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 4 |
|-----------|-----------------|
| Business logic must not exist in controllers | `JwtAuthGuard` is infrastructure; `TokenValidator.validate()` is service logic — correct placement |
| Clean architecture: guards/decorators are infra; validators are services | `JwtAuthGuard` in `auth/` as infra; `EntraTokenValidator` as a service-layer component |
| Security: validate all input; never trust client data; never expose stack traces | `jwt.verify()` validates signature + claims; `UnauthorizedException` does not expose internal details |
| Never log secrets, tokens, passwords | Do NOT log the raw JWT token in `EntraTokenValidator.validate()` |
| Prisma is single source of truth; zero DB writes | Phase 4 makes no DB writes (D-04) |
| Every error should explain what failed, why, how to fix | Error codes: `AUTH.MISSING_TOKEN`, `AUTH.TOKEN_INVALID`, `AUTH.KEY_NOT_FOUND`, `AUTH.MISSING_REQUIRED_CLAIMS` |
| Apply least-privilege principles | `@Public()` must be explicit; secure by default is the guard baseline |
| Every feature should include appropriate tests | All 5 auth requirements need unit + integration tests (see Validation Architecture) |
