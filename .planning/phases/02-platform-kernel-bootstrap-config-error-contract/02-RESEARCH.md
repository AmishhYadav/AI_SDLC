# Phase 2: Platform Kernel — Bootstrap, Config & Error Contract - Research

**Researched:** 2026-06-30
**Domain:** NestJS 11 bootstrap, typed configuration with Zod fail-fast validation, global exception filters, Prisma error mapping, ESLint enforcement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error Envelope — traceId origin (INFRA-05)**
- D-01: A request middleware generates a v4 UUID per request, but adopts an inbound correlation header if present (`x-request-id`, falling back to W3C `traceparent`). The id is stored on the request and surfaced as `traceId` in the error envelope.
- D-02: Deliberate seam for Phase 3: when INFRA-04 lands the AsyncLocalStorage correlation-ID infrastructure, generation moves into the ALS correlation middleware and the exception filter reads from ALS. Do not ship a null/placeholder traceId; the contract must be whole at end of this phase.

**Error Envelope — errorCode taxonomy (INFRA-05)**
- D-03: errorCodes are namespaced, single-level, dotted UPPER_SNAKE: `PREFIX.CODE` (e.g. `PLATFORM.RESOURCE_CONFLICT`, `PLATFORM.NOT_FOUND`, `PLATFORM.VALIDATION_ERROR`, `PLATFORM.INTERNAL_ERROR`).
- D-04: The kernel's own cross-cutting codes use the `PLATFORM` prefix.
- D-05: This phase only mints the handful of generic codes the global filter and Prisma mapper need. The formal error-code catalog (a TS enum/const) is Phase 3 / SEAM-06; define the codes here in a way that catalog can absorb without renaming.

**Configuration (INFRA-02, INFRA-03)**
- D-06: Use `@nestjs/config` with a Zod `validate()` for fail-fast startup validation, env namespaced via `registerAs`, wrapped by a thin typed `AppConfigService` so callers get full type safety and `process.env` never leaks past the config module.
- D-07: Required env set that must fail-fast this phase: `DATABASE_URL`, `PORT` (default `3000`), `NODE_ENV`.
- D-08: INFRA-03 enforcement (lint-ban `process.env` outside the config module) is wired into the existing ESLint 9 flat config. The precise rule mechanism is Claude's discretion.

**Prisma Error Mapping (INFRA-06, INFRA-14)**
- D-09: A dedicated Prisma exception mapper/filter (not inline in the general filter) maps `P2002`→409 and `P2025`→404, with any other `PrismaClientKnownRequestError`→500, sanitized. Scope is exactly the success criteria; broader codes are added per-domain when a real endpoint exercises them.
- D-10: Prisma is reached solely through the existing `@repo/database` `PrismaService` (already global). No new PrismaClient instantiation, no schema changes.

### Claude's Discretion
- Global filter registration pattern (`APP_FILTER` provider for DI/testability vs `app.useGlobalFilters` in `main.ts`) — prefer the DI-friendly approach unless research finds a reason otherwise.
- Exact Zod schema strictness/flags and the `registerAs` namespace breakdown (e.g. `server` / `database` / `app`).
- Correlation-middleware registration mechanism and where the request-id is stashed (request object vs a request-scoped holder) given it will migrate to ALS in Phase 3.
- `main.ts` bootstrap specifics (versioning config object, port binding from typed config).

### Deferred Ideas (OUT OF SCOPE)
- AsyncLocalStorage correlation-ID infrastructure (INFRA-04) — Phase 3.
- Formal error-code catalog as a TS enum/const, plus pagination and idempotency-key conventions (SEAM-06) — Phase 3.
- Validation pipe, response/audit interceptors, health checks, Swagger, Helmet/CORS/rate-limit, graceful shutdown lifecycle (INFRA-07–13) — Phase 3.
- Broader Prisma error-code mappings (P2003, P2000/P2006, P2014, …) — add per-domain when a real endpoint needs them.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | NestJS application bootstraps and serves all routes under `/api/v1` (URI versioning) | URI versioning via `setGlobalPrefix('api')` + `enableVersioning({ type: VersioningType.URI })` + `@Controller({ version: '1' })` |
| INFRA-02 | All configuration is loaded through a typed config service with fail-fast env validation (Zod) at startup | `ConfigModule.forRoot({ validate: env => schema.parse(env) })` + thin `AppConfigService` wrapper with `ConfigService<Env, true>` |
| INFRA-03 | Direct `process.env` access is lint-banned outside the config module | `no-restricted-properties` rule in ESLint flat config with file-glob override for the config directory |
| INFRA-05 | A single global exception filter returns a consistent error envelope `{ success, errorCode, message, traceId }` | `APP_FILTER` DI registration of `@Catch()` global filter; correlation middleware stamps request with traceId |
| INFRA-06 | The exception filter maps Prisma errors to HTTP status (P2002→409, P2025→404) and never leaks stack traces in production | Dedicated `@Catch(Prisma.PrismaClientKnownRequestError)` filter; `PrismaClientKnownRequestError` available via `@repo/database` barrel |
| INFRA-14 | Prisma is integrated solely through the existing `@repo/database` package with zero schema changes | `PrismaModule` is `@Global()` — import once in `AppModule`; no new PrismaClient instantiation; Prisma error types importable from `@repo/database` |
</phase_requirements>

