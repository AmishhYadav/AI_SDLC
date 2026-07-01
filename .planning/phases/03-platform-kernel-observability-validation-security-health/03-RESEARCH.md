# Phase 3: Platform Kernel — Observability, Validation, Security & Health — Research

**Researched:** 2026-07-01
**Domain:** NestJS 11 cross-cutting kernel — structured logging, validation, interceptors, health, Swagger, security baseline, shared conventions
**Confidence:** HIGH (core stack patterns) / MEDIUM (terminus new API, nestjs-cls ordering details)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audit logging (INFRA-09)**
- D-01: Ship as a true seam — audit interceptor + pluggable IAuditContextProvider interface. No-op provider now; real provider injected in Phase 4/6 with no interceptor changes.
- D-02: Opt-in via `@Audit(action: AuditAction, resource: string)` decorator on handlers.
- D-03: Audit write fires after handler succeeds and never blocks the request. Failure is logged at error level; does not fail the request.
- D-04: When context provider yields no `organizationId`, skip the write cleanly. Never fabricate an org id or throw.

**Success response envelope (INFRA-08)**
- D-05: `{ success: true, data, meta, traceId }` — symmetric with error envelope.
- D-06: `@RawResponse()` is an opt-out for Terminus health JSON, file/stream downloads, redirects.
- D-07: `traceId` is always present on success responses.

**SEAM-06 conventions**
- D-08: Cursor-based pagination — opaque cursor + limit; meta carries `nextCursor` / `hasNextPage`.
- D-09: Idempotency ships as convention + pluggable seam: `Idempotency-Key` header, decorator/interceptor, `IdempotencyStore` interface with no-op/in-memory now.
- D-10: Error catalog decentralized per-domain: each domain owns its own prefixed const object; a shared type/format helper enforces `PREFIX.CODE` dotted UPPER_SNAKE shape.

**Logging & correlation (INFRA-04)**
- D-11: Use `nestjs-pino` for structured JSON logging.
- D-12: Correlation id migrates into ALS-backed layer. Existing header extraction logic (`x-request-id` → `traceparent` → UUID) preserved. GlobalExceptionFilter reads traceId from ALS, not `req.traceId`.
- D-13: Redaction deny-list: `authorization`, `cookie`, `set-cookie`, `password`, `token`, `apiKey`, `secret`. Log `method`/`path`/`status`/`duration`/`traceId`. Do not log request bodies by default.

**Swagger & security baseline (INFRA-11, INFRA-12)**
- D-14: Swagger only when `NODE_ENV !== production`.
- D-15: CORS from required Zod-validated `CORS_ORIGINS` env var. Global `@nestjs/throttler` default ~100 req/min/IP; overridable per-route; in-memory storage.
- D-16: Extend Phase 2 Zod env schema with `CORS_ORIGINS`, `LOG_LEVEL`, throttler thresholds.

### Claude's Discretion
- Health checks: liveness always-200 and readiness = Prisma DB ping; keep minimal.
- Graceful shutdown: `app.enableShutdownHooks()`; Prisma already has `OnModuleDestroy` in `@repo/database` — wire lifecycle, do not add a second disconnect.
- Registration mechanism for global pipe/interceptors: prefer DI providers (`APP_PIPE`/`APP_INTERCEPTOR`) matching Phase 2 `APP_FILTER` pattern; mind interceptor execution order.
- Exact ValidationPipe flags (`whitelist`, `forbidNonWhitelisted`, `transform`, `transformOptions`) and where shared DTO base lives.
- ALS implementation (Node `AsyncLocalStorage` directly vs `nestjs-cls`) — must satisfy D-11/D-12.
- Exact `IdempotencyStore` interface shape and no-op/in-memory backing.

### Deferred Ideas (OUT OF SCOPE)
- Real audit actor/tenant-context provider — Phase 4/6.
- Persistent/distributed idempotency store and Redis-backed throttler storage — when Redis lands.
- Authenticated production Swagger docs portal.
- Broader Prisma error-code mappings and additional readiness indicators.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-04 | Structured JSON logs with per-request correlation ID via AsyncLocalStorage; auth headers/secrets redacted | nestjs-pino + nestjs-cls patterns documented in §Standard Stack and §Architecture Patterns |
| INFRA-07 | Global validation pipe rejecting unknown fields and transforming typed DTOs | ValidationPipe flags documented; class-validator/class-transformer versions verified |
| INFRA-08 | Response interceptor wrapping success in standard envelope; `@RawResponse()` escape hatch | APP_INTERCEPTOR pattern and interceptor ordering documented |
| INFRA-09 | Audit interceptor recording mutating operations to `AuditLog`; pluggable context provider seam | AuditLog model fields confirmed; IAuditContextProvider pattern documented |
| INFRA-10 | Liveness/readiness health via Terminus; readiness verifies DB connectivity | @nestjs/terminus 11 new HealthIndicatorService API documented |
| INFRA-11 | Swagger/OpenAPI for `/api/v1` surface; non-prod only | Non-prod gate pattern documented; swagger setup location (main.ts) confirmed |
| INFRA-12 | Security baseline: Helmet headers, CORS allowlist, request rate limiting | helmet + CORS + @nestjs/throttler v6 setup documented; middleware order pitfall documented |
| INFRA-13 | Graceful shutdown closing Prisma connection via lifecycle hook | `enableShutdownHooks()` + PrismaService OnModuleDestroy confirmed; no second disconnect needed |
| SEAM-06 | Shared conventions: cursor pagination, idempotency-key seam, per-domain error-code catalog | All three conventions documented with interface shapes and examples |
</phase_requirements>

---

## Summary

This phase completes the platform kernel by layering observability, validation, response shaping, audit, health probing, documentation, and security on top of the Phase 2 bootstrap. Every new cross-cutting concern registers via NestJS's DI-friendly `APP_*` token pattern (matching the existing `APP_FILTER` precedent) so that all components remain injectable and independently testable.

The most consequential architectural decision delegated to this research is the ALS implementation choice: **nestjs-cls is recommended over raw `AsyncLocalStorage`**. The reason is Phase 6 (TENANT-01) will need an ALS-backed request-scoped tenant context that is injectable everywhere — exactly what nestjs-cls provides via `ClsService`. Introducing it now means Phase 6 extends the same store rather than introducing a second ALS layer. The traceId becomes `cls.getId()`, and downstream phases add typed fields to the same store.

The key ordering risks are: (1) middleware execution order determines whether pino-http's `genReqId` sees the correlation ID correctly, and (2) APP_INTERCEPTOR response-side execution is LIFO — the last-registered interceptor runs first on the response path. Both are addressed explicitly in the patterns below.

