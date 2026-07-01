---
phase: 03-platform-kernel-observability-validation-security-health
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - packages/backend/src/config/env.schema.ts
  - packages/backend/src/common/middleware/extract-correlation-id.ts
  - packages/backend/src/common/middleware/correlation-id.middleware.ts
  - packages/backend/src/app.module.ts
  - packages/backend/src/main.ts
  - packages/backend/src/common/exceptions/global-exception.filter.ts
  - packages/backend/src/common/interceptors/raw-response.decorator.ts
  - packages/backend/src/common/interceptors/audit.interceptor.ts
  - packages/backend/src/common/interceptors/response-envelope.interceptor.ts
  - packages/backend/src/audit/audit-context-provider.interface.ts
  - packages/backend/src/audit/noop-audit-context-provider.ts
  - packages/backend/src/audit/audit.decorator.ts
  - packages/backend/src/idempotency/idempotency-store.interface.ts
  - packages/backend/src/idempotency/noop-idempotency-store.ts
  - packages/backend/src/idempotency/idempotency.decorator.ts
  - packages/backend/src/common/error-catalog/create-error-catalog.ts
  - packages/backend/src/common/pagination/cursor-pagination.dto.ts
  - packages/backend/src/common/pagination/pagination-meta.interface.ts
  - packages/backend/src/health/prisma-health.indicator.ts
  - packages/backend/src/health/health.controller.ts
  - packages/backend/src/health/health.module.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-01
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

3 critical, 6 warnings, 3 info. The most serious issues are: raw database error messages
leaked through the public health endpoint, silent swallowing of bootstrap errors (making
production crashes invisible), and 401/403 HTTP exceptions mislabeled as INTERNAL_ERROR in
the global exception filter. Several secondary issues around fragile duck-typing in the
response envelope, an ignored TTL contract in the idempotency store, and missing audit
coverage on failed requests.

---

## Critical Issues

### CR-01: Raw database error message exposed in public health endpoint

**File:** `packages/backend/src/health/prisma-health.indicator.ts:18`

**Issue:** When the database is unreachable, `indicator.down({ message: (error as Error).message })`
forwards the raw Prisma/pg error message directly into the HTTP response body. That message
can contain the connection string host/port, database name, or internal pg error codes —
information a threat actor can use to map internal infrastructure. The `/health/readiness`
endpoint is unauthenticated and typically reachable from outside the cluster.

