# Phase 3: Platform Kernel — Observability, Validation, Security & Health — Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 25 (6 modified, 19 new)
**Analogs found:** 25 / 25 (all have at least a partial match in the Phase 2 codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main.ts` | config/bootstrap | request-response | `src/main.ts` (self) | exact — modify in place |
| `src/app.module.ts` | module | request-response | `src/app.module.ts` (self) | exact — modify in place |
| `src/common/middleware/correlation-id.middleware.ts` | middleware | request-response | `src/common/middleware/correlation-id.middleware.ts` (self) | exact — simplify in place |
| `src/common/middleware/extract-correlation-id.ts` | utility | transform | `src/common/middleware/correlation-id.middleware.ts` | exact — extract functions that already exist there |
| `src/common/exceptions/global-exception.filter.ts` | filter | request-response | `src/common/exceptions/global-exception.filter.ts` (self) | exact — one-line change |
| `src/common/exceptions/global-exception.filter.spec.ts` | test | — | `src/common/exceptions/global-exception.filter.spec.ts` (self) | exact — update mock setup |
| `src/config/env.schema.ts` | config | validation | `src/config/env.schema.ts` (self) | exact — add fields to `z.object({})` |
| `src/common/interceptors/response-envelope.interceptor.ts` | interceptor | request-response | `src/common/exceptions/global-exception.filter.ts` | role-match — same DI constructor, same response-shaping pattern, same `@Injectable()` global provider |
| `src/common/interceptors/response-envelope.interceptor.spec.ts` | test | — | `src/common/exceptions/global-exception.filter.spec.ts` | role-match — same mock-host unit test pattern |
| `src/common/interceptors/audit.interceptor.ts` | interceptor | event-driven | `src/common/exceptions/prisma-exception.filter.ts` | role-match — both inject PrismaService, check metadata, conditionally act on request/response |
| `src/common/interceptors/audit.interceptor.spec.ts` | test | — | `src/common/exceptions/global-exception.filter.spec.ts` | role-match — same mock-host, vi.fn() spy pattern for injectable |
| `src/common/interceptors/raw-response.decorator.ts` | decorator | metadata | `src/common/exceptions/error-codes.ts` | partial — same const + type export shape; no existing SetMetadata decorator to copy |
| `src/common/pagination/cursor-pagination.dto.ts` | DTO | CRUD | `src/config/env.schema.ts` | partial — closest typed/validated input schema; no class-validator DTOs exist yet |
| `src/common/pagination/pagination-meta.interface.ts` | type | — | `src/common/exceptions/error-codes.ts` | partial — same const + derived-type export pattern |
| `src/common/error-catalog/create-error-catalog.ts` | utility | transform | `src/common/exceptions/error-codes.ts` | exact — this file formalizes exactly the pattern found there |
| `src/audit/audit.decorator.ts` | decorator | metadata | `src/common/exceptions/error-codes.ts` | partial — const + type shape; follows same naming convention; no existing SetMetadata decorator to copy |
| `src/audit/audit-context-provider.interface.ts` | provider/interface | — | `src/config/app-config.service.ts` | partial — abstract class pattern; injectable service role |
| `src/audit/noop-audit-context-provider.ts` | provider | — | `src/config/app-config.service.ts` | partial — `@Injectable()` class with a single public method |
| `src/health/health.controller.ts` | controller | request-response | `src/common/exceptions/global-exception.filter.ts` | partial — injectable, DI constructor, reads ClsService; no existing controllers in codebase |
| `src/health/health.controller.spec.ts` | test | — | `src/app.integration.spec.ts` | role-match — supertest-based integration test with mock module override |
| `src/health/health.module.ts` | module | — | `src/config/config.module.ts` | exact — same `@Module({ imports, controllers, providers })` declaration pattern |
| `src/health/prisma-health.indicator.ts` | service | CRUD | `src/common/exceptions/prisma-exception.filter.ts` | role-match — same PrismaService injection, same try/catch pattern for DB operation |
| `src/idempotency/idempotency.decorator.ts` | decorator | metadata | `src/common/exceptions/error-codes.ts` | partial — same const + type export pattern |
| `src/idempotency/idempotency-store.interface.ts` | provider/interface | — | `src/config/app-config.service.ts` | partial — abstract class pattern used as DI token |
| `src/idempotency/noop-idempotency-store.ts` | provider | — | `src/config/app-config.service.ts` | partial — `@Injectable()` class implementing abstract seam |

---

## Pattern Assignments

### `src/main.ts` (bootstrap, request-response) — MODIFIED

**Analog:** `src/main.ts` (self — lines 1–19)

**Current bootstrap pattern** (lines 1–19):
```typescript
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  await app.listen(config.get('PORT'));
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
```

**Phase 3 additions** (insert before `await app.listen()`; keep existing prefix/versioning lines unchanged):
- `NestFactory.create(AppModule, { bufferLogs: true })` — required so pino captures bootstrap logs
- `app.use(helmet())` — first middleware, before CORS
- `app.enableCors({ origin: config.get('CORS_ORIGINS').split(',').map(s => s.trim()), ... })`
- `if (!config.isProduction) { SwaggerModule.setup(...) }` — env-gate via existing `isProduction` getter
- `app.enableShutdownHooks()` — INFRA-13; Prisma disconnect is already in `@repo/database`
- `app.useLogger(app.get(Logger))` — replace `console.error` in catch with pino

**Key import to add:** `import { Logger } from 'nestjs-pino'` and `import helmet from 'helmet'` and `import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'`

---

### `src/app.module.ts` (module, request-response) — MODIFIED

**Analog:** `src/app.module.ts` (self — lines 1–26)

**Current APP_FILTER registration pattern** (lines 11–20):
```typescript
providers: [
  // ORDER MATTERS: NestJS executes APP_FILTERs in reverse registration order,
  // so the last-registered filter has highest priority.
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
],
```

**Phase 3 additions follow this exact same `{ provide: APP_*, use* }` style.** New providers to append in order:
```typescript
// Pipe (after filters)
{ provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }) },
// Guard
{ provide: APP_GUARD, useClass: ThrottlerGuard },
// Interceptors — ORDER MATTERS (response-side is LIFO; last-registered = closest to handler on response path)
{ provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },  // outermost on response
{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor },             // closest to handler on response
// Audit seam (no-op provider; Phase 4/6 replaces useClass)
{ provide: IAuditContextProvider, useClass: NoOpAuditContextProvider },
```

**Current middleware wiring pattern** (lines 22–26):
```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```
This `configure()` block remains. `CorrelationIdMiddleware` stays mounted for `req.traceId` backward compat; ClsMiddleware is mounted via `ClsModule.forRoot({ middleware: { mount: true } })` in `imports[]`.

**New imports to add to `imports[]`** (order is critical — ClsModule before LoggerModule):
```typescript
imports: [
  AppConfigModule,   // 1st: unchanged
  ClsModule.forRoot({ global: true, middleware: { mount: true, generateId: true, idGenerator: (req) => extractCorrelationId(req) } }),
  LoggerModule.forRootAsync({ ... }),   // 2nd: after Cls
  ThrottlerModule.forRootAsync({ ... }),
  PrismaModule,      // unchanged
  HealthModule,
],
```

---

### `src/common/middleware/correlation-id.middleware.ts` (middleware, request-response) — MODIFIED

**Analog:** itself (lines 1–35)

**Functions to extract into `extract-correlation-id.ts`** (lines 5–23):
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractSafeTraceId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const candidate = raw.trim().slice(0, 128);
  return UUID_RE.test(candidate) ? candidate : undefined;
}