**Primary recommendation:** Register `ClsModule.forRoot` before `LoggerModule` in AppModule imports so ClsMiddleware initializes the ALS store before pino-http's `genReqId` reads from it. Register `ResponseEnvelopeInterceptor` first and `AuditInterceptor` second so the audit interceptor runs closer to the handler on the response path (sees raw data before wrapping).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structured logging with correlation | API/Backend middleware | — | pino-http runs server-side per request; ALS is server-side only |
| Per-request traceId propagation | API/Backend middleware (nestjs-cls) | — | ALS context is process-scoped; no cross-process transfer |
| Validation and DTO transformation | API/Backend pipe | — | ValidationPipe runs in NestJS pipe layer, after guards |
| Success response envelope | API/Backend interceptor | — | ResponseEnvelopeInterceptor wraps handler output server-side |
| Audit write | API/Backend interceptor | Database (AuditLog) | AuditInterceptor triggers write; PrismaService persists |
| Health probing | API/Backend controller | Database (Prisma ping) | Terminus endpoint is HTTP; readiness pings DB |
| API documentation | API/Backend (non-prod) | — | SwaggerModule.setup() in main.ts, served by Express |
| Security headers | API/Backend middleware | — | Helmet runs as Express global middleware (app.use()) |
| CORS allowlist | API/Backend middleware | — | app.enableCors() at Express layer |
| Rate limiting | API/Backend guard | — | ThrottlerGuard runs in NestJS guard layer |
| Graceful shutdown | API/Backend lifecycle | Database | NestJS shutdown hooks; PrismaService.onModuleDestroy |
| Cursor pagination convention | API/Backend (shared DTO) | — | Importable DTO/type; no runtime enforcement layer |
| Idempotency seam | API/Backend interceptor (future) | Storage (future) | Header contract + no-op store now; store wired when infra lands |
| Error catalog convention | API/Backend (shared helper) | — | Compile-time type enforcement; no runtime registry |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nestjs-pino | 4.6.1 [ASSUMED] | Structured JSON logger for NestJS | ALS-backed per-request context, built-in redaction, replaces console/NestJS logger |
| pino | 10.3.1 [ASSUMED] | Underlying pino logger (peer dep) | Fastest JSON logger for Node.js |
| pino-http | 11.0.0 [ASSUMED] | HTTP middleware binding for pino (peer dep) | Required by nestjs-pino; provides per-request child logger |
| nestjs-cls | 6.2.1 [ASSUMED] | Continuation-local storage (ALS abstraction) | DI-injectable ALS; Phase 6 will extend same store for tenant context |
| @nestjs/terminus | 11.1.1 [ASSUMED] | Health check endpoints (liveness/readiness) | Official NestJS package; Kubernetes probe semantics; new HealthIndicatorService API in v11 |
| @nestjs/swagger | 11.4.5 [ASSUMED] | OpenAPI/Swagger documentation | Official NestJS package; code-generated from decorators |
| @nestjs/throttler | 6.5.0 [ASSUMED] | Request rate limiting | Official NestJS package; Redis-ready; APP_GUARD pattern |
| helmet | 8.2.0 [ASSUMED] | HTTP security headers | Industry standard; 30+ security headers maintained by helmetjs |
| class-validator | 0.15.1 [ASSUMED] | DTO validation decorators | Required peer dep for NestJS ValidationPipe |
| class-transformer | 0.5.1 [ASSUMED] | DTO class transformation | Required peer dep for NestJS ValidationPipe; pairs with class-validator |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/common `ValidationPipe` | bundled with @nestjs/common 11.x | NestJS built-in validation pipe | Use directly — no install needed; configure via APP_PIPE |
| @nestjs/common `SetMetadata` | bundled | Custom decorator backing | Used for `@RawResponse()`, `@Audit()`, `@IdempotencyKey()` decorators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nestjs-cls | Raw `AsyncLocalStorage` | Raw ALS has no DI integration; Phase 6 would need to introduce nestjs-cls anyway for tenant context |
| nestjs-pino | Winston + custom transport | nestjs-pino has native ALS, built-in redaction, automatic request logging; Winston requires more wiring |
| nestjs-pino | NestJS built-in Logger overriding | Built-in logger doesn't support JSON output or ALS-backed per-request context natively |
| @nestjs/terminus | Custom /health controller | Terminus handles probe semantics, serialization, and error states correctly; custom controller re-invents this |

**Installation:**
```bash
npm install nestjs-pino pino pino-http nestjs-cls @nestjs/terminus @nestjs/swagger @nestjs/throttler helmet class-validator class-transformer
```

**Version verification:** All versions confirmed via `npm view <pkg> version` on 2026-07-01.

---

## Package Legitimacy Audit

> slopcheck was not available at research time. All packages below are tagged `[ASSUMED]`. The planner must add a `checkpoint:human-verify` task before the install wave.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| nestjs-pino | npm | 6+ yrs (2019-09-17) | github.com/iamolegga/nestjs-pino | N/A | [ASSUMED] — verified GitHub repo from known author |
| pino | npm | 10+ yrs | github.com/pinojs/pino | N/A | [ASSUMED] — widely used; core pino package |
| pino-http | npm | established | github.com/pinojs/pino-http | N/A | [ASSUMED] — official pinojs org package |
| nestjs-cls | npm | 4+ yrs (2021-09-13) | github.com/Papooch/nestjs-cls | N/A | [ASSUMED] — known author; NestJS ecosystem |
| @nestjs/terminus | npm | 7+ yrs (2018-12-16) | github.com/nestjs/terminus | N/A | [ASSUMED] — official @nestjs org |
| @nestjs/swagger | npm | 8+ yrs (2017-10-01) | github.com/nestjs/swagger | N/A | [ASSUMED] — official @nestjs org |
| @nestjs/throttler | npm | 4+ yrs (2021-02-26) | github.com/nestjs/throttler | N/A | [ASSUMED] — official @nestjs org |
| helmet | npm | established | github.com/helmetjs/helmet | N/A | [ASSUMED] — official helmetjs org |
| class-validator | npm | 10+ yrs (2016-04-18) | github.com/typestack/class-validator | N/A | [ASSUMED] — typestack org; documented NestJS peer dep |
| class-transformer | npm | 9+ yrs (2016-07-25) | github.com/typestack/class-transformer | N/A | [ASSUMED] — typestack org; documented NestJS peer dep |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none identified by manual check