**Fix:**
```typescript
// Redact raw db errors; log the detail internally instead.
async isHealthy(key: string) {
  const indicator = this.health.check(key);
  try {
    await this.prisma.$queryRaw`SELECT 1`;
    return indicator.up();
  } catch (error) {
    this.logger.error(error, 'PrismaHealthIndicator: database unreachable');
    return indicator.down({ message: 'database unavailable' });
  }
}
```
Add `private readonly logger = new Logger(PrismaHealthIndicator.name);` and inject `Logger`
(or use `nestjs-pino`'s `Logger`) so the raw error is still observable in structured logs
without being surfaced to callers.

---

### CR-02: Bootstrap fatal errors silently swallowed — no stderr output before process exit

**File:** `packages/backend/src/main.ts:54-56`

**Issue:** The top-level `bootstrap().catch(() => { process.exit(1); })` discards the error
object entirely. If the app fails to start (bad env, port conflict, missing module, etc.) the
only signal is exit code 1 with zero output on stdout or stderr. In a containerised deployment
this produces a crash loop with no diagnostics — the comment "before pino is ready" is accurate
but does not preclude writing to `process.stderr` directly.

**Fix:**
```typescript
bootstrap().catch((err: unknown) => {
  // pino is not yet initialised; write directly to stderr as last resort.
  process.stderr.write(
    `[FATAL] Application failed to start: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
```

---

### CR-03: 401 / 403 HTTP exceptions mislabeled as PLATFORM.INTERNAL_ERROR

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:52-54`

**Issue:** `HTTP_STATUS_TO_ERROR_CODE` maps 404, 409, 400, and 422 but does NOT map 401
(`UNAUTHORIZED`) or 403 (`FORBIDDEN`). When a JWT / RBAC guard throws one of these, the
fallback path sets `errorCode: 'PLATFORM.INTERNAL_ERROR'` while the HTTP status is still
401/403. Clients that branch on `errorCode` will treat auth failures as server errors,
breaking error-handling logic in the frontend.

**Fix:**
```typescript
// Add UNAUTHORIZED and FORBIDDEN to the platform error codes:
export const PLATFORM_ERROR_CODES = {
  ...
  UNAUTHORIZED: 'PLATFORM.UNAUTHORIZED',
  FORBIDDEN:    'PLATFORM.FORBIDDEN',
} as const;

// Add mappings to the filter:
const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<number, PlatformErrorCode>> = {
  [HttpStatus.NOT_FOUND]:             PLATFORM_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]:              PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
  [HttpStatus.BAD_REQUEST]:           PLATFORM_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNPROCESSABLE_ENTITY]:  PLATFORM_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]:          PLATFORM_ERROR_CODES.UNAUTHORIZED,   // <-- add
  [HttpStatus.FORBIDDEN]:             PLATFORM_ERROR_CODES.FORBIDDEN,      // <-- add
};
```

---

## Warnings

### WR-01: Dead variable `request` declared but never read

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:33`

**Issue:** `const request = ctx.getRequest<Request & { traceId?: string }>();` is assigned but
never referenced. The traceId is sourced from `this.cls.getId()`, not `request.traceId`. The
unused variable adds noise and suggests a half-removed intention to read `req.traceId`.

**Fix:** Delete the line, or replace it with a named discard if a linter requires it:
```typescript
// Delete this line entirely:
// const request = ctx.getRequest<Request & { traceId?: string }>();
```

---

### WR-02: Audit interceptor silently skips failed handler invocations

**File:** `packages/backend/src/common/interceptors/audit.interceptor.ts:27-29`

**Issue:** The audit write is placed inside `tap({ next: ... })` which fires only on the
success path. If the handler throws (e.g., a 403 on a resource the user tried to access),
no audit record is written. In a compliance context, failed attempts to perform sensitive
actions (deletes, permission changes) are often more important to audit than successful ones.

**Fix:** Add an `error` branch to the `tap` call:
```typescript
return next.handle().pipe(
  tap({
    next:  () => void this.writeAuditLog(auditMeta, req),
    error: () => void this.writeAuditLog({ ...auditMeta, action: `${auditMeta.action}_FAILED` as AuditAction }, req),
  }),
);
```
If the schema does not support a `_FAILED` suffix, at minimum log the failure attempt so it
appears in the audit trail.

---

### WR-03: Synchronous throw from `getContext()` propagates into RxJS tap, corrupting the response stream

**File:** `packages/backend/src/common/interceptors/audit.interceptor.ts:36-37`

**Issue:** `writeAuditLog` calls `this.auditContextProvider.getContext()` synchronously. If the
future Phase 4/6 provider implementation throws (e.g., because it reads from a CLS store that
is not populated), the exception propagates up through the RxJS `tap` `next` callback. This
causes the observable to error, which can corrupt or suppress the HTTP response that has
already started to be sent. The `void` keyword on line 28 discards the return value but does
NOT catch synchronous throws.

**Fix:** Wrap the synchronous portion defensively:
```typescript
tap({
  next: () => {
    try {
      void this.writeAuditLog(auditMeta, req);
    } catch (err: unknown) {
      this.logger.error(err, 'AuditInterceptor: getContext() threw synchronously');
    }
  },
}),
```

---

### WR-04: Fragile duck-typing for paginated result detection in ResponseEnvelopeInterceptor

**File:** `packages/backend/src/common/interceptors/response-envelope.interceptor.ts:26-31`

**Issue:** The interceptor treats any object that has both a `data` property and a `meta`
property as a `PaginatedResult`. A domain object that legitimately contains both keys (e.g.,
`{ data: '...', meta: { createdAt: ... } }`) will be silently misrouted: its `data` value
will be hoisted to the top-level `data` field and its `meta` will be forwarded as pagination
meta — producing a corrupted response envelope with no error.

**Fix:** Use a more specific discriminant. Add a type-brand to `PaginatedResult` and check it:
```typescript
// In pagination-meta.interface.ts:
export interface PaginatedResult<T> {
  readonly __paginated: true;   // discriminant
  data: T[];
  meta: PaginationMeta;
}

// In the interceptor:
const isPaginated =
  data !== null &&
  typeof data === 'object' &&
  (data as Record<string, unknown>)['__paginated'] === true;
```
Alternatively, export a helper `isPaginatedResult(v): v is PaginatedResult<unknown>` that
checks the discriminant and use it here.

---

### WR-05: `ttlMs` parameter silently ignored in NoOpIdempotencyStore — interface contract broken

**File:** `packages/backend/src/idempotency/noop-idempotency-store.ts:16-18`

**Issue:** The `IdempotencyStore` interface declares `set(key, value, ttlMs?)`. The
`NoOpIdempotencyStore.set` implementation omits the `ttlMs` parameter entirely and never
evicts keys. Two consequences: (1) the Map grows unbounded for the lifetime of the process —
a memory leak in long-running deployments; (2) when the enforcement interceptor lands in a
future phase and passes a TTL, the contract will appear to be honoured while silently doing
nothing, masking a real correctness bug.

**Fix:** Accept and acknowledge the parameter. At minimum, schedule eviction:
```typescript
async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
  this.store.set(key, value);
  if (ttlMs !== undefined) {
    setTimeout(() => this.store.delete(key), ttlMs).unref();
  }
}
```

---

### WR-06: `createErrorCatalog` return type too loose — prefix not encoded in type

**File:** `packages/backend/src/common/error-catalog/create-error-catalog.ts:9-16`

**Issue:** The function signature is:
```typescript
function createErrorCatalog<const T extends string>(prefix: string, codes: readonly T[])
  : { [K in T]: `${string}.${K}` }