function extractTraceparentId(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split('-');
  const traceHex = parts[1];
  if (!traceHex) return undefined;
  if (!/^[0-9a-f]{32}$/i.test(traceHex)) return undefined;
  return `${traceHex.slice(0, 8)}-${traceHex.slice(8, 12)}-${traceHex.slice(12, 16)}-${traceHex.slice(16, 20)}-${traceHex.slice(20)}`;
}
```

**Phase 3 change to `use()` method:** After ClsModule mounts and sets `cls.getId()`, the middleware body simplifies to:
```typescript
// BEFORE (Phase 2 lines 27–35):
req.traceId = rawId ?? crypto.randomUUID();
next();

// AFTER (Phase 3): ClsMiddleware already set the ALS id via idGenerator.
// This middleware now just syncs req.traceId for backward compat.
req.traceId = cls.getId();
next();
```
The `ClsService` is injected into the constructor. The extraction logic moves to `extract-correlation-id.ts` and is called from `ClsModule.forRoot` idGenerator instead.

---

### `src/common/middleware/extract-correlation-id.ts` (utility, transform) — NEW

**Analog:** `src/common/middleware/correlation-id.middleware.ts` lines 5–30

**Pattern:** Extract the three standalone functions from the middleware into a standalone exported utility. No class, no decorator, no `@Injectable()`. The `extractCorrelationId(req)` function is the public API; the two helper functions remain private (unexported).

**Imports:** None (pure functions using `crypto.randomUUID()` from Node built-in).

---

### `src/common/exceptions/global-exception.filter.ts` (filter, request-response) — MODIFIED

**Analog:** itself (lines 1–65)

**Surgical change — lines 29 and 56 only:**

Line 29 (constructor):
```typescript
// BEFORE:
constructor(private readonly config: AppConfigService) {}