---

## Summary

Phase 2 installs the cross-cutting kernel that every later domain inherits: the NestJS application boots, routes are served under `/api/v1`, configuration is validated at startup via Zod, every error returns a single envelope, Prisma errors map to standard HTTP status, and Prisma access is enforced through the `@repo/database` package boundary. Phase 1 has already delivered the ESLint 9 flat config, Vitest 4, SWC builder, and Turborepo CI gate that this phase plugs into — no new tooling infrastructure is needed.

The stack for this phase is narrow and well-understood: `@nestjs/config@4.0.4` (compatible with NestJS 11), `zod@4.4.3` (latest stable), `@nestjs/platform-express@11.1.27`, and Node's built-in `crypto.randomUUID()` (no uuid package). `PrismaClientKnownRequestError` is already re-exported through `@repo/database`'s barrel (`export * from '../generated/client'`), so no new Prisma imports are needed.

The key architectural insight is that two separate exception filters — one global (`@Catch()`) and one Prisma-specific (`@Catch(Prisma.PrismaClientKnownRequestError)`) — both registered via the DI-friendly `APP_FILTER` provider pattern, give testability and correct execution order. The Prisma filter registers last (so it takes priority) and the global filter catches everything else. The traceId correlation middleware is a thin request middleware that stashes an ID on the `req` object; Phase 3 migrates this seam to AsyncLocalStorage without changing the envelope contract.