*slopcheck was unavailable. All packages are tagged [ASSUMED]. Planner must gate the install wave behind a `checkpoint:human-verify` task.*

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
  │
  ▼  ── app.use() — Express global middleware (registered in main.ts) ──
  ├─ helmet()          → sets security headers (CSP, HSTS, X-Frame-Options, etc.)
  ├─ app.enableCors()  → origin allowlist from CORS_ORIGINS env var
  │
  ▼  ── NestJS Module Middleware (in AppModule import order) ──
  ├─ ClsMiddleware (nestjs-cls, ClsModule imported first)
  │    └─ idGenerator: x-request-id → traceparent → crypto.randomUUID()
  │    └─ stores result in ALS: cls.getId() = traceId
  │
  ├─ pino-http (nestjs-pino, LoggerModule imported second)
  │    └─ genReqId: () => cls.getId()   ← reads ALS that ClsMiddleware already set
  │    └─ binds per-request child logger in ALS
  │    └─ auto-logs: method, path, statusCode, duration, reqId (= traceId)
  │
  ▼  ── NestJS Route Middleware (AppModule.configure()) ──
  │  [CorrelationIdMiddleware: simplified to set req.traceId = cls.getId() for backward compat]
  │
  ▼  ── Guards ──
  ├─ ThrottlerGuard (APP_GUARD)
  │    └─ 429 if TTL window exceeded; reads THROTTLER_TTL_SECONDS/THROTTLER_LIMIT from config
  │
  ▼  ── Interceptors (request side, first-registered-first) ──
  ├─ ResponseEnvelopeInterceptor (APP_INTERCEPTOR #1, outermost)
  │    └─ checks @RawResponse() decorator; if set, passes through unchanged
  ├─ AuditInterceptor (APP_INTERCEPTOR #2, inner/closer to handler)
  │    └─ checks @Audit(action, resource) decorator; if absent, passes through
  │
  ▼  ── Pipes ──
  ├─ ValidationPipe (APP_PIPE)
  │    └─ whitelist: strip unknown; forbidNonWhitelisted: 400 if unknown present
  │    └─ transform: true; enables implicit type conversion for query params
  │
  ▼  ── Handler ──
  Controller method executes
  │
  ▼  ── Response path (LIFO — last-registered first) ──
  ├─ AuditInterceptor.pipe(tap())
  │    └─ IAuditContextProvider.getContext() → if no organizationId, SKIP (D-04)
  │    └─ prisma.auditLog.create({...}).catch(err => logger.error(err)) — non-blocking
  │
  ├─ ResponseEnvelopeInterceptor.pipe(map())
  │    └─ { success: true, data: <handler result>, meta: null, traceId: cls.getId() }
  │    └─ meta is populated by handlers returning PaginatedResult<T> type
  │
  ▼  ── Exception Filter (any stage, on error) ──
  ├─ PrismaExceptionFilter  → Prisma P2002→409, P2025→404 (highest priority)
  └─ GlobalExceptionFilter  → { success: false, errorCode, message, traceId: cls.getId() }
       └─ CHANGED from Phase 2: reads traceId from cls.getId() not req.traceId

──────────────────────────────────────────────────────
  Health endpoints:  /api/v1/health/liveness  (no DB check, @RawResponse())
                     /api/v1/health/readiness (Prisma ping, @RawResponse())
  Swagger:           /api/docs + /api/docs-json (main.ts, non-prod only, Express routes)
──────────────────────────────────────────────────────
```

### Recommended Project Structure (new additions to Phase 2 layout)

```
packages/backend/src/
├── common/
│   ├── middleware/
│   │   └── correlation-id.middleware.ts   (MODIFIED: simplified, seeds req.traceId = cls.getId())
│   ├── exceptions/
│   │   ├── global-exception.filter.ts    (MODIFIED: cls.getId() replaces req.traceId)
│   │   └── error-codes.ts                (unchanged — template for catalog helper)
│   ├── interceptors/
│   │   ├── response-envelope.interceptor.ts     (new)
│   │   ├── response-envelope.interceptor.spec.ts (new)
│   │   ├── audit.interceptor.ts                 (new)
│   │   ├── audit.interceptor.spec.ts            (new)
│   │   └── raw-response.decorator.ts            (new)
│   └── pagination/
│       ├── cursor-pagination.dto.ts             (new — SEAM-06)
│       └── pagination-meta.interface.ts         (new — SEAM-06)
├── config/
│   └── env.schema.ts          (EXTENDED: + CORS_ORIGINS, LOG_LEVEL, THROTTLER_* vars)
├── audit/
│   ├── audit.decorator.ts                       (new)
│   ├── audit-context-provider.interface.ts      (new — IAuditContextProvider seam)
│   └── noop-audit-context-provider.ts           (new — no-op implementation)
├── health/
│   ├── health.controller.ts                     (new)
│   ├── health.controller.spec.ts                (new)
│   ├── health.module.ts                         (new)
│   └── prisma-health.indicator.ts               (new)
└── idempotency/
    ├── idempotency.decorator.ts                 (new — @IdempotencyKey())
    ├── idempotency-store.interface.ts           (new — IdempotencyStore seam)
    └── noop-idempotency-store.ts               (new — in-memory Map implementation)
```

---

### Pattern 1: nestjs-cls + nestjs-pino ALS Integration (INFRA-04, D-11/D-12)

**What:** ClsModule initializes ALS per request, generating the correlation ID. pino-http's `genReqId` reads from ClsService so pino's `reqId` field matches our traceId.

**Critical middleware order:** ClsModule must appear BEFORE LoggerModule in AppModule `imports[]`. NestJS applies module middleware in import order. ClsMiddleware must initialize the ALS store before pino-http's `genReqId` callback executes.

**Env schema extension (D-16):**
```typescript
// src/config/env.schema.ts — additions
export const envSchema = z.object({
  // ... existing fields ...
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty comma-separated list'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
});
```

**ClsModule setup (D-12 seam for ALS):**
```typescript
// src/app.module.ts (imports order matters)
imports: [
  AppConfigModule,  // 1st: global config available everywhere
  ClsModule.forRoot({
    global: true,
    middleware: {
      mount: true,       // registers ClsMiddleware to all routes
      generateId: true,  // runs idGenerator per request
      idGenerator: (req: Request) => extractCorrelationId(req),  // D-12 logic
    },
  }),
  LoggerModule.forRootAsync({  // 2nd: pino-http runs after cls has set traceId
    imports: [AppConfigModule],
    inject: [AppConfigService],
    useFactory: (config: AppConfigService, cls: ClsService) => ({
      pinoHttp: {
        level: config.get('LOG_LEVEL'),
        genReqId: () => cls.getId(),  // reads from ALS set by ClsMiddleware
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["set-cookie"]',
            'req.body.password',
            'req.body.token',
            'req.body.apiKey',
            'req.body.secret',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: {
          ignore: (req) => req.url?.includes('/health'),  // don't log health probes
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            id: req.id,  // = traceId
          }),
        },
      },
    }),
  }),
  // ... other imports
]
```

**Note:** `ClsService` must also be injected into the `LoggerModule.forRootAsync` factory. Add `inject: [AppConfigService, ClsService]` and import `[AppConfigModule, ClsModule]`.

**Correlation ID extraction utility (moved from CorrelationIdMiddleware, shared):**
```typescript
// src/common/middleware/extract-correlation-id.ts
// Source: existing CorrelationIdMiddleware logic (Phase 2)
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
  if (!traceHex || !/^[0-9a-f]{32}$/i.test(traceHex)) return undefined;
  return `${traceHex.slice(0,8)}-${traceHex.slice(8,12)}-${traceHex.slice(12,16)}-${traceHex.slice(16,20)}-${traceHex.slice(20)}`;
}