// AFTER (add ClsService injection):
constructor(
  private readonly config: AppConfigService,
  private readonly cls: ClsService,
) {}
```

Line 56 (`body` object):
```typescript
// BEFORE:
traceId: request.traceId ?? crypto.randomUUID(),

// AFTER:
traceId: this.cls.getId() ?? crypto.randomUUID(),
```

The `request` variable (line 29) can remain for `req.ip` usage but the `traceId` property access is removed. All other lines are untouched.

**New import to add at top:** `import { ClsService } from 'nestjs-cls';`

---

### `src/common/exceptions/global-exception.filter.spec.ts` (test) — MODIFIED

**Analog:** itself (lines 1–122)

**Change pattern:** The `makeHost()` factory at line 7 passes `traceId` via `getRequest()`. After the Phase 3 change, the filter reads traceId from `cls.getId()` instead of `request.traceId`. The mock setup must change:

```typescript
// BEFORE (lines 7–13): traceId passed via request object
function makeHost(traceId?: string): any {
  const getRequest = vi.fn().mockReturnValue({ traceId });
  ...
}
function makeConfig(isProduction = false): any {
  return { isProduction };
}

// AFTER: add ClsService mock as second constructor arg
function makeHost(): any {
  const getRequest = vi.fn().mockReturnValue({});  // no traceId on request
  ...
}
function makeCls(id = 'test-id'): any {
  return { getId: vi.fn().mockReturnValue(id) };
}
// filter = new GlobalExceptionFilter(makeConfig(), makeCls('test-uuid'))
```

All test assertion logic remains the same; only the construction changes.

---

### `src/config/env.schema.ts` (config, validation) — MODIFIED

**Analog:** itself (lines 1–9)

**Current pattern** (lines 1–9):
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
});

export type Env = z.infer<typeof envSchema>;
```

**Phase 3 additions** (append inside `z.object({})`, preserving existing fields unchanged):
```typescript
  // Phase 3 additions (D-16):
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty comma-separated list'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
```

Copy the `z.coerce.number().int().positive().default(...)` shape from the existing `PORT` field. Copy the `.default('...')` chaining pattern from `NODE_ENV`.

---

### `src/common/interceptors/response-envelope.interceptor.ts` (interceptor, request-response) — NEW

**Analog:** `src/common/exceptions/global-exception.filter.ts`

**Imports pattern** (copy from `global-exception.filter.ts` lines 1–12, adapt for interceptor):
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
```

**DI constructor pattern** (mirrors `global-exception.filter.ts` lines 23–24 constructor pattern):
```typescript
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}
```

**Core pattern** — check metadata flag (same style as filter checking `isHttp`), then map response:
```typescript
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) return next.handle();

    return next.handle().pipe(
      map((data) => {
        // Detect paginated result shape { data, meta } from handler
        const isPaginated =
          data !== null &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data;
        return {
          success: true,
          data: isPaginated ? (data as { data: unknown }).data : (data ?? null),
          meta: isPaginated ? (data as { meta: unknown }).meta : null,
          traceId: this.cls.getId(),
        };
      }),
    );
  }