**Primary recommendation:** Use `@nestjs/config` + Zod validate() for fail-fast config, two APP_FILTER providers for the exception chain, a plain NestJS middleware for traceId, and `no-restricted-properties` in ESLint flat config for the process.env ban.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App bootstrap + URI versioning | API / Backend | — | `main.ts` entry point; `enableVersioning` is Express router config |
| Configuration loading + Zod validation | API / Backend | — | Runs at server startup; entirely server-side |
| `process.env` lint enforcement | Build/Lint | — | ESLint rule; enforced at CI not runtime |
| Error envelope production | API / Backend | — | NestJS exception filters execute in the request pipeline |
| Prisma error → HTTP status mapping | API / Backend | Database/Storage | Maps DB-layer errors to HTTP responses at the API boundary |
| traceId generation + propagation | API / Backend | — | NestJS middleware runs per-request before the route handler |
| `@repo/database` boundary enforcement | Database/Storage | API / Backend | Package import discipline + lint rule for future phases |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/platform-express` | 11.1.27 | HTTP adapter (Express under NestJS) | Standard HTTP adapter for NestJS; required for `NestFactory.create` and request/response objects |
| `@nestjs/config` | 4.0.4 | Configuration module with `forRoot`, `registerAs`, `ConfigService` | Official NestJS configuration package; supports `validate()` hook for fail-fast Zod parsing |
| `zod` | 4.4.3 | Schema definition and runtime validation | Industry-standard schema library; `schema.parse()` throws on invalid input, satisfying fail-fast requirement |

[VERIFIED: npm registry] — all three packages confirmed via `npm view` on 2026-06-30; source repos confirmed as official NestJS org (`github.com/nestjs/*`) and `github.com/colinhacks/zod`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` | Node built-in (≥14.17) | Generate v4 UUID for traceId | Always — Node 22 (pinned via `.nvmrc`) has this built-in; no package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nestjs/config` | Hand-rolled ConfigModule | `@nestjs/config` integrates with NestJS DI and forRoot/forFeature patterns; no hand-rolling needed for this feature set |
| Zod `parse()` in `validate()` | `class-validator` + `@IsNotEmpty` | Zod gives zero-dependency type inference (`z.infer<typeof schema>`) with no decorator ceremony; class-validator requires class definitions |
| `crypto.randomUUID()` | `uuid` npm package | `uuid` package is unnecessary — Node 22 ships `crypto.randomUUID()` natively |
| `APP_FILTER` provider | `app.useGlobalFilters()` in main.ts | `APP_FILTER` allows DI injection (e.g., `AppConfigService` to read `NODE_ENV`); `useGlobalFilters` runs outside the DI container [CITED: docs.nestjs.com/exception-filters] |

**Installation:**
```bash
npm install --save @nestjs/platform-express @nestjs/config zod --workspace packages/backend
```

**Version verification (run before install):**
```bash
npm view @nestjs/platform-express version   # → 11.1.27
npm view @nestjs/config version             # → 4.0.4
npm view zod version                        # → 4.4.3
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages are tagged `[ASSUMED]` below. The planner MUST add a `checkpoint:human-verify` task before any install step, per the graceful-degradation rule.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@nestjs/platform-express` | npm | ~7 yrs (2018) | Very high (core NestJS) | github.com/nestjs/nest | N/A (unavailable) | [ASSUMED] — approved; official NestJS org |
| `@nestjs/config` | npm | ~6 yrs (2019) | Very high (official package) | github.com/nestjs/config | N/A (unavailable) | [ASSUMED] — approved; official NestJS org |
| `zod` | npm | ~6 yrs (2020) | Very high (>15M/wk) | github.com/colinhacks/zod | N/A (unavailable) | [ASSUMED] — approved; widely-used official package |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**No postinstall scripts detected** (checked `npm view` for each package — no `scripts.postinstall` fields returned)

*slopcheck was unavailable at research time — all packages above are tagged `[ASSUMED]`. The planner must gate each install behind a `checkpoint:human-verify` task.*

---

## Architecture Patterns

### System Architecture Diagram

```
Inbound HTTP Request
        │
        ▼
[Correlation Middleware]
  reads x-request-id / traceparent header
  or generates crypto.randomUUID()
  → stamps req.traceId
        │
        ▼
[NestJS Router — global prefix /api, URI versioning /v1]
        │
        ▼
[Route Handler (Controller → Service → @repo/database → DB)]
        │
   ┌────┴──────────────────────────────────────┐
   │ Happy path                                 │ Error path
   ▼                                            ▼
[Response]                      ┌──────────────────────────────────┐
                                │ PrismaExceptionFilter            │
                                │  @Catch(PrismaClientKnownRequestError) │
                                │  P2002 → 409 PLATFORM.RESOURCE_CONFLICT │
                                │  P2025 → 404 PLATFORM.NOT_FOUND  │
                                │  other → 500 PLATFORM.INTERNAL_ERROR │
                                └──────────────┬───────────────────┘
                                               │ (falls through for non-Prisma)
                                               ▼
                                ┌──────────────────────────────────┐
                                │ GlobalExceptionFilter            │
                                │  @Catch()  (catches all)         │
                                │  HttpException → pass-through status │
                                │  unknown → 500 PLATFORM.INTERNAL_ERROR │
                                │  NODE_ENV=production → strip stack │
                                └──────────────┬───────────────────┘
                                               │
                                               ▼
                                { success: false, errorCode, message, traceId }
```

### Recommended Project Structure

```
packages/backend/src/
├── main.ts                                  # Bootstrap: platform-express, setGlobalPrefix, enableVersioning
├── app.module.ts                            # Root module: imports ConfigModule, PrismaModule, CorrelationModule
├── config/
│   ├── env.schema.ts                        # Zod schema + Env type alias (z.infer)
│   ├── app-config.service.ts               # Thin typed wrapper: ConfigService<Env, true>
│   └── config.module.ts                    # ConfigModule.forRoot({ isGlobal: true, validate })
└── common/
    ├── exceptions/
    │   ├── error-codes.ts                  # PLATFORM_ERROR_CODES const object
    │   ├── global-exception.filter.ts      # @Catch() — all exceptions → envelope
    │   └── prisma-exception.filter.ts      # @Catch(Prisma.PrismaClientKnownRequestError)
    └── middleware/
        └── correlation-id.middleware.ts    # Reads x-request-id / traceparent / uuid → req.traceId
```

### Pattern 1: URI Versioning Under /api/v1

**What:** `setGlobalPrefix('api')` + `enableVersioning({ type: VersioningType.URI })` in `main.ts`. All controllers declare `version: '1'` on `@Controller`. The `v` prefix is added automatically by NestJS.

**When to use:** All controllers in this phase and every future domain.

**Order is critical:** Call `setGlobalPrefix` before `enableVersioning` — a known NestJS router ordering issue causes unexpected behavior if reversed.

```typescript
// Source: github.com/nestjs/docs.nestjs.com/blob/master/content/techniques/versioning.md [CITED]
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');                          // MUST come first
  app.enableVersioning({ type: VersioningType.URI });  // auto-adds /v prefix
  await app.listen(configService.get('PORT'));
}
bootstrap();
```

```typescript
// Controllers declare their version explicitly
@Controller({ version: '1', path: 'health' })
export class HealthController {
  @Get()
  check() { ... }
}
// Routes: GET /api/v1/health
```

### Pattern 2: Zod Fail-Fast Config with Typed Service

**What:** `ConfigModule.forRoot({ isGlobal: true, validate })` where `validate` calls `schema.parse()`. A thin `AppConfigService` wraps `ConfigService<Env, true>` providing IDE autocomplete and type inference. `process.env` is never accessed outside this module.

**Namespace breakdown (Claude's discretion):** Use a single flat Zod schema for Phase 2's minimal env set (`DATABASE_URL`, `PORT`, `NODE_ENV`). The `registerAs()` factory adds a typed accessor for the config values.

```typescript
// config/env.schema.ts
// Source: medium.com/nestjs-ninja/creating-a-configuration-module-like-a-specialist-with-zod-inside-nestjs [CITED]
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
```

```typescript
// config/app-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
```

```typescript
// config/config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),  // throws ZodError on invalid input → fail-fast
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

### Pattern 3: Global Exception Filter with APP_FILTER

**What:** Registers the exception filter via the NestJS DI container so it can inject services (e.g., `AppConfigService` for `NODE_ENV`). Two filters, registered in order: global first, Prisma second (reverse execution order — Prisma filter runs first).

```typescript
// common/exceptions/error-codes.ts
export const PLATFORM_ERROR_CODES = {
  RESOURCE_CONFLICT: 'PLATFORM.RESOURCE_CONFLICT',
  NOT_FOUND: 'PLATFORM.NOT_FOUND',
  VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR',
  INTERNAL_ERROR: 'PLATFORM.INTERNAL_ERROR',
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];
```

```typescript
// common/exceptions/global-exception.filter.ts
// Source: docs.nestjs.com/exception-filters [CITED]
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES } from './error-codes';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode = isHttp
      ? PLATFORM_ERROR_CODES.INTERNAL_ERROR  // refined per-exception type as needed
      : PLATFORM_ERROR_CODES.INTERNAL_ERROR;
    const message = isHttp
      ? (exception.getResponse() as Record<string, unknown>)['message'] ?? exception.message
      : 'An unexpected error occurred';

    response.status(status).json({
      success: false,
      errorCode,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      traceId: request.traceId ?? 'unknown',
      ...(this.config.isProduction ? {} : { stack: exception instanceof Error ? exception.stack : undefined }),
    });
  }
}
```

```typescript
// app.module.ts — register both filters as APP_FILTER providers
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { PrismaExceptionFilter } from './common/exceptions/prisma-exception.filter';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },   // registered first → runs second
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },   // registered second → runs first
  ],
})
export class AppModule {}
```

### Pattern 4: Prisma Exception Filter

**What:** Catches `Prisma.PrismaClientKnownRequestError` before the global filter. Maps P2002→409, P2025→404, everything else→500. Imports the error class from `@repo/database` (which barrel-exports it via `export * from '../generated/client'`).

```typescript
// common/exceptions/prisma-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@repo/database';   // PrismaClientKnownRequestError re-exported from generated client
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES } from './error-codes';

const PRISMA_HTTP_MAP: Record<string, { status: number; errorCode: string; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT,   errorCode: PLATFORM_ERROR_CODES.RESOURCE_CONFLICT, message: 'Resource already exists' },
  P2025: { status: HttpStatus.NOT_FOUND,  errorCode: PLATFORM_ERROR_CODES.NOT_FOUND,          message: 'Resource not found' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
@Injectable()
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const mapped = PRISMA_HTTP_MAP[exception.code];
    const status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode = mapped?.errorCode ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR;
    const message = mapped?.message ?? 'Database operation failed';

    response.status(status).json({
      success: false,
      errorCode,
      message,
      traceId: request.traceId ?? 'unknown',
    });
  }
}
```

### Pattern 5: Correlation-ID Middleware

**What:** NestJS `NestMiddleware` that runs before routing. Reads `x-request-id` header first, then `traceparent` (W3C trace-context), then generates `crypto.randomUUID()`. Stores result on `request.traceId`. The exception filters read `request.traceId`.

**Phase 3 seam:** When AsyncLocalStorage lands (INFRA-04), the ALS middleware replaces this one. The exception filter switches from `request.traceId` to reading from the ALS store. The envelope contract (`{ ..., traceId }`) does not change.

```typescript
// common/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    const fromHeader =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['traceparent'] as string | undefined);

    req.traceId = fromHeader ?? crypto.randomUUID();
    next();
  }
}
```

```typescript
// app.module.ts — apply middleware to all routes
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

### Pattern 6: ESLint process.env Ban

**What:** In the existing `eslint.config.mjs` (ESLint 9 flat config), add a `no-restricted-properties` rule to ban `process.env` access everywhere, with a file-glob override that disables the rule in the config module directory. This plugs directly into the existing CI gate (Phase 1 TOOL-03).

```javascript
// eslint.config.mjs — add to the existing array
// Source: eslint.org/docs/latest/rules/no-restricted-properties [CITED]

// ... existing config objects above ...
{
  // Applied to all TS files across the monorepo
  files: ['**/*.ts'],
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'process',
        property: 'env',
        message: 'Access process.env only through AppConfigService (packages/backend/src/config/). See INFRA-03.',
      },
    ],
  },
},
{
  // Config module is the ONLY allowed escape hatch
  files: ['packages/backend/src/config/**/*.ts'],
  rules: {
    'no-restricted-properties': 'off',
  },
},
```

### Anti-Patterns to Avoid

- **`app.useGlobalFilters(new Filter())` in main.ts**: The filter cannot use DI (cannot inject `AppConfigService` to read NODE_ENV). Always use `APP_FILTER` for filters that need dependencies.
- **`enableVersioning` before `setGlobalPrefix`**: A known NestJS routing ordering bug causes incorrect URI construction. Always call `setGlobalPrefix` first.
- **`import { PrismaClient } from '@prisma/client'` in backend modules**: Violates INFRA-14. Always import through `@repo/database`. This will be enforced by `no-restricted-imports` in a later phase (SCAF-04) but must be followed by convention now.
- **Inline `process.env.X` inside service files**: Violates INFRA-03. All env access flows through `AppConfigService.get()`.
- **`const { stack }` in production JSON responses**: NODE_ENV gate must suppress stack traces. The global filter branches on `config.isProduction` before including stack in the response body.
- **`z.string().email()` Zod v3 API in v4**: Zod 4 (in use) moved format validators to top-level functions. Use `z.email()` not `z.string().email()`. For Phase 2's env schema this doesn't apply (only `z.string()`, `z.enum()`, `z.coerce.number()`), but note for future use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config loading + validation | Custom `dotenv` + class-validator logic | `@nestjs/config` + `zod.parse()` | DI integration, `isGlobal`, `registerAs`, typed ConfigService — hand-rolling duplicates all this |
| env var type coercion | Manual `parseInt(process.env.PORT)` | `z.coerce.number()` in Zod schema | Coercion + bounds validation in one declaration; errors surface as structured ZodErrors at startup |
| UUID generation | `uuid` npm package | `crypto.randomUUID()` (Node 22 built-in) | Zero dependency; Node 22 ships it natively; identical output |
| Prisma error mapping | Per-service try/catch with code checks | Dedicated `PrismaExceptionFilter` with `@Catch(Prisma.PrismaClientKnownRequestError)` | Centralizes mapping; impossible to forget in a new endpoint; tested once |

**Key insight:** The `@nestjs/config` + Zod pattern is well-established (the NestJS docs explicitly support the `validate()` function hook). Replacing it with custom code adds maintenance surface for zero benefit.

---

## Common Pitfalls

### Pitfall 1: setGlobalPrefix / enableVersioning Order

**What goes wrong:** Routes are registered as `/v1/api/...` instead of `/api/v1/...`, or versioning silently doesn't apply.

**Why it happens:** NestJS resolves the route pattern at registration time; calling `enableVersioning` before `setGlobalPrefix` causes the version segment to be prepended before the prefix. [CITED: github.com/nestjs/nest/issues/10566]

**How to avoid:** Always call `setGlobalPrefix('api')` first, then `enableVersioning({ type: VersioningType.URI })`.

**Warning signs:** A GET to `/api/v1/health` returns 404 even though the controller is registered; a GET to `/v1/api/health` returns 200.

---

### Pitfall 2: APP_FILTER Execution Order (Reversed)

**What goes wrong:** The Prisma filter catches `PrismaClientKnownRequestError` but the global filter runs first and swallows it as a generic 500 before the Prisma filter sees it.

**Why it happens:** NestJS executes `APP_FILTER` providers in **reverse registration order** — the last registered filter runs first. [ASSUMED — documented community pattern; verify against NestJS 11 docs at implementation time]

**How to avoid:** Register `GlobalExceptionFilter` first in the `providers` array, `PrismaExceptionFilter` second. The Prisma filter executes first, handles Prisma errors, and the global filter handles everything else.

**Warning signs:** A Prisma P2002 unique constraint violation returns a 500 instead of 409.

---

### Pitfall 3: Zod parse() vs safeParse() in the validate() Hook

**What goes wrong:** Using `safeParse()` in the `validate` callback — the app starts despite invalid config because `safeParse` returns `{ success: false, error }` instead of throwing.

**Why it happens:** The `validate` function in `ConfigModule.forRoot` is expected to throw on invalid input to abort startup. `safeParse` does not throw.

**How to avoid:** Use `envSchema.parse(env)` (not `safeParse`). The thrown `ZodError` causes NestJS to log the validation failure and exit with a non-zero code.

**Warning signs:** The application starts despite a missing `DATABASE_URL`; Prisma fails to connect at runtime instead of at startup.

---

### Pitfall 4: Stack Traces in Production

**What goes wrong:** Production errors include `stack` in the JSON response, leaking internal file paths and line numbers.

**Why it happens:** The exception filter includes `exception.stack` unconditionally.

**How to avoid:** Gate the `stack` field on `!this.config.isProduction`. The `AppConfigService.isProduction` getter reads `NODE_ENV` from the validated config (not from `process.env` directly, honoring INFRA-03).

**Warning signs:** A 500 response in a production-like environment includes a `stack` key in the JSON body.

---

### Pitfall 5: traceId as null in Error Envelope

**What goes wrong:** `traceId` is `null`, `undefined`, or the string `"unknown"` in the error response, violating the contract.

**Why it happens:** The correlation middleware isn't applied for all routes, or it applies after the exception filter runs.

**How to avoid:** Register `CorrelationIdMiddleware` with `.forRoutes('*')` (wildcard, all routes). NestJS middleware runs before route handlers and before exception filters read the request. Verify in integration test: a request to a non-existent route (404) still includes a valid UUID in `traceId`.

**Warning signs:** Error responses have `"traceId": null` or `"traceId": "unknown"`.

---

### Pitfall 6: Importing Prisma Error Classes Incorrectly

**What goes wrong:** `import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'` — a path that may not be stable across Prisma versions, and that bypasses the `@repo/database` boundary.

