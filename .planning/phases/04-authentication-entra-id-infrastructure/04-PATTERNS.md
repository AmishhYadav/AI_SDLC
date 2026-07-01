# Phase 4: Authentication (Entra ID) Infrastructure - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 12 (9 new, 3 modified)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/auth/token-validator.ts` | DI-token (abstract class) | request-response | `src/audit/audit-context-provider.interface.ts` | exact |
| `src/auth/current-user.type.ts` | type | — | `src/audit/audit-context-provider.interface.ts` (`AuditContext`) | role-match |
| `src/auth/jwt-auth.guard.ts` | guard | request-response | `src/common/interceptors/audit.interceptor.ts` (Reflector usage) | partial |
| `src/auth/entra-token-validator.ts` | service (validator) | request-response | `src/idempotency/noop-idempotency-store.ts` (injectable impl of abstract) | role-match |
| `src/auth/stub-token-validator.ts` | service (validator) | request-response | `src/audit/noop-audit-context-provider.ts` | exact |
| `src/auth/public.decorator.ts` | decorator (metadata) | — | `src/common/interceptors/raw-response.decorator.ts` | exact |
| `src/auth/current-user.decorator.ts` | decorator (param) | — | `src/common/interceptors/raw-response.decorator.ts` (SetMetadata shape) | role-match |
| `src/auth/auth.module.ts` | module | — | `src/health/health.module.ts` + `src/config/config.module.ts` | exact |
| `src/auth/auth-audit-context-provider.ts` | service (provider) | request-response | `src/audit/noop-audit-context-provider.ts` | exact |
| `src/config/env.schema.ts` | config | — | itself (extend in-place) | exact |
| `src/app.module.ts` | module (modify) | — | itself (extend in-place) | exact |
| `src/health/health.controller.ts` | controller (modify) | request-response | itself (extend in-place) | exact |

---

## Pattern Assignments

### `src/auth/token-validator.ts` (DI-token, abstract class)

**Analog:** `src/audit/audit-context-provider.interface.ts` (lines 1-13)

**Key insight:** NestJS DI cannot inject interfaces (erased at runtime). Use `abstract class` as the DI token. The existing codebase already does this twice — `IAuditContextProvider` and `IdempotencyStore`. Phase 4 follows the same convention verbatim.

**Abstract-class-as-DI-token pattern** (`src/audit/audit-context-provider.interface.ts`, lines 11-13):
```typescript
export abstract class IAuditContextProvider {
  abstract getContext(): AuditContext | null;
}
```

**Second analog** (`src/idempotency/idempotency-store.interface.ts`, lines 8-12):
```typescript
export abstract class IdempotencyStore {
  abstract get(key: string): Promise<unknown | undefined>;
  abstract set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}
```

**Apply to `token-validator.ts`:**
```typescript
import { CurrentUser } from './current-user.type';

/**
 * Abstract class used as NestJS DI token (not interface — interfaces are erased at runtime).
 * Implement this class to validate bearer tokens and return the authenticated principal.
 * D-02 (Phase 4): EntraTokenValidator (AUTH_MODE=entra) or StubTokenValidator (AUTH_MODE=stub).
 */
export abstract class TokenValidator {
  abstract validate(rawToken: string): Promise<CurrentUser>;
}
```

---

### `src/auth/current-user.type.ts` (type)

**Analog:** `src/audit/audit-context-provider.interface.ts` (`AuditContext` interface, lines 1-4)

**Type-only export pattern** (`src/audit/audit-context-provider.interface.ts`, lines 1-4):
```typescript
export interface AuditContext {
  organizationId: string;
  userId?: string;
}
```

**Apply to `current-user.type.ts`** — co-locate type with the abstract class file or as a standalone; the project co-locates related types in the same file (see `AuditContext` + `IAuditContextProvider`). For Phase 4, keep `CurrentUser` in its own file for clarity:
```typescript
// D-01 / D-03 (Phase 4): JWT claims only — no DB hit per request.
// entraId ← Entra oid claim; email ← preferred_username ?? email (v2.0);
// tenantId ← tid; displayName ← name (nullable).
export interface CurrentUser {
  entraId: string;
  email: string;
  tenantId: string;
  displayName?: string | null;
}
```

---

### `src/auth/jwt-auth.guard.ts` (guard, request-response)

**Analog (Reflector usage):** `src/common/interceptors/audit.interceptor.ts` (lines 1-21)

**Analog (APP_GUARD provider token):** `src/app.module.ts` line 112