```

**Registration** (in `app.module.ts` providers, exactly like `APP_FILTER` pattern):
```typescript
{ provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
```

---

### `src/common/interceptors/response-envelope.interceptor.spec.ts` (test) — NEW

**Analog:** `src/common/exceptions/global-exception.filter.spec.ts` (lines 1–122)

**Test structure pattern** (copy `makeHost()` factory pattern from lines 7–13, adapt for interceptor's `ExecutionContext`):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

function makeContext(handler: object, controllerClass = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({ getResponse: vi.fn(), getRequest: vi.fn() }),
  } as unknown as ExecutionContext;
}

function makeCallHandler(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

function makeReflector(isRaw = false): any {
  return { getAllAndOverride: vi.fn().mockReturnValue(isRaw) };
}

function makeCls(id = 'test-trace-id'): any {
  return { getId: vi.fn().mockReturnValue(id) };
}
```

**Assertions follow** `global-exception.filter.spec.ts` style: construct interceptor, call `intercept()`, subscribe to Observable, assert on emitted value shape.

---

### `src/common/interceptors/audit.interceptor.ts` (interceptor, event-driven) — NEW

**Analog (for PrismaService injection):** `src/common/exceptions/prisma-exception.filter.ts` lines 1–11

**Imports pattern:**
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '@repo/database';
import { IAuditContextProvider } from '../../audit/audit-context-provider.interface';
import { AUDIT_KEY, AuditMeta } from '../../audit/audit.decorator';
```

**DI constructor** (copy injection style from `prisma-exception.filter.ts` line 28 `catch()` method which directly uses `host.switchToHttp()` — same approach for request access):
```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditContextProvider: IAuditContextProvider,
    private readonly prisma: PrismaService,
  ) {}
```

**Core pattern** (D-03: fire after success, never block; D-04: skip if no org context):
```typescript
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!auditMeta) return next.handle();  // not decorated — pass through

    const req = context.switchToHttp().getRequest<{ ip?: string; headers: Record<string, string | undefined> }>();

    return next.handle().pipe(
      tap({ next: () => void this.writeAuditLog(auditMeta, req) }),
      // tap({ error }) is intentionally omitted — audit only on success (D-03)
    );
  }

  private writeAuditLog(meta: AuditMeta, req: { ip?: string; headers: Record<string, string | undefined> }): void {
    const ctx = this.auditContextProvider.getContext();
    if (!ctx?.organizationId) return;  // D-04: no org context — skip silently

    this.prisma.auditLog
      .create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: meta.action,
          resource: meta.resource,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      })
      .catch((err: unknown) => this.logger.error(err, 'AuditInterceptor: write failed'));
    // D-03: fire-and-forget — promise is not awaited; error is logged, not thrown
  }
```

---

### `src/common/interceptors/audit.interceptor.spec.ts` (test) — NEW

**Analog:** `src/common/exceptions/global-exception.filter.spec.ts` (lines 1–122)

**Key test seams** (from RESEARCH.md Validation Architecture § Test Seams):
- Fake `IAuditContextProvider` returning real org context: `{ getContext: () => ({ organizationId: 'org-1', userId: 'user-1' }) }`
- Fake `IAuditContextProvider` returning null: `{ getContext: () => null }` — asserts `prisma.auditLog.create` not called
- Fake `PrismaService` where `auditLog.create` throws — asserts response still succeeds (error logged, not thrown)

**Mock factory pattern** (copy `vi.fn()` spy pattern from filter spec lines 7–13):
```typescript
function makePrisma(shouldThrow = false): any {
  const create = shouldThrow
    ? vi.fn().mockRejectedValue(new Error('DB error'))
    : vi.fn().mockResolvedValue({});
  return { auditLog: { create } };
}

function makeContext(hasAuditMeta: boolean): ExecutionContext {
  return { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ ip: '127.0.0.1', headers: { 'user-agent': 'test' } }) }) } as unknown as ExecutionContext;
}
```

---

### `src/common/interceptors/raw-response.decorator.ts` (decorator, metadata) — NEW

**Analog:** `src/common/exceptions/error-codes.ts` (lines 1–8, const + type export shape)

**Pattern** (const key + factory function export — minimal, no class):
```typescript
import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';