**Why it happens:** Community examples use `@prisma/client` or its runtime paths directly.

**How to avoid:** Import `Prisma` namespace from `@repo/database`: `import { Prisma } from '@repo/database'`. The barrel export (`export * from '../generated/client'`) re-exports the `Prisma` namespace including `Prisma.PrismaClientKnownRequestError`. Verified by inspecting `packages/database/generated/client/index.d.ts`.

**Warning signs:** TypeScript compilation errors after a Prisma version bump; import resolves to a different path than the database package's generated client.

---

### Pitfall 7: Zod v4 Breaking Changes vs v3 Muscle Memory

**What goes wrong:** Code uses Zod v3 chain API (e.g., `z.string().email()`, `z.object().strict()`) which is deprecated or changed in Zod v4.

**Why it happens:** The project uses Zod 4.4.3. Many tutorials and community examples still use Zod v3 patterns.

**Key v4 changes affecting this phase:** [CITED: zod.dev/v4/changelog]
- `z.string().email()` → `z.email()` (string format validators are now top-level)
- `z.object().strict()` → `z.strictObject()`
- Error messages changed: "Required" → "expected {type}, received undefined"

**How to avoid:** For Phase 2's env schema (`DATABASE_URL`, `PORT`, `NODE_ENV`), none of these apply — only `z.string()`, `z.enum()`, `z.coerce.number()` are used. Note this for future phases that use format validators.