No existing guard file in the codebase. The closest patterns are:
1. `Reflector` injection and `getAllAndOverride` / `reflector.get()` in `AuditInterceptor`
2. The `APP_GUARD / ThrottlerGuard` registration in `AppModule` providers

**Reflector injection pattern** (`src/common/interceptors/audit.interceptor.ts`, lines 10-21):
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// ...
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditContextProvider: IAuditContextProvider,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!auditMeta) return next.handle();
    // ...
  }
}
```

**`switchToHttp().getRequest()` pattern** (`src/common/interceptors/audit.interceptor.ts`, lines 24-25):
```typescript
const req = context
  .switchToHttp()
  .getRequest<{ ip?: string; headers: Record<string, string | undefined> }>();
```

**Guard imports pattern** — combine NestJS common + core, no external imports at class level:
```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt } from 'passport-jwt';
import { TokenValidator } from './token-validator';
import { AppConfigService } from '../config/app-config.service';
```

**`UnauthorizedException` (not throw new Error):** Guard throws `UnauthorizedException` — `GlobalExceptionFilter` catches all `HttpException` subclasses. Do NOT catch inside the guard.

---

### `src/auth/entra-token-validator.ts` (service, request-response)

**Analog:** `src/idempotency/noop-idempotency-store.ts` for the injectable-extends-abstract pattern (lines 1-23); the real implementation has external library calls (no analog in codebase for JWKS — follow RESEARCH.md patterns).

**Injectable-extends-abstract pattern** (`src/idempotency/noop-idempotency-store.ts`, lines 1-9):
```typescript
import { Injectable } from '@nestjs/common';
import { IdempotencyStore } from './idempotency-store.interface';

@Injectable()
export class NoOpIdempotencyStore extends IdempotencyStore {
  private readonly store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }
  // ...
}
```

**AppConfigService injection pattern** (`src/common/interceptors/audit.interceptor.ts` and `src/config/app-config.service.ts`, lines 6-9):
```typescript
constructor(private readonly config: AppConfigService) {}
// Then: this.config.get('ENTRA_TENANT_ID')  // type-safe via Env keyof
```

**Error handling pattern** — use typed `UnauthorizedException` with a namespaced message code; GlobalExceptionFilter handles it. Never catch `UnauthorizedException` inside a validator:
```typescript
// From GlobalExceptionFilter pattern (global-exception.filter.ts, lines 36-54):
// UnauthorizedException is an HttpException → isHttp=true → status=401
// message is extracted from exception.getResponse().message
throw new UnauthorizedException('AUTH.TOKEN_INVALID');   // message surfaced in envelope
```

**Never log the raw token** — `app.module.ts` line 43 shows `req.headers.authorization` is already redacted by pino. Do NOT pass rawToken to `this.logger.error()`.

---

### `src/auth/stub-token-validator.ts` (service, request-response)

**Analog:** `src/audit/noop-audit-context-provider.ts` (lines 1-13) — exact pattern: `@Injectable()`, `extends AbstractClass`, minimal implementation.

**Full analog** (`src/audit/noop-audit-context-provider.ts`, lines 1-13):
```typescript
import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from './audit-context-provider.interface';

/**
 * D-01: No-op provider. Phase 4 (authenticated principal) and Phase 6 (tenant context) replace
 * this via AuditModule-level provider override with no interceptor changes required.
 */
@Injectable()
export class NoOpAuditContextProvider extends IAuditContextProvider {
  getContext(): AuditContext | null {
    return null;
  }
}
```

**Apply to `stub-token-validator.ts`:**
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenValidator } from './token-validator';
import { CurrentUser } from './current-user.type';

/**
 * D-06 (Phase 4): Dev/test stub activated by AUTH_MODE=stub.
 * Reads the X-Dev-User header value (passed as rawToken by the guard in stub mode).
 * NEVER active in production — Zod superRefine enforces this at startup.
 */
@Injectable()
export class StubTokenValidator extends TokenValidator {
  async validate(rawToken: string): Promise<CurrentUser> {
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

---

### `src/auth/public.decorator.ts` (decorator, metadata)

**Analog:** `src/common/interceptors/raw-response.decorator.ts` (lines 1-6) — exact pattern for `SetMetadata` class+method decorator; also `src/audit/audit.decorator.ts` (lines 1-12) for `SetMetadata` with a constant key.

**SetMetadata constant-key pattern** (`src/common/interceptors/raw-response.decorator.ts`, lines 1-6):
```typescript
import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';

export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);
```

**SetMetadata with named key** (`src/audit/audit.decorator.ts`, lines 1-12):
```typescript
import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@repo/database';