export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);
```

No `@Injectable()`, no class — same minimal const + export style as `error-codes.ts`.

---

### `src/common/pagination/cursor-pagination.dto.ts` (DTO, CRUD) — NEW

**Analog (closest for validated input schema shape):** `src/config/env.schema.ts` lines 3–7

**Pattern note:** No existing class-validator DTOs in the codebase. The `env.schema.ts` uses Zod for validated input; the DTO uses class-validator decorators. The structural pattern is the same — a typed input container with constraints. Copy the constraint composition style (chained validators = chained `.coerce().int().min().max()`).

```typescript
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

**Location:** `src/common/pagination/` — convention: DTOs in `common/` when shared across all 14 domains.

---

### `src/common/pagination/pagination-meta.interface.ts` (type) — NEW

**Analog:** `src/common/exceptions/error-codes.ts` lines 7–8

**Pattern** (derived-type export — const object + `typeof` derivation):
```typescript
// error-codes.ts (lines 7–8):
export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];
```

**For pagination-meta** (simpler — plain interface, no const needed):
```typescript
export interface PaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
```

---

### `src/common/error-catalog/create-error-catalog.ts` (utility, transform) — NEW

**Analog:** `src/common/exceptions/error-codes.ts` (lines 1–8) — this utility formalizes exactly the pattern shown there

**Pattern being formalized** (from `error-codes.ts` lines 1–6):
```typescript
// The manual pattern this function replaces:
export const PLATFORM_ERROR_CODES = {
  RESOURCE_CONFLICT: 'PLATFORM.RESOURCE_CONFLICT',
  NOT_FOUND: 'PLATFORM.NOT_FOUND',
  VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR',
  INTERNAL_ERROR: 'PLATFORM.INTERNAL_ERROR',
} as const;
```

**The utility that generates this pattern for any domain:**
```typescript
export function createErrorCatalog<const T extends string>(
  prefix: string,
  codes: readonly T[],
): { [K in T]: `${string}.${K}` } {
  return Object.fromEntries(
    codes.map((c) => [c, `${prefix}.${c}`]),
  ) as { [K in T]: `${string}.${K}` };
}

export type DomainErrorCode = `${string}.${string}`;
```

**Note:** The existing `PLATFORM_ERROR_CODES` in `error-codes.ts` is NOT converted — it stays as-is (D-10 says the catalog is decentralized; the existing const is the template). New domains call `createErrorCatalog('AUTH', [...])`.

---

### `src/audit/audit.decorator.ts` (decorator, metadata) — NEW

**Analog:** `src/common/exceptions/error-codes.ts` (const + type pattern, lines 1–8)

**Pattern** (const key + factory function + interface for metadata, same style as `error-codes.ts` exporting const + type):
```typescript
import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@repo/database';

export const AUDIT_KEY = 'AUDIT';

export interface AuditMeta {
  action: AuditAction;
  resource: string;
}

export const Audit = (action: AuditAction, resource: string): MethodDecorator =>
  SetMetadata(AUDIT_KEY, { action, resource });
```

**Import note:** `AuditAction` comes from `@repo/database` (the generated Prisma enum). Check `@repo/database` barrel exports to confirm `AuditAction` is re-exported.

---

### `src/audit/audit-context-provider.interface.ts` (interface/provider seam) — NEW

**Analog:** `src/config/app-config.service.ts` (abstract class pattern — lines 1–16)

**Pattern** (use abstract class as DI token, same pattern as NestJS recommends for pluggable providers):
```typescript
import { Injectable } from '@nestjs/common';

export interface AuditContext {
  organizationId: string;
  userId?: string;
}

// Abstract class used as DI token (not interface) so it can be injected via NestJS DI
export abstract class IAuditContextProvider {
  abstract getContext(): AuditContext | null;
}
```

**Why abstract class, not interface:** NestJS DI cannot inject TypeScript interfaces at runtime (they are erased). Abstract classes survive compilation and serve as injection tokens. Same reason `AppConfigService` is a class, not an interface.