---

## Code Examples

### main.ts Bootstrap

```typescript
// packages/backend/src/main.ts
// Source: github.com/nestjs/docs.nestjs.com versioning.md [CITED]
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(AppConfigService);

  // setGlobalPrefix MUST precede enableVersioning (ordering bug if reversed)
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  const port = configService.get('PORT');
  await app.listen(port);
}

bootstrap();
```

### Zod Schema (Phase 2 minimal env set)

```typescript
// packages/backend/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

export type Env = z.infer<typeof envSchema>;
```

### PLATFORM_ERROR_CODES const

```typescript
// packages/backend/src/common/exceptions/error-codes.ts
// D-05: Defined as const object so Phase 3 error catalog can absorb without renaming
export const PLATFORM_ERROR_CODES = {
  RESOURCE_CONFLICT: 'PLATFORM.RESOURCE_CONFLICT',
  NOT_FOUND: 'PLATFORM.NOT_FOUND',
  VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR',
  INTERNAL_ERROR: 'PLATFORM.INTERNAL_ERROR',
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.useGlobalFilters()` in main.ts | `APP_FILTER` DI provider in module | NestJS docs recommend DI approach | Filters can inject services (config, logger) |
| `joi` for env validation | `zod` with `validate()` hook | Ecosystem shift ~2022 | Type inference; no class definitions needed |
| `uuid` npm package | `crypto.randomUUID()` | Node 14.17+ (stable in Node 17+) | Zero dependency; identical output |
| Zod v3 chained format validators (`z.string().email()`) | Zod v4 top-level (`z.email()`) | Zod 4.0 (2025) | Breaking change; v4 is faster (6.5x for object parsing) |