export function extractCorrelationId(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (
    extractSafeTraceId(req.headers['x-request-id'] as string | undefined) ??
    extractTraceparentId(req.headers['traceparent'] as string | undefined) ??
    crypto.randomUUID()
  );
}
```

**GlobalExceptionFilter modification (D-12):**
```typescript
// BEFORE (Phase 2): traceId: request.traceId ?? crypto.randomUUID()
// AFTER (Phase 3):
constructor(
  private readonly config: AppConfigService,
  private readonly cls: ClsService,  // ADD injection
) {}

// In catch():
traceId: this.cls.getId() ?? crypto.randomUUID(),
```

**main.ts additions (D-11):**
```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });  // buffer until pino ready
// ... existing setup ...
app.useLogger(app.get(Logger));  // replace NestJS default logger with pino
app.enableShutdownHooks();       // INFRA-13
```

---

### Pattern 2: ValidationPipe via APP_PIPE (INFRA-07)

**What:** Global validation pipe registered via DI so it has access to NestJS DI (consistent with APP_FILTER pattern). Requires class-validator and class-transformer installed.

**Why APP_PIPE over useGlobalPipes:** `useGlobalPipes` in `main.ts` cannot inject dependencies. `APP_PIPE` is registered inside the module system and participates in DI, matching the Phase 2 `APP_FILTER` precedent. [CITED: docs.nestjs.com/techniques/validation]

```typescript
// In AppModule providers:
{
  provide: APP_PIPE,
  useValue: new ValidationPipe({
    whitelist: true,              // strip non-decorated properties silently
    forbidNonWhitelisted: true,   // 400 if unknown properties present
    transform: true,              // transform payload to DTO class instance
    transformOptions: {
      enableImplicitConversion: true,  // convert '3' → 3 for query params
    },
  }),
}
```

**Shared base DTOs (Claude's discretion — recommended location):**
```typescript
// src/common/pagination/cursor-pagination.dto.ts
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

// src/common/pagination/pagination-meta.interface.ts
export interface PaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

// ResponseEnvelopeInterceptor: meta is PaginationMeta | null
// Single-resource responses: meta = null
// List responses: handler returns { data: T[], meta: PaginationMeta }
```

---

### Pattern 3: Response Envelope Interceptor + @RawResponse() (INFRA-08)

**What:** Global interceptor wrapping all successful responses. Opt-out via `@RawResponse()` for Terminus health, streams, and redirects.

**APP_INTERCEPTOR execution order — CRITICAL:**
- NestJS applies APP_INTERCEPTOR request-side in **registration order** (first-registered = first on request path).
- Response-side (tap/map) runs **LIFO**: last-registered = first on response path.
- Register `ResponseEnvelopeInterceptor` FIRST, `AuditInterceptor` SECOND.
- Result: AuditInterceptor.tap() sees raw handler output; ResponseEnvelopeInterceptor.map() wraps it last. [ASSUMED — based on NestJS LIFO interceptor behavior; cross-referenced with multiple sources]

```typescript
// src/common/interceptors/raw-response.decorator.ts
export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);

// src/common/interceptors/response-envelope.interceptor.ts
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) return next.handle();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        meta: null,          // populated by handlers that return PaginatedResult
        traceId: this.cls.getId(),
      })),
    );
  }
}
```

**For paginated responses:** The convention is for list handlers to return `{ data: T[], meta: PaginationMeta }`. The ResponseEnvelopeInterceptor can detect this shape and pass `meta` through, or the handler can return the full envelope object and use `@RawResponse()`. Research recommends: handlers return `{ data, meta }` and the interceptor checks for a `.meta` property to forward it, otherwise sets `meta: null`.

---

### Pattern 4: Audit Interceptor Seam (INFRA-09)

**What:** Reads `@Audit(action, resource)` decorator, fires non-blocking AuditLog write after handler succeeds. Pluggable via IAuditContextProvider (no-op now).

**AuditLog model fields (from Prisma schema, confirmed):**
- `organizationId: String` — non-nullable FK; write ONLY when provider yields this
- `userId: String?` — optional FK
- `action: AuditAction` — enum: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXECUTE, APPROVE, REJECT
- `resource: String` — from decorator
- `resourceId: String?` — optional; extract from route params
- `details: Json?` — optional additional context
- `ipAddress: String?` — from request
- `userAgent: String?` — from request headers

```typescript
// src/audit/audit-context-provider.interface.ts
export interface AuditContext {
  organizationId: string;
  userId?: string;
}

export abstract class IAuditContextProvider {
  abstract getContext(): AuditContext | null;
}

// src/audit/noop-audit-context-provider.ts
@Injectable()
export class NoOpAuditContextProvider extends IAuditContextProvider {
  getContext(): null { return null; }  // always returns null this phase
}

// src/audit/audit.decorator.ts
export const AUDIT_KEY = 'AUDIT';
export interface AuditMeta { action: AuditAction; resource: string; }
export const Audit = (action: AuditAction, resource: string) =>
  SetMetadata(AUDIT_KEY, { action, resource });

// src/common/interceptors/audit.interceptor.ts (D-03 / D-04)
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditContextProvider: IAuditContextProvider,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!auditMeta) return next.handle();  // not audited

    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap({ next: () => void this.writeAuditLog(auditMeta, req) }),
      // D-03: only runs on success; errors propagate normally
    );
  }

  private writeAuditLog(meta: AuditMeta, req: Request): void {
    const ctx = this.auditContextProvider.getContext();
    if (!ctx?.organizationId) return;  // D-04: no org context — skip silently

    this.prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: meta.action,
        resource: meta.resource,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch((err) => this.logger.error(err, 'AuditInterceptor: write failed'));
    // D-03: fire-and-forget; error is logged, not thrown
  }
}
```

**AppModule providers ordering:**
```typescript
providers: [
  // Filters (unchanged from Phase 2, order preserved)
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  // New pipe
  { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }) },
  // New guard
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  // New interceptors — ORDER MATTERS (response side is LIFO)
  { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },  // outermost
  { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },             // closest to handler
  // Audit context provider (no-op this phase)
  { provide: IAuditContextProvider, useClass: NoOpAuditContextProvider },
]
```

---

### Pattern 5: Health Checks via Terminus 11 (INFRA-10)

**What:** Separate liveness (always-200) and readiness (Prisma DB ping) endpoints. Uses the new `HealthIndicatorService` API (the deprecated `HealthIndicator` class should NOT be used in new code).

**terminus 11 API change:** `HealthIndicator` and `HealthCheckError` are deprecated in v11, scheduled for removal in v12. Use `HealthIndicatorService` injected from `@nestjs/terminus`. [CITED: github.com/nestjs/terminus/releases/tag/11.0.0]

```typescript
// src/health/prisma-health.indicator.ts
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthIndicatorService,  // inject new API
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