export const AUDIT_KEY = 'AUDIT';
// ...
export const Audit = (action: AuditAction, resource: string): MethodDecorator =>
  SetMetadata(AUDIT_KEY, { action, resource });
```

**Apply to `public.decorator.ts`:** Export both the key constant AND the decorator (guard reads the key constant too):
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
```

**Note:** Export `IS_PUBLIC_KEY` from this file. The guard imports `IS_PUBLIC_KEY` from this file to avoid magic string duplication (consistent with `RAW_RESPONSE_KEY` / `AUDIT_KEY` / `IDEMPOTENCY_KEY_META` pattern).

---

### `src/auth/current-user.decorator.ts` (decorator, param)

**Analog:** `src/audit/audit.decorator.ts` for decorator structure. No `createParamDecorator` exists in the codebase yet — this is a new pattern type. The RESEARCH.md has the authoritative implementation.

**Decorator file structure** (follow `audit.decorator.ts` import style, lines 1-3):
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../current-user.type';
```

**Apply to `current-user.decorator.ts`:**
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from '../current-user.type';

export const GetCurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUser | null =>
    (ctx.switchToHttp().getRequest<{ user?: CurrentUser }>().user) ?? null,
);
```

**Note:** Name the export `GetCurrentUser` (not `CurrentUser`) to avoid collision with the type import of the same name. The CONTEXT.md uses `@CurrentUser()` as the ergonomic name — that is the decorator's usage, not its export name; re-export an alias or just name it `CurrentUser` in a separate namespace. Prefer `GetCurrentUser` export to avoid shadowing the type.

---

### `src/auth/auth.module.ts` (module)

**Analog:** `src/config/config.module.ts` (lines 1-17) for `@Global()` module with `imports`, `providers`, `exports`; `src/health/health.module.ts` (lines 1-11) for simple flat module.

**Global module pattern** (`src/config/config.module.ts`, lines 1-17):
```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

**Flat module pattern** (`src/health/health.module.ts`, lines 1-11):
```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
```

**Conditional provider via useFactory** — no existing analog in codebase for `useFactory` that returns different classes by env; the closest is `LoggerModule.forRootAsync` in `app.module.ts` (lines 37-69). Pattern to follow:
```typescript
{
  provide: TokenValidator,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) =>
    config.get('AUTH_MODE') === 'entra'
      ? new EntraTokenValidator(config)
      : new StubTokenValidator(),
},
```

**`AuthModule` does NOT use `@Global()`** — the guard is wired as `APP_GUARD` in `AppModule`, not exported from `AuthModule` for injection into domain modules (cyclic DI risk, CONTEXT.md Landmines).

---

### `src/auth/auth-audit-context-provider.ts` (service, provider)

**Analog:** `src/audit/noop-audit-context-provider.ts` (lines 1-13) — exact same role: concrete implementation of `IAuditContextProvider`.

**Full analog** (noop-audit-context-provider.ts, lines 1-13):
```typescript
import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from './audit-context-provider.interface';

@Injectable()
export class NoOpAuditContextProvider extends IAuditContextProvider {
  getContext(): AuditContext | null {
    return null;
  }
}
```

**Apply to `auth-audit-context-provider.ts`:** Add `ClsService` injection (already used in `GlobalExceptionFilter` constructor at `global-exception.filter.ts` lines 23-28):
```typescript
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';
import type { CurrentUser } from './current-user.type';

/**
 * D-04 (Phase 3 / Phase 4): Returns null — audit writes still skip without organizationId.
 * Phase 6 will supply organizationId. userId is available here but unused until Phase 6.
 */
@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) {
    super();
  }

  getContext(): AuditContext | null {
    // D-04: No organizationId yet — AuditInterceptor skips if organizationId is absent.
    // Phase 6 will provide organizationId and this can return { organizationId, userId }.
    return null;
  }
}
```

**ClsService injection** (`src/common/exceptions/global-exception.filter.ts`, lines 23-28):
```typescript
constructor(
  private readonly config: AppConfigService,
  private readonly cls: ClsService,
) {}
```

---

### `src/config/env.schema.ts` (modify — extend in-place)

**Analog:** The file itself (`src/config/env.schema.ts`, lines 1-14) — add new fields to the same `z.object({})` literal and chain `.superRefine()` after it.

**Current schema** (`src/config/env.schema.ts`, lines 1-14):
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  // Phase 3 additions (D-16):
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty comma-separated list'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;
```