**Deprecated/outdated:**
- `@nestjs/config` `validationSchema` Joi option: Was the original approach; replaced by the `validate()` function hook which works with any validation library including Zod.
- `app.useGlobalFilters(new Filter())` with dependencies: Requires manual constructor injection; DI is not available at main.ts bootstrap level.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `APP_FILTER` providers execute in reverse registration order (last registered = first to execute) | Architecture Patterns, Pitfall 2 | Prisma filter and global filter may not execute in the correct order; P2002/P2025 errors return 500 instead of 409/404 |
| A2 | `@nestjs/platform-express`, `@nestjs/config`, `zod` are legitimate packages with no suspicious postinstall scripts | Package Legitimacy Audit | Supply chain risk if any package is compromised (low probability given age and download volume) |
| A3 | Phase 1 delivery included a working ESLint 9 flat config at `eslint.config.mjs` and a Turborepo CI gate | Project Constraints | If Phase 1 is incomplete, the process.env ban (INFRA-03) cannot plug into the CI gate without additional setup |

**If this table has items:** Confirm A1 (filter execution order) by consulting NestJS 11 source or docs before finalizing plan. A2 is mitigated by running slopcheck at plan time. A3 should be verifiable by running `npm run lint` in the repo before implementation starts.

---

## Open Questions