---

### `src/audit/noop-audit-context-provider.ts` (provider, no-op) — NEW

**Analog:** `src/config/app-config.service.ts` lines 1–16 (`@Injectable()` class with constructor and methods)

**Pattern:**
```typescript
import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from './audit-context-provider.interface';

@Injectable()
export class NoOpAuditContextProvider extends IAuditContextProvider {
  // D-01: No-op implementation. Phase 4 (principal) and Phase 6 (tenant context)
  // replace this via { provide: IAuditContextProvider, useClass: RealProvider } in AppModule.
  getContext(): AuditContext | null {
    return null;  // D-04: always null this phase; interceptor skips write cleanly
  }
}
```

---

### `src/health/health.controller.ts` (controller, request-response) — NEW

**Analog (DI injection pattern):** `src/common/exceptions/global-exception.filter.ts` lines 23–24 (constructor injection)
**Note:** No existing controllers in the codebase. The injection and class decorator pattern follows the filter analog.

**Class decorator pattern** (mirrors `@Catch()` + `@Injectable()` style from filter):
```typescript
import { Controller, Get, Version } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RawResponse } from '../common/interceptors/raw-response.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@Controller('health')
@Version('1')
@RawResponse()   // bypass ResponseEnvelopeInterceptor for all methods (Pitfall 4 prevention)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('prisma'),
    ]);
  }
}
```

**Routes:** `GET /api/v1/health/liveness` and `GET /api/v1/health/readiness`

---

### `src/health/health.controller.spec.ts` (test) — NEW

**Analog:** `src/app.integration.spec.ts` (lines 1–72)

**Test module setup pattern** (copy `beforeAll/afterAll` + `Test.createTestingModule` + `overrideModule` pattern from lines 18–36):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from './health.module';
// ...

// Satisfy env schema before compile()
process.env['DATABASE_URL'] = 'postgresql://mock:mock@localhost:5432/mock';
process.env['CORS_ORIGINS'] = 'http://localhost:3001';

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [{ '?column?': 1 }] })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health/liveness returns 200', () => request(app.getHttpServer()).get('/api/v1/health/liveness').expect(200));
  it('GET /api/v1/health/readiness returns 200 when DB healthy', () => request(app.getHttpServer()).get('/api/v1/health/readiness').expect(200));
});
```

---

### `src/health/health.module.ts` (module) — NEW

**Analog:** `src/config/config.module.ts` (lines 1–17)

**Current module declaration pattern** (lines 1–17):
```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ ... })],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

**Health module follows the same `@Module({ imports, controllers, providers })` structure** without `@Global()`:
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

---

### `src/health/prisma-health.indicator.ts` (service, CRUD) — NEW

**Analog:** `src/common/exceptions/prisma-exception.filter.ts` lines 26–45 (PrismaService injection + try/catch DB operation)

**PrismaService injection pattern** (from `prisma-exception.filter.ts` — inject via constructor, use in method):
```typescript
// prisma-exception.filter.ts (line 28):
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    // ... uses exception directly, no PrismaService injection (catches errors)
  }
}
```

**For health indicator**, PrismaService is explicitly injected (same injection style as `config.module.ts` exports `AppConfigService`):
```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '@repo/database';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthIndicatorService,  // terminus 11 new API — NOT HealthIndicator class
  ) {}

  async isHealthy(key: string) {
    const indicator = this.health.check(key);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
```

**Critical note:** Use `HealthIndicatorService` (terminus 11+), NOT the deprecated `HealthIndicator` class or `HealthCheckError`. See RESEARCH.md Pattern 5.

---

### `src/idempotency/idempotency.decorator.ts` (decorator, metadata) — NEW

**Analog:** `src/common/exceptions/error-codes.ts` (const + type pattern)

**Pattern** (minimal const + SetMetadata export, same style as `raw-response.decorator.ts` and `audit.decorator.ts`):
```typescript
import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_KEY = 'IDEMPOTENCY_KEY';

export const IdempotencyKey = (): MethodDecorator =>
  SetMetadata(IDEMPOTENCY_KEY, true);
```

---