**Field pattern to copy:** `CORS_ORIGINS: z.string().min(1, '...')` → copy for optional `ENTRA_*` vars with `.optional()`. `NODE_ENV: z.enum([...])` → copy for `AUTH_MODE: z.enum(['stub', 'entra'])`.

**Modification target** — replace `z.object({...})` with `z.object({...}).superRefine(...)`:
```typescript
// Phase 4 additions (D-05):
AUTH_MODE: z.enum(['stub', 'entra']).default('stub'),
ENTRA_TENANT_ID: z.string().min(1, 'ENTRA_TENANT_ID must be non-empty').optional(),
ENTRA_CLIENT_ID: z.string().min(1, 'ENTRA_CLIENT_ID must be non-empty').optional(),
ENTRA_AUDIENCE: z.string().min(1, 'ENTRA_AUDIENCE must be non-empty').optional(),
```

**superRefine chain** — appended after `z.object({...})`, before `export type Env`:
```typescript
export const envSchema = z.object({
  // ... existing fields ...
  // Phase 4 additions
  AUTH_MODE: z.enum(['stub', 'entra']).default('stub'),
  ENTRA_TENANT_ID: z.string().min(1, 'ENTRA_TENANT_ID must be non-empty').optional(),
  ENTRA_CLIENT_ID: z.string().min(1, 'ENTRA_CLIENT_ID must be non-empty').optional(),
  ENTRA_AUDIENCE: z.string().min(1, 'ENTRA_AUDIENCE must be non-empty').optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && data.AUTH_MODE === 'stub') {
    ctx.addIssue({
      code: 'custom',
      message: 'AUTH_MODE=stub is not permitted when NODE_ENV=production',
      path: ['AUTH_MODE'],
    });
  }
  if (data.AUTH_MODE === 'entra') {
    const required = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_AUDIENCE'] as const;
    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({
          code: 'custom',
          message: `${key} is required when AUTH_MODE=entra`,
          path: [key],
        });
      }
    }
  }
});
```

**Zod v4 note:** RESEARCH.md flags `z.ZodIssueCode.custom` as ASSUMED. The existing `env.schema.ts` uses `zod@^4.4.3`. Use `code: 'custom'` (string literal) rather than `z.ZodIssueCode.custom` to avoid the uncertain constant. Verify against `node_modules/zod/lib/ZodError.d.ts` at implementation time.

**`Env` type update** — `export type Env = z.infer<typeof envSchema>` moves below the `.superRefine()` chain; the inferred type automatically includes the optional new fields.

---

### `src/app.module.ts` (modify — add imports and providers)

**Analog:** The file itself (`src/app.module.ts`).