1. **Should `@nestjs/platform-express` be a peerDependency or dependency in `packages/backend/package.json`?**
   - What we know: It is the HTTP adapter; `@nestjs/common` and `@nestjs/core` are already in `dependencies`.
   - What's unclear: NestJS CLI conventions differ on whether the adapter is a `dependency` or `devDependency`/`peerDependency`.
   - Recommendation: Add as a regular `dependency` — it is required at runtime for the server to boot.

2. **Does `CorrelationIdMiddleware` need to run before the NestJS exception filter can read `request.traceId`?**
   - What we know: NestJS middleware runs before route guards, interceptors, and filters.
   - What's unclear: The exact ordering guarantee in NestJS 11 when an error is thrown very early (before middleware completes).
   - Recommendation: Add an integration test verifying that a 404 response (no matching route) still includes a valid UUID `traceId` in the error envelope.

3. **`z.coerce.number()` for PORT — does it handle string `"3000"` from process.env correctly?**
   - What we know: `z.coerce.number()` calls `Number()` on the input. `Number("3000")` → `3000`. [CITED: zod.dev/v4]
   - What's unclear: Edge case behavior for `PORT=""` (empty string) — `Number("")` → `0`, which passes a min(1) check as false.
   - Recommendation: Use `z.coerce.number().int().min(1).max(65535).default(3000)` — the `min(1)` guard catches empty string coercion to 0.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | `crypto.randomUUID()` built-in | ✓ | v22.22.3 (pinned in `.nvmrc`) | — |
| npm 10 | Workspace resolution | ✓ | 10.9.8 | — |
| `@nestjs/cli` | `nest build` (Turborepo task) | ✓ | Installed in root `devDependencies` | — |
| GitHub Actions CI | ESLint lint gate (INFRA-03) | ✓ | `.github/workflows/ci.yml` present | — |

**Missing dependencies with no fallback:** None identified.

**Note:** `@nestjs/platform-express`, `@nestjs/config`, and `zod` are NOT yet in `packages/backend/package.json` — they are missing runtime deps that must be installed as part of this phase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 with SWC (via `unplugin-swc`) |
| Config file | `packages/backend/vitest.config.ts` (already present) |
| Quick run command | `npm run test --workspace packages/backend` |
| Full suite command | `npx turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | App boots and route `/api/v1/health` returns 200 | integration (supertest) | `vitest run --reporter=verbose` | ❌ Wave 0 |
| INFRA-02 | App refuses to start when `DATABASE_URL` is missing | unit (test validate fn) | `vitest run` | ❌ Wave 0 |
| INFRA-02 | App refuses to start when `PORT` is invalid | unit (test validate fn) | `vitest run` | ❌ Wave 0 |
| INFRA-03 | ESLint fails on `process.env` access outside config dir | lint (in CI gate) | `npm run lint` | ❌ Wave 0 (rule must be added) |
| INFRA-05 | Thrown `HttpException` returns `{ success, errorCode, message, traceId }` | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-05 | traceId is a valid UUID string (not null/undefined) | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-05 | `NODE_ENV=production` responses omit `stack` | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-06 | P2002 `PrismaClientKnownRequestError` returns 409 with `PLATFORM.RESOURCE_CONFLICT` | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-06 | P2025 `PrismaClientKnownRequestError` returns 404 with `PLATFORM.NOT_FOUND` | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-06 | Unknown Prisma error returns 500 with `PLATFORM.INTERNAL_ERROR` | unit (filter) | `vitest run` | ❌ Wave 0 |
| INFRA-14 | No direct `PrismaClient` instantiation in backend source | static (grep/lint) | `grep -r "new PrismaClient" packages/backend/src` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test --workspace packages/backend`
- **Per wave merge:** `npx turbo run lint typecheck test build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/src/config/env.schema.spec.ts` — covers INFRA-02 (validate function unit tests)
- [ ] `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` — covers INFRA-05
- [ ] `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` — covers INFRA-06
- [ ] `packages/backend/src/app.e2e-spec.ts` (or `app.integration.spec.ts`) — covers INFRA-01 (boot + route check)
- [ ] ESLint rule additions to `eslint.config.mjs` — covers INFRA-03