### `src/idempotency/idempotency-store.interface.ts` (interface/seam) — NEW

**Analog:** `src/audit/audit-context-provider.interface.ts` (same abstract class DI token pattern)

**Pattern** (abstract class as DI token, same reasoning as audit seam — interfaces are erased at runtime):
```typescript
export abstract class IdempotencyStore {
  abstract get(key: string): Promise<unknown | undefined>;
  abstract set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}
```

---

### `src/idempotency/noop-idempotency-store.ts` (provider, no-op) — NEW

**Analog:** `src/audit/noop-audit-context-provider.ts` (`@Injectable()` class extending abstract seam)

**Pattern** (D-09: in-memory Map — single-instance, documented as not production-complete):
```typescript
import { Injectable } from '@nestjs/common';
import { IdempotencyStore } from './idempotency-store.interface';

// WARNING: In-memory, single-instance only. Not suitable for multi-replica deployments.
// Replace with a Redis-backed implementation when shared infra is available (D-09).
@Injectable()
export class NoOpIdempotencyStore extends IdempotencyStore {
  private readonly store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
```

---

## Shared Patterns

### DI Provider Registration — `APP_FILTER` / `APP_PIPE` / `APP_GUARD` / `APP_INTERCEPTOR`

**Source:** `src/app.module.ts` lines 11–20
**Apply to:** All new global cross-cutting providers (ValidationPipe, ThrottlerGuard, ResponseEnvelopeInterceptor, AuditInterceptor)

```typescript
// From app.module.ts lines 18–19 — THE canonical pattern for all global providers:
{ provide: APP_FILTER, useClass: GlobalExceptionFilter },
{ provide: APP_FILTER, useClass: PrismaExceptionFilter },

// New providers follow identical structure:
{ provide: APP_PIPE,        useValue: new ValidationPipe({ ... }) },
{ provide: APP_GUARD,       useClass: ThrottlerGuard },
{ provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
```

**Ordering rule:** `APP_FILTER` registration order matters (last = highest priority). `APP_INTERCEPTOR` registration order matters (last-registered = first on response path / LIFO). Keep comments in code explaining the ordering.

---

### Injectable Class Constructor Injection

**Source:** `src/common/exceptions/global-exception.filter.ts` lines 22–24
**Apply to:** All new `@Injectable()` classes (interceptors, indicators, providers)

```typescript
// From global-exception.filter.ts lines 22–24:
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}
```

Pattern: `private readonly` params in constructor, no field declarations. Every new injectable follows this style.

---

### Production Environment Gate

**Source:** `src/common/exceptions/global-exception.filter.ts` lines 58–60 + `src/config/app-config.service.ts` lines 13–15
**Apply to:** Swagger setup in `main.ts` (D-14), stack trace in filter (unchanged)

```typescript
// From global-exception.filter.ts lines 58–60:
if (!this.config.isProduction && exception instanceof Error) {
  body['stack'] = exception.stack;
}

// From app-config.service.ts lines 13–15:
get isProduction(): boolean {
  return this.get('NODE_ENV') === 'production';
}
```

Use `config.isProduction` (not `process.env.NODE_ENV === 'production'`) to gate Swagger and stack traces.

---

### Unit Test Mock Factory Pattern

**Source:** `src/common/exceptions/global-exception.filter.spec.ts` lines 7–16
**Apply to:** All new unit test files (interceptor specs, decorator tests)

```typescript
// From global-exception.filter.spec.ts lines 7–16:
function makeHost(traceId?: string): any {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const getRequest = vi.fn().mockReturnValue({ traceId });
  return { switchToHttp: () => ({ getResponse, getRequest }) };
}

function makeConfig(isProduction = false): any {
  return { isProduction };
}
```

Pattern: standalone factory functions (not class-based mocks), `vi.fn()` chained with `.mockReturnValue()`, `any` return type to keep test code lean. All new specs copy this factory-function pattern.

---

### Integration Test Module Override Pattern

**Source:** `src/app.integration.spec.ts` lines 12–37
**Apply to:** `health.controller.spec.ts` and future integration specs