**APP_GUARD registration pattern** (`src/app.module.ts`, line 112):
```typescript
// Global rate-limit guard (INFRA-12 / D-15).
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

**Add JwtAuthGuard after ThrottlerGuard** — same `{ provide: APP_GUARD, useClass: ... }` shape, inserted immediately after line 112:
```typescript
{ provide: APP_GUARD, useClass: ThrottlerGuard },
// D-09 (Phase 4): JwtAuthGuard is second — ThrottlerGuard runs first to rate-limit all requests.
{ provide: APP_GUARD, useClass: JwtAuthGuard },
```

**IAuditContextProvider replacement** (`src/app.module.ts`, line 123):
```typescript
// Replace:
{ provide: IAuditContextProvider, useClass: NoOpAuditContextProvider },
// With:
{ provide: IAuditContextProvider, useClass: AuthAuditContextProvider },
```

**AuthModule import** — add `AuthModule` to `imports[]` array. `AuthModule` is NOT `@Global()` so it must be explicitly imported in `AppModule`.

**Imports to add** at top of file:
```typescript
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuthAuditContextProvider } from './auth/auth-audit-context-provider';
// Remove (or keep alongside for transition):
// import { NoOpAuditContextProvider } from './audit/noop-audit-context-provider';
```

---

### `src/health/health.controller.ts` (modify — add `@Public()`)

**Analog:** The file itself (`src/health/health.controller.ts`, lines 1-24). Add `@Public()` at the class level (line 8), mirroring how `@RawResponse()` is already applied at class level (line 7).

**Current class decorator** (`src/health/health.controller.ts`, lines 6-8):
```typescript
@Controller({ path: 'health', version: '1' })
@RawResponse()
export class HealthController {
```

**After modification:**
```typescript
import { Public } from '../auth/public.decorator';
// ...
@Controller({ path: 'health', version: '1' })
@RawResponse()
@Public()
export class HealthController {
```

**Placement:** `@Public()` goes after `@RawResponse()` (both are class-level decorators; order does not affect behavior for these two).

---

## Shared Patterns

### Abstract-class-as-DI-token
**Source:** `src/audit/audit-context-provider.interface.ts` lines 11-13 and `src/idempotency/idempotency-store.interface.ts` lines 8-12
**Apply to:** `token-validator.ts`

Naming convention in the project:
- `IAuditContextProvider` — prefixed `I` (legacy from Phase 3; kept for stability)
- `IdempotencyStore` — no prefix
- `TokenValidator` — no prefix (follow the newer convention)

Rule: export abstract class + export any related interfaces/types from the same file (see `AuditContext` + `IAuditContextProvider` co-located).

### SetMetadata decorator pattern
**Source:** `src/common/interceptors/raw-response.decorator.ts` lines 1-6 and `src/audit/audit.decorator.ts` lines 1-12
**Apply to:** `public.decorator.ts`

Convention: export the string key constant alongside the decorator factory function. Guards and interceptors import the constant, not a magic string.

### Injectable extends abstract
**Source:** `src/audit/noop-audit-context-provider.ts` lines 1-13
**Apply to:** `stub-token-validator.ts`, `auth-audit-context-provider.ts`, `entra-token-validator.ts`

Convention: `@Injectable()` decorator, `extends AbstractClass`, JSDoc comment explaining the role and what phase replaces it.

### APP_GUARD / APP_FILTER / APP_INTERCEPTOR registration
**Source:** `src/app.module.ts` lines 88-127
**Apply to:** `app.module.ts` modification

The `providers[]` array uses `{ provide: APP_*, useClass: X }` objects with ORDER MATTERS comments. Always add a comment explaining registration order when adding a second entry for the same `APP_*` token.

### Reflector.getAllAndOverride for metadata bypass
**Source:** `src/common/interceptors/audit.interceptor.ts` line 20 (`reflector.get`), NestJS pattern
**Apply to:** `jwt-auth.guard.ts`

The existing codebase uses `reflector.get(KEY, handler)` (single target). The guard uses `reflector.getAllAndOverride(KEY, [handler, class])` — two targets — so class-level `@Public()` on `HealthController` is respected even without method-level decoration.

### ClsService injection
**Source:** `src/common/exceptions/global-exception.filter.ts` lines 23-28 (constructor injection), `src/app.module.ts` lines 40-41 (useFactory injection)
**Apply to:** `auth-audit-context-provider.ts`, `jwt-auth.guard.ts`

`ClsService` is globally available via `ClsModule.forRoot({ global: true })`. No need to import `ClsModule` in `AuthModule`.

### Error codes as namespaced strings
**Source:** `src/common/exceptions/error-codes.ts` and `src/common/exceptions/global-exception.filter.ts`
**Apply to:** `jwt-auth.guard.ts`, `entra-token-validator.ts`, `stub-token-validator.ts`

Pattern: `throw new UnauthorizedException('AUTH.MISSING_TOKEN')` — the message string uses `DOMAIN.SNAKE_CASE` format. The `GlobalExceptionFilter` surfaces this as `message` in the envelope JSON response.

### Integration test setup
**Source:** `src/app.integration.spec.ts` lines 1-20, 46-66
**Apply to:** Phase 4 integration test additions in `app.integration.spec.ts`

Bootstrap pattern: set `process.env` before imports, use `Test.createTestingModule({ imports: [AppModule] })`, override modules. For Phase 4: also set `process.env['AUTH_MODE'] = 'stub'` before the module compiles.

---

## No Analog Found

All 12 files have analogs. The `EntraTokenValidator` external library usage (jwks-rsa, jsonwebtoken) has no direct codebase analog — planner must use RESEARCH.md Pattern 3 (lines 278-350) for the JWKS + jwt.verify implementation details.

---

## Metadata

**Analog search scope:** `packages/backend/src/` — all `.ts` files (34 files scanned)
**Pattern extraction date:** 2026-07-01
**Key files read:** `audit-context-provider.interface.ts`, `noop-audit-context-provider.ts`, `idempotency-store.interface.ts`, `noop-idempotency-store.ts`, `app.module.ts`, `env.schema.ts`, `env.schema.spec.ts`, `health.controller.ts`, `health.module.ts`, `config.module.ts`, `app-config.service.ts`, `raw-response.decorator.ts`, `audit.decorator.ts`, `idempotency.decorator.ts`, `audit.interceptor.ts`, `global-exception.filter.ts`, `app.integration.spec.ts`, `main.ts`