No new test framework installation needed — Vitest 4 + SWC is already wired in `packages/backend/vitest.config.ts`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Deferred to Phase 4 (AUTH) |
| V3 Session Management | no | Deferred to Phase 4 |
| V4 Access Control | no | Deferred to Phase 5 (RBAC) |
| V5 Input Validation | yes | Zod schema validation of all env vars at startup (`envSchema.parse()`); deferred for request DTOs to Phase 3 (INFRA-07) |
| V6 Cryptography | no | `crypto.randomUUID()` is a CSPRNG; no custom crypto |
| V7 Error Handling and Logging | yes | Exception filter suppresses stack traces in production (`NODE_ENV=production` branch) |
| V14 Configuration | yes | Fail-fast Zod validation prevents the app from booting with an invalid `DATABASE_URL`; `NODE_ENV` in required env set |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stack trace leakage in error response | Information Disclosure | Exception filter branches on `isProduction`; stack omitted in production JSON |
| Schema detail leakage in Prisma errors | Information Disclosure | Prisma filter returns fixed error messages; `exception.meta` (which contains table/field names) is never forwarded to the client |
| Missing env var causes undefined behavior | Tampering / Denial of Service | Zod fail-fast parse at startup aborts the process before it can serve requests |
| Direct `process.env` access bypassing validation | Tampering | `no-restricted-properties` lint rule in CI gate prevents accidental bypass |

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are binding for this phase:

| Directive | Constraint | Enforcement |
|-----------|-----------|-------------|
| §6 Architecture: Controllers orchestrate only | Exception filters, config service, and middleware must not contain business logic | Code review |
| §6 Services contain business logic | `AppConfigService` is a thin wrapper, not a logic container | Code review |
| §7 No magic strings | `PLATFORM.RESOURCE_CONFLICT` etc. must be constants, not inline literals | `error-codes.ts` pattern |
| §9 Request validation | Each endpoint must have validation; DTOs come in Phase 3 (INFRA-07) | Deferred per roadmap |
| §10 Prisma is single source of truth | No new `PrismaClient` instantiation; all access through `@repo/database` | INFRA-14 |
| §11 Never expose stack traces | Global exception filter must gate stack on `NODE_ENV` | Filter pattern above |
| §11 Never expose internal IDs unintentionally | Prisma error `meta` (table/field names) must not be forwarded | Prisma filter sanitizes |
| §15 Testing: every feature | Unit tests for config validation + exception filters; integration test for boot | Wave 0 gaps listed |
| §18 Definition of Done | Types compile, tests pass, lint passes before declaring complete | CI gate |
| §19 Production-ready | Fail-fast config, no stack in production, consistent error envelope | This phase scope |

---

## Sources

### Primary (HIGH confidence)
- `packages/database/src/index.ts` + `generated/client/index.d.ts` — verified that `Prisma` namespace (including `PrismaClientKnownRequestError`) is re-exported through `@repo/database` barrel
- `eslint.config.mjs` — verified existing ESLint 9 flat config structure; `no-restricted-properties` rule can be added as a new config object in the array
- `packages/backend/package.json` — verified missing runtime deps (`@nestjs/platform-express`, `@nestjs/config`, `zod`)
- `npm view @nestjs/config`, `npm view @nestjs/platform-express`, `npm view zod` — verified current versions and official source repos

### Secondary (MEDIUM confidence)
- [github.com/nestjs/docs.nestjs.com/blob/master/content/techniques/versioning.md](https://github.com/nestjs/docs.nestjs.com/blob/master/content/techniques/versioning.md) — URI versioning setup pattern
- [eslint.org/docs/latest/rules/no-restricted-properties](https://eslint.org/docs/latest/rules/no-restricted-properties) — rule syntax for banning `process.env`
- [medium.com/nestjs-ninja/creating-a-configuration-module-like-a-specialist-with-zod-inside-nestjs](https://medium.com/nestjs-ninja/creating-a-configuration-module-like-a-specialist-with-zod-inside-nestjs-c61430de896b) — Zod validate() + typed EnvService pattern
- [github.com/notiz-dev/nestjs-prisma/blob/main/lib/prisma-client-exception.filter.ts](https://github.com/notiz-dev/nestjs-prisma/blob/main/lib/prisma-client-exception.filter.ts) — Prisma exception filter structure (P2002/P2025 mapping)
- [zod.dev/v4/changelog](https://zod.dev/v4/changelog) — Zod v4 breaking changes

### Tertiary (LOW confidence / Assumed)
- APP_FILTER execution order (reverse registration) — [ASSUMED] based on community pattern; verify against NestJS 11 source before implementation
- NestJS middleware execution before exception filters in all error paths — [ASSUMED]; verify with integration test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, official NestJS + Zod packages, peer deps confirmed
- Architecture: HIGH — patterns from official NestJS docs and codebase inspection
- Pitfalls: MEDIUM — ordering issues cited from official NestJS GitHub issues; filter execution order is ASSUMED

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable ecosystem; NestJS 11 and Zod 4 are current releases)