// src/health/health.controller.ts
@Controller('health')
@Version('1')
@RawResponse()  // REQUIRED: bypass ResponseEnvelopeInterceptor
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };  // Always 200; no external checks
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('prisma'),
    ]);
  }
}

// src/health/health.module.ts
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
```

**Routes served at:** `GET /api/v1/health/liveness` and `GET /api/v1/health/readiness`

---

### Pattern 6: Security Baseline (INFRA-12)

**Middleware order in main.ts is critical.** Helmet must run before CORS and Swagger setup.

```typescript
// src/main.ts additions (order matters)
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  // 1. Security headers (must be first middleware)
  app.use(helmet());

  // 2. CORS (after helmet)
  app.enableCors({
    origin: config.get('CORS_ORIGINS').split(',').map((s: string) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // 3. Global prefix + versioning (unchanged)
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // 4. Swagger (non-prod only, after security middleware)
  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Enterprise AI Delivery Platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  // 5. Shutdown hooks
  app.enableShutdownHooks();

  // 6. Replace logger with pino
  app.useLogger(app.get(Logger));

  await app.listen(config.get('PORT'));
}
```

**ThrottlerModule configuration (D-15):**
```typescript
// In AppModule imports:
ThrottlerModule.forRootAsync({
  imports: [AppConfigModule],
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => ({
    throttlers: [{
      ttl: seconds(config.get('THROTTLER_TTL_SECONDS')),  // IMPORTANT: v6 uses milliseconds
      limit: config.get('THROTTLER_LIMIT'),
    }],
  }),
}),
```

**CRITICAL: @nestjs/throttler v6 TTL is in milliseconds.** `{ ttl: 60, limit: 100 }` means 60ms window, not 60 seconds. Use the `seconds()` helper: `import { seconds } from '@nestjs/throttler'`. [CITED: cdn.jsdelivr.net/npm/@nestjs/throttler@6.5.0/README.md]

---

### Pattern 7: SEAM-06 Conventions

**Error Catalog Format Helper (D-10):**
```typescript
// src/common/error-catalog/create-error-catalog.ts
/**
 * Creates a domain error code object enforcing PREFIX.CODE dotted UPPER_SNAKE format.
 * Each domain creates its own catalog co-located with the domain.
 *
 * Usage:
 *   const AUTH_ERROR_CODES = createErrorCatalog('AUTH', ['INVALID_TOKEN', 'EXPIRED_TOKEN'] as const);
 *   // → { INVALID_TOKEN: 'AUTH.INVALID_TOKEN', EXPIRED_TOKEN: 'AUTH.EXPIRED_TOKEN' }
 */
export function createErrorCatalog<const T extends string>(
  prefix: string,
  codes: readonly T[],
): { [K in T]: `${string}.${K}` } {
  return Object.fromEntries(
    codes.map((c) => [c, `${prefix}.${c}`]),
  ) as { [K in T]: `${string}.${K}` };
}

export type DomainErrorCode = `${string}.${string}`;  // weak type for cross-domain use
```

**Idempotency Seam (D-09):**
```typescript
// src/idempotency/idempotency-store.interface.ts
export abstract class IdempotencyStore {
  abstract get(key: string): Promise<unknown | undefined>;
  abstract set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}

// src/idempotency/noop-idempotency-store.ts (in-memory, single-instance)
@Injectable()
export class NoOpIdempotencyStore extends IdempotencyStore {
  private readonly store = new Map<string, unknown>();
  async get(key: string) { return this.store.get(key); }
  async set(key: string, value: unknown) { this.store.set(key, value); }
  async has(key: string) { return this.store.has(key); }
}

// src/idempotency/idempotency.decorator.ts
export const IDEMPOTENCY_KEY = 'IDEMPOTENCY_KEY';
export const IdempotencyKey = () => SetMetadata(IDEMPOTENCY_KEY, true);
```

---

### Anti-Patterns to Avoid

- **`app.useGlobalPipes(new ValidationPipe(...))` in main.ts:** Cannot use NestJS DI. Always use `APP_PIPE` provider in AppModule for testability. [CITED: docs.nestjs.com/techniques/validation]
- **Registering `ResponseEnvelopeInterceptor` after `AuditInterceptor`:** Audit intercept would then run OUTSIDE the envelope interceptor on the request path, disrupting the intended response ordering.
- **Using deprecated `HealthIndicator` class from terminus 11:** Extends a class marked for removal in v12. Use `HealthIndicatorService` instead.
- **`{ ttl: 60, limit: 100 }` in throttler v6:** This is a 60ms window. Use `seconds(60)` or `60_000`.
- **Calling `SwaggerModule.setup()` before `app.use(helmet())`:** Allows Swagger's self-generated HTML to be served without security headers on first load in some edge cases.
- **`throw new HealthCheckError(...)` in custom health indicators:** Deprecated API. Use `indicator.down({ message })`.
- **Writing to AuditLog without checking `organizationId`:** Non-nullable FK; Prisma will throw a constraint error. Always check the context provider result (D-04).
- **Using raw `AsyncLocalStorage` directly:** No DI integration; Phase 6 would introduce nestjs-cls anyway for tenant context. Use nestjs-cls from the start.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request structured logging with ALS context | Custom Logger service with AsyncLocalStorage | nestjs-pino | ALS binding, child loggers, redaction, serializers — 200+ lines of correct code |
| Request ALS store | Custom singleton AsyncLocalStorage wrapper | nestjs-cls | Phase 6 needs DI-injectable tenant context; nestjs-cls is the standard solution |
| Health check endpoints | `@Get('/health') { return { ok: true } }` | @nestjs/terminus | Kubernetes probe semantics: readiness fails with 503 (not 200 with `{ ok: false }`); HealthCheckService handles error serialization |
| API documentation | Postman collections, hand-written Markdown | @nestjs/swagger | Code-generated from existing decorators; stays in sync automatically |
| Rate limiting | IP counter in Redis or in-memory Map | @nestjs/throttler | Sliding window, per-route overrides, Redis-ready storage; skip throttling for tests |
| Security headers | Manual `res.setHeader()` for each header | helmet | 30+ headers; HSTS, CSP, X-Frame-Options, X-Content-Type-Options — all maintained in one package |
| DTO validation and transformation | Regex checks + JSON parsing | class-validator + class-transformer + ValidationPipe | Decorator-based, composable, tested by the NestJS ecosystem |
| Cursor pagination logic | Per-endpoint nextCursor calculation | Shared `CursorPaginationDto` + `PaginationMeta` | Consistent shape across all 14 domains; implements D-08 once |

**Key insight:** Every item in this list has documented edge cases that are non-obvious (e.g., 503 vs 200 for readiness failures, HSTS misconfiguration, pino ALS context loss in callback-based APIs). Using maintained libraries avoids shipping these bugs into a foundation that 14 domains inherit.

---

## Common Pitfalls

### Pitfall 1: Middleware Ordering — ClsModule vs LoggerModule

**What goes wrong:** `genReqId: () => cls.getId()` returns `undefined` because pino-http's middleware ran before ClsMiddleware initialized the ALS store.

**Why it happens:** NestJS applies NestModule middleware in import order. If `LoggerModule` appears before `ClsModule` in AppModule's `imports[]`, pino-http runs first — before the ALS store exists.

**How to avoid:** Import ClsModule BEFORE LoggerModule in AppModule. Verify by checking that `cls.getId()` in a test request is never `undefined`.

**Warning signs:** `reqId: null` in pino log output; `traceId: undefined` in error responses.

---

### Pitfall 2: @nestjs/throttler v6 TTL in Milliseconds

**What goes wrong:** The app throttles at 60ms (100 req/60ms = 1,666 req/sec) instead of the intended 100 req/minute. Essentially no effective rate limiting.

**Why it happens:** v6 changed TTL from seconds to milliseconds. Code that worked in v4/v5 with `{ ttl: 60, limit: 100 }` silently changes behavior.

**How to avoid:** Always use `seconds(60)` or `minutes(1)` from `@nestjs/throttler`. Set THROTTLER_TTL_SECONDS (in seconds) in the env schema and convert in the factory.

**Warning signs:** No 429 responses even when hammering the endpoint; load test shows effective rate much higher than expected.

---

### Pitfall 3: APP_INTERCEPTOR LIFO Response Ordering

**What goes wrong:** AuditInterceptor's `tap()` receives the already-wrapped `{ success, data, meta, traceId }` envelope instead of the raw handler output. This doesn't break behavior (the tap doesn't use the value) but it's semantically wrong and brittle if future audit logic inspects the response.

**Why it happens:** Confusion about which interceptor is "inner" vs "outer" with `APP_INTERCEPTOR`. Last-registered = first on response path.

**How to avoid:** Register `ResponseEnvelopeInterceptor` first (outermost), `AuditInterceptor` second (inner). Add a comment in the providers array explaining this.

**Warning signs:** Audit tests show `data` is `{ success: true, data: {...} }` instead of `{...}`.

---

### Pitfall 4: Missing @RawResponse() on HealthController

**What goes wrong:** Kubernetes liveness probe gets `{ success: true, data: { status: 'ok' }, meta: null, traceId: '...' }` instead of Terminus's standard health response. The probe parser may accept 200 OK, but readiness failures return a nested structure that breaks monitoring tools expecting Terminus's format.

**Why it happens:** ResponseEnvelopeInterceptor is global and wraps everything unless explicitly opted out.

**How to avoid:** Apply `@RawResponse()` at the `HealthController` class level (covers all methods) OR on each health method individually.

**Warning signs:** Health check responses have a `success` key; Terminus's `status: 'ok'/'error'` is nested under `data`.

---

### Pitfall 5: bufferLogs Required for Bootstrap Logging

**What goes wrong:** NestJS's own startup log messages (module initialization, provider registration) use the default built-in logger and bypass pino entirely, even after `app.useLogger(app.get(Logger))`.

**Why it happens:** By the time `app.useLogger()` is called, the bootstrap sequence has already emitted logs using the original logger.

**How to avoid:** Create the app with `NestFactory.create(AppModule, { bufferLogs: true })`. This buffers all bootstrap logs and flushes them through pino after `app.useLogger()` is called.

**Warning signs:** JSON log file has some structured entries (from pino) and some plain-text entries (from the default logger) mixed together.

---

### Pitfall 6: Audit Write on AuditLog.organizationId = null

**What goes wrong:** Prisma throws `Foreign key constraint failed` when the interceptor tries to write an AuditLog with no organizationId — which is always the case this phase since tenancy doesn't exist yet.

**Why it happens:** AuditLog.organizationId is non-nullable in the schema. Any write without a valid org id violates the FK constraint.

**How to avoid:** The `NoOpAuditContextProvider.getContext()` returns `null`. The AuditInterceptor MUST check for null and return early (D-04). Never supply a placeholder string like `'NO_ORG'`.

**Warning signs:** `ForeignKeyConstraintError` in logs when any handler with `@Audit()` is called.

---

## Code Examples

### Complete env.schema.ts extension

```typescript
// Source: Phase 2 env.schema.ts + D-16 additions
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  // Phase 3 additions (D-16):
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty string'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;
```

### Success response with pagination meta

```typescript
// Handler returning a paginated list:
@Get()
async listOrganizations(@Query() query: CursorPaginationDto) {
  const items = await this.orgService.list(query);
  // Return shape that ResponseEnvelopeInterceptor recognizes for meta forwarding:
  return {
    data: items.data,
    meta: { nextCursor: items.nextCursor, hasNextPage: items.hasNextPage },
  };
}
// → client receives: { success: true, data: [...], meta: { nextCursor, hasNextPage }, traceId }
```

**Note:** The ResponseEnvelopeInterceptor needs to detect `{ data, meta }` vs plain data. Recommend: if the handler response is an object with both `data` and `meta` properties, forward them; otherwise treat the whole response as `data` and set `meta: null`. Add a discriminator type guard.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Winston + custom NestJS logger | nestjs-pino (pino-http + ALS) | ~2020 | JSON structured logs; ALS-backed context; no custom serializer boilerplate |
| cls-hooked (deprecated) | nestjs-cls (Node.js AsyncLocalStorage) | 2021 (cls-hooked deprecated) | cls-hooked uses async_hooks monkey-patching which is unstable; nestjs-cls uses the stable AsyncLocalStorage API |
| HealthIndicator class (terminus) | HealthIndicatorService (terminus 11) | terminus v11.0.0 (2024) | Old class deprecated; new service API is simpler and more testable |
| @nestjs/throttler ttl in seconds | ttl in milliseconds + helpers | throttler v6 (2024) | Breaking change: `seconds(60)` helper required to avoid silent misconfig |
| useGlobalPipes/useGlobalInterceptors in main.ts | APP_PIPE/APP_INTERCEPTOR DI providers | NestJS 7+ recommended | DI-friendly pattern enables injection into global providers |

**Deprecated/outdated:**
- `HealthIndicator` and `HealthCheckError` from `@nestjs/terminus`: deprecated in v11, removed in v12. Use `HealthIndicatorService`.
- `cls-hooked` package: deprecated; `nestjs-cls` is the NestJS-native replacement.
- Calling `app.useGlobalPipes(new ValidationPipe())` for production apps with injectable dependencies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 10 packages are installable from the npm registry on 2026-07-01 | Standard Stack | Install fails; identify replacement |
| A2 | APP_INTERCEPTOR response-side execution is LIFO (last-registered = first on response path) | Pattern 3 | Audit sees wrapped envelope instead of raw data; swap registration order |
| A3 | NestJS module middleware applies in imports[] array order (ClsModule before LoggerModule) | Pattern 1 | pino-http genReqId sees undefined from ALS; correlation ID breaks |
| A4 | `ClsService` can be injected into `LoggerModule.forRootAsync` useFactory | Pattern 1 | Need to use a different mechanism to pass traceId to genReqId |
| A5 | @nestjs/terminus `HealthIndicatorService` is available as an injectable in TerminusModule for v11.1.1 | Pattern 5 | Fall back to deprecated HealthIndicator class with a TODO comment |
| A6 | nestjs-cls v6.2.1 supports NestJS 11 (from docs: "v5.0 adds NestJS v11 support") | Standard Stack | Compatibility issue; use raw ALS instead |
| A7 | `pino-http` v11 is the correct peer dep for `nestjs-pino` v4.6.1 | Standard Stack | Version mismatch; check nestjs-pino's peerDependencies |

---

## Open Questions (RESOLVED)

1. **Can ClsService be injected into nestjs-pino's forRootAsync factory?**
   - What we know: `LoggerModule.forRootAsync` supports `imports` and `inject` arrays like any NestJS async factory.
   - What's unclear: Whether ClsModule must be listed in the useFactory `imports` or whether it's available globally once ClsModule.forRoot is in AppModule.
   - Recommendation: Try `inject: [AppConfigService, ClsService]` + `imports: [AppConfigModule]`. If ClsModule is global (it is with `global: true`), ClsService should be injectable without re-importing.
   - RESOLVED: Plan 03-02 Task 2 injects [AppConfigService, ClsService] into LoggerModule.forRootAsync — works because ClsModule is global.

2. **How should the ResponseEnvelopeInterceptor handle paginated responses?**
   - What we know: D-05 says `meta` is `null` for single-resource and populated for lists.
   - What's unclear: Whether the interceptor detects `{ data, meta }` shape from handlers, or whether handlers explicitly build the full envelope and use `@RawResponse()`.
   - Recommendation: Interceptor detects if response has `.data` and `.meta` properties; if so, forward both. Otherwise, treat response as `data`, set `meta: null`. Define a `PaginatedResult<T>` type for handlers to return.
   - RESOLVED: Plan 03-04 Task 2 uses an isPaginated discriminator on the { data, meta } shape (PaginatedResult<T> marker).

3. **Which THROTTLER_TTL env var naming is clearest for operators?**
   - What we know: @nestjs/throttler v6 uses milliseconds internally; `seconds()` helper exists.
   - Recommendation: `THROTTLER_TTL_SECONDS` (operator sets 60, env schema coerces, factory calls `seconds(config.get('THROTTLER_TTL_SECONDS'))`) for clarity.
   - RESOLVED: THROTTLER_TTL_SECONDS used consistently across Plans 03-02 and 03-06.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | All (fixed stack) | ✓ (check .nvmrc) | Pinned in Phase 1 | — |
| npm | Package install | ✓ | — | — |
| PostgreSQL (local/remote) | health readiness check | ✓ (DATABASE_URL set) | — | Mock PrismaService in tests |
| TypeScript 5.9.x | Build | ✓ (Phase 1) | — | — |
| Vitest 4 + SWC | Tests | ✓ (Phase 1) | — | — |
| @nestjs/testing | Integration tests | ✓ (already in devDeps) | ^11.1.27 | — |
| supertest | HTTP integration tests | ✓ (already in devDeps) | ^7.2.2 | — |

**Missing dependencies with no fallback:** None — all required tools are confirmed available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 with SWC (`vitest.config.ts` in `packages/backend/`) |
| Config file | `packages/backend/vitest.config.ts` (confirmed existing) |
| Quick run command | `npm test --workspace=packages/backend` |
| Full suite command | `npm test --workspace=packages/backend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-04 | Each request emits structured JSON log carrying traceId; auth headers redacted | Unit | vitest run (ALS seeding test) | ❌ Wave 0 |
| INFRA-04 | GlobalExceptionFilter reads traceId from ClsService not req.traceId | Unit | `vitest run src/common/exceptions/global-exception.filter.spec.ts` | ✅ (must update) |
| INFRA-07 | ValidationPipe rejects unknown fields with 400; transforms typed DTOs | Unit | `vitest run` (pipe behavior test) | ❌ Wave 0 |
| INFRA-07 | Unknown fields cause 400 in integration | Integration | `vitest run src/app.integration.spec.ts` | ✅ (must extend) |
| INFRA-08 | Successful responses wrapped in `{ success, data, meta, traceId }` | Unit | `vitest run src/common/interceptors/response-envelope.interceptor.spec.ts` | ❌ Wave 0 |
| INFRA-08 | @RawResponse() skips envelope wrapping | Unit | same file | ❌ Wave 0 |
| INFRA-09 | Audit interceptor skips write when no org context (no-op provider) | Unit | `vitest run src/common/interceptors/audit.interceptor.spec.ts` | ❌ Wave 0 |
| INFRA-09 | Audit interceptor writes to AuditLog with injected fake context provider | Unit | same file (fake provider injection) | ❌ Wave 0 |
| INFRA-09 | Audit write failure does not fail the request | Unit | same file (prisma.create throws, assert response success) | ❌ Wave 0 |
| INFRA-10 | Liveness returns 200 always | Integration | `vitest run src/health/health.controller.spec.ts` | ❌ Wave 0 |
| INFRA-10 | Readiness fails (503) when DB unreachable | Integration | same file (PrismaHealthIndicator.isHealthy with mock) | ❌ Wave 0 |
| INFRA-11 | Swagger served in non-prod; absent in prod | Integration | `vitest run src/app.integration.spec.ts` (extend) | ✅ (must extend) |
| INFRA-12 | Helmet headers present on responses | Integration | `vitest run src/app.integration.spec.ts` (extend) | ✅ (must extend) |
| INFRA-12 | Rate limit 429 after limit exceeded | Integration | supertest loop (manual or vitest) | ❌ Wave 0 |
| INFRA-13 | Shutdown hooks call PrismaService.onModuleDestroy | Unit | Verify app.enableShutdownHooks() called | ❌ Wave 0 (light test) |
| SEAM-06 | CursorPaginationDto validates cursor + limit | Unit | `vitest run src/common/pagination/*.spec.ts` | ❌ Wave 0 |
| SEAM-06 | createErrorCatalog produces PREFIX.CODE strings | Unit | `vitest run src/common/error-catalog/*.spec.ts` | ❌ Wave 0 |

### Test Seams Requiring Fake Injection

1. **AuditInterceptor** — requires a fake `IAuditContextProvider` that returns a real org context to verify the write path. Use `{ provide: IAuditContextProvider, useValue: { getContext: () => ({ organizationId: 'test-org-1', userId: 'test-user-1' }) } }` in test module.
2. **AuditInterceptor write failure** — inject a `PrismaService` mock where `auditLog.create` throws; assert that `tap` error does not propagate.
3. **ResponseEnvelopeInterceptor with ClsService** — inject a ClsService mock with `getId: () => 'test-trace-id'`.
4. **PrismaHealthIndicator** — inject a PrismaService mock where `$queryRaw` rejects; assert `indicator.down()` returned.
5. **GlobalExceptionFilter** — already has a spec; extend to inject a ClsService mock and assert traceId comes from `cls.getId()` not `req.traceId`.

### Sampling Rate
- **Per task commit:** `npm test --workspace=packages/backend`
- **Per wave merge:** `npm test --workspace=packages/backend` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/common/interceptors/response-envelope.interceptor.spec.ts` — covers INFRA-08
- [ ] `src/common/interceptors/audit.interceptor.spec.ts` — covers INFRA-09 (fake provider injection)
- [ ] `src/health/health.controller.spec.ts` — covers INFRA-10
- [ ] `src/common/pagination/cursor-pagination.dto.spec.ts` — covers SEAM-06
- [ ] `src/common/error-catalog/create-error-catalog.spec.ts` — covers SEAM-06
- [ ] Updates to `src/app.integration.spec.ts` — add envelope shape assertion, Swagger gate test, Helmet header assertion
- [ ] Updates to `src/common/exceptions/global-exception.filter.spec.ts` — update traceId source to ClsService mock

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5.1 Input Validation | Yes | class-validator + ValidationPipe (`whitelist`, `forbidNonWhitelisted`) |
| V7.1 Log Content | Yes | nestjs-pino deny-list redaction (auth headers, body passwords, tokens) |
| V7.3 Log Protection | Yes | Never log request bodies by default (D-13); redact secrets |
| V13.2 API Security | Yes | @nestjs/throttler (rate limiting); Helmet (security headers) |
| V13.3 API Specific | Yes | CORS allowlist from env var; forbidden unless in `CORS_ORIGINS` |
| V14.4 HTTP Headers | Yes | Helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, referrer-policy |
| V2 Authentication | No | Phase 4 |
| V3 Session Management | No | Phase 4 |
| V4 Access Control | No | Phase 5 (RBAC) |
| V6 Cryptography | No | Not applicable this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log injection via correlation ID header | Tampering | UUID validation in extractCorrelationId() (already present in Phase 2) |
| Credential leakage in logs | Information Disclosure | nestjs-pino redact deny-list (`authorization`, `cookie`, `password`, etc.) |
| DoS via request flooding | Denial of Service | @nestjs/throttler 100 req/min/IP default |
| Clickjacking / MIME sniffing | Elevation of Privilege | Helmet (X-Frame-Options: DENY, X-Content-Type-Options: nosniff) |
| CORS bypass / cross-origin data theft | Information Disclosure | app.enableCors() with strict origin allowlist from CORS_ORIGINS |
| API schema exposure in production | Information Disclosure | Swagger disabled when `NODE_ENV === production` (D-14) |
| Audit log integrity | Repudiation | AuditInterceptor fires post-success, non-blocking; failures logged to monitoring |

---

## Sources

### Primary (HIGH confidence)
- npm registry — all 10 packages confirmed to exist at versions listed; GitHub repos verified as matching official organizations
- Phase 2 codebase (`packages/backend/src/`) — CorrelationIdMiddleware, GlobalExceptionFilter, AppConfigModule, env.schema.ts read directly

### Secondary (MEDIUM confidence)
- [github.com/iamolegga/nestjs-pino README](https://github.com/iamolegga/nestjs-pino) — forRootAsync, genReqId, redact, bufferLogs patterns
- [papooch.github.io/nestjs-cls](https://papooch.github.io/nestjs-cls/) — ClsModule.forRoot, generateId, middleware setup
- [github.com/nestjs/terminus releases/11.0.0](https://newreleases.io/project/github/nestjs/terminus/release/11.0.0) — HealthIndicatorService new API, HealthIndicator deprecation
- [cdn.jsdelivr.net/npm/@nestjs/throttler@6.5.0/README.md](https://cdn.jsdelivr.net/npm/@nestjs/throttler@6.5.0/README.md) — v6 TTL milliseconds, seconds() helper
- [docs.nestjs.com/techniques/validation](https://docs.nestjs.com/techniques/validation) — ValidationPipe flags, class-validator peer dep requirement
- [docs.nestjs.com/interceptors](https://docs.nestjs.com/interceptors) — APP_INTERCEPTOR vs useGlobalInterceptors, DI advantage

### Tertiary (LOW confidence — cross-referenced, mark for validation)
- WebSearch findings on APP_INTERCEPTOR LIFO response ordering — described in multiple sources as the standard NestJS behavior; validate by writing a two-interceptor test
- WebSearch findings on NestJS module middleware import order — described as consistent with NestJS module registration order; validate by running integration test and checking log output for traceId presence

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry; repos from official orgs
- Architecture/ALS integration: MEDIUM — nestjs-cls + nestjs-pino integration pattern confirmed via docs; middleware ordering via reasoning + multiple sources
- Interceptor ordering: MEDIUM — LIFO response behavior confirmed via multiple NestJS sources; validate with test
- Terminus new API: MEDIUM — confirmed from release notes and WebSearch; official docs JS-rendered and inaccessible
- Pitfalls: HIGH — throttler TTL change is documented; helmet order is documented; AuditLog FK constraint is from schema inspection

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (stable packages; check @nestjs/terminus for v12 deprecation timeline if planning stretches)