```typescript
// From app.integration.spec.ts lines 12–37:
@Module({
  providers: [{ provide: PrismaService, useValue: { onModuleInit: async () => {} } }],
  exports: [PrismaService],
})
class MockPrismaModule {}

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideModule(PrismaModule)
  .useModule(MockPrismaModule)
  .compile();

// Also set env vars before compile():
process.env['DATABASE_URL'] = '...';
process.env['NODE_ENV'] = 'test';
```

**Phase 3 addition:** Health controller spec will also need `process.env['CORS_ORIGINS']` set before `compile()` since the extended env schema requires it.

---

### Zod Schema Field Addition

**Source:** `src/config/env.schema.ts` lines 3–7
**Apply to:** Extension of `env.schema.ts` with 4 new fields

```typescript
// Existing fields as template (lines 4–7):
NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
PORT: z.coerce.number().int().min(1).max(65535).default(3000),
DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

// New fields copy the `.coerce().int().positive().default()` pattern from PORT
// and the `.enum([...]).default()` pattern from NODE_ENV
```

---

### Error Catalog Const + Type Pattern

**Source:** `src/common/exceptions/error-codes.ts` lines 1–8
**Apply to:** `create-error-catalog.ts` as the formalized version; all future domain error code files

```typescript
// From error-codes.ts lines 1–8 — the template to generalize:
export const PLATFORM_ERROR_CODES = {
  RESOURCE_CONFLICT: 'PLATFORM.RESOURCE_CONFLICT',
  NOT_FOUND: 'PLATFORM.NOT_FOUND',
  VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR',
  INTERNAL_ERROR: 'PLATFORM.INTERNAL_ERROR',
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];
```

`createErrorCatalog('AUTH', ['INVALID_TOKEN', ...] as const)` produces an equivalent structure. Existing `PLATFORM_ERROR_CODES` stays unchanged (D-10).

---

## No Analog Found

No files in this phase are completely without a codebase analog. All files have at least a partial match. The files with no existing counterpart for the specific mechanism (but clear structural analog) are:

| File | Role | Data Flow | Reason for Partial-Only Match |
|------|------|-----------|-------------------------------|
| `src/common/interceptors/response-envelope.interceptor.ts` | interceptor | request-response | No existing NestJS interceptors in codebase; filter pattern is the closest structural analog |
| `src/common/interceptors/audit.interceptor.ts` | interceptor | event-driven | Same as above; additionally introduces RxJS `tap()` fire-and-forget pattern not seen in Phase 2 |
| `src/health/health.controller.ts` | controller | request-response | No existing controllers in codebase; filter injection pattern is structural analog |
| `src/common/pagination/cursor-pagination.dto.ts` | DTO | CRUD | No class-validator DTOs exist yet; `env.schema.ts` is structural (typed input schema) but uses different library |
| `src/idempotency/*.ts` | seam | — | Entire idempotency seam is new; abstract class + no-op pattern is analogous to audit seam |

For these files, the RESEARCH.md Pattern sections (Patterns 2–7) provide the concrete implementation to copy, supplemented by the shared DI and class structure patterns extracted above.

---

## Metadata

**Analog search scope:** `packages/backend/src/` (15 TypeScript files — complete Phase 2 output)
**Files scanned:** 15
**Pattern extraction date:** 2026-07-01

**Critical ordering constraints identified:**
1. `ClsModule.forRoot` must appear before `LoggerModule.forRootAsync` in `AppModule.imports[]` — middleware execution order
2. `APP_INTERCEPTOR` providers: `ResponseEnvelopeInterceptor` before `AuditInterceptor` — LIFO response path
3. `APP_FILTER` providers: `GlobalExceptionFilter` before `PrismaExceptionFilter` — reverse priority order (unchanged from Phase 2)
4. `app.use(helmet())` before `app.enableCors()` before `SwaggerModule.setup()` in `main.ts`

**AuditLog FK constraint (landmine):** `organizationId` is non-nullable. `NoOpAuditContextProvider.getContext()` returns `null`. `AuditInterceptor.writeAuditLog()` must check `ctx?.organizationId` and return early. Never write a placeholder org id. This is enforced by D-04 and tested via the fake-provider seam in `audit.interceptor.spec.ts`.