```
`prefix` is typed as `string`, so the return type is `{ [K in T]: \`${string}.${K}\` }` — too
wide to catch cross-catalog misuse. `AUTH_ERROR_CODES.INVALID_TOKEN` and
`PROJECT_ERROR_CODES.INVALID_TOKEN` would have the same type, allowing one to be assigned where
the other is expected.

**Fix:** Capture the prefix as a type parameter:
```typescript
export function createErrorCatalog<const P extends string, const T extends string>(
  prefix: P,
  codes: readonly T[],
): { [K in T]: `${P}.${K}` } {
  return Object.fromEntries(codes.map((c) => [c, `${prefix}.${c}`])) as {
    [K in T]: `${P}.${K}`;
  };
}
```

---

## Info

### IN-01: `cursor` DTO field has no maximum length constraint

**File:** `packages/backend/src/common/pagination/cursor-pagination.dto.ts:18-20`

**Issue:** `cursor` is validated only as `@IsString()` with no `@MaxLength()`. Cursor values in
Prisma cursor-based pagination are typically base64-encoded IDs (< 100 chars). Accepting an
unbounded string means the validation pipe passes arbitrarily large values into the service
layer and subsequently into Prisma query parameters. Prisma parameterises queries so SQL
injection is not a concern, but it is unnecessary surface area.

**Fix:**
```typescript
@IsOptional()
@IsString()
@MaxLength(512)   // base64-encoded compound cursor upper bound
cursor?: string;
```

---

### IN-02: `crypto.randomUUID()` used as an unimported global — Node version dependency

**Files:**
- `packages/backend/src/common/middleware/extract-correlation-id.ts:26`
- `packages/backend/src/common/exceptions/global-exception.filter.ts:60`

**Issue:** Both files call `crypto.randomUUID()` without importing from `node:crypto`. In
Node 19+ `globalThis.crypto` is stable and includes `randomUUID`. In Node 18 LTS the global
`crypto` object exists but is the Web Crypto API — `randomUUID()` is available but flagged
experimental until Node 19. If the project ever targets Node 16/17 or a restricted runtime
this silently breaks.

**Fix:** Use an explicit import to make the dependency unambiguous and lint-safe:
```typescript
import { randomUUID } from 'node:crypto';
// then use randomUUID() instead of crypto.randomUUID()
```

---

### IN-03: `/health/readiness` endpoint unauthenticated and not rate-limit exempt

**File:** `packages/backend/src/health/health.controller.ts:19-23`

**Issue:** `/health/readiness` is reachable without authentication and is subject to the global
`ThrottlerGuard` (100 req / 60 s per IP). Load balancer or Kubernetes probes hitting the
endpoint frequently from a shared cluster egress IP can exhaust the throttle budget, causing
legitimate health checks to return 429. Separately, an unauthenticated endpoint that reports
internal service status (database up/down) provides reconnaissance value to attackers even
after CR-01 is fixed.

**Fix — rate limit exemption:**
```typescript
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller({ path: 'health', version: '1' })
@RawResponse()
export class HealthController { ... }
```
**Fix — authentication:** Consider restricting `/readiness` to internal network CIDRs via
infrastructure (ingress/firewall rule) rather than application-level auth, since probes must
work before auth services are ready.

---

_Reviewed: 2026-07-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
