---
phase: 02-platform-kernel-bootstrap-config-error-contract
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - eslint.config.mjs
  - packages/backend/nest-cli.json
  - packages/backend/package.json
  - packages/backend/src/app.integration.spec.ts
  - packages/backend/src/app.module.ts
  - packages/backend/src/common/exceptions/error-codes.ts
  - packages/backend/src/common/exceptions/global-exception.filter.spec.ts
  - packages/backend/src/common/exceptions/global-exception.filter.ts
  - packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts
  - packages/backend/src/common/exceptions/prisma-exception.filter.ts
  - packages/backend/src/common/middleware/correlation-id.middleware.ts
  - packages/backend/src/config/app-config.service.ts
  - packages/backend/src/config/config.module.ts
  - packages/backend/src/config/env.schema.spec.ts
  - packages/backend/src/config/env.schema.ts
  - packages/backend/src/main.ts
findings:
  critical: 2
  warning: 8
  info: 3
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 02 delivers the platform kernel: environment schema validation, a global config service, two exception filters, a correlation-ID middleware, and an integration smoke test. The architecture is clean and the Prisma exception filter is correct. Two blockers must be fixed before this code ships: the `GlobalExceptionFilter` always emits `PLATFORM.INTERNAL_ERROR` regardless of HTTP exception type, and the correlation-ID middleware propagates raw, unvalidated client headers as the `traceId` — both log injection risk and a contract violation against the project's security rules. Eight additional warnings cover dead code, a tautological test assertion, a missing bootstrap error handler, weak URL validation, and a fragile undocumented filter-registration constraint.

---

## Critical Issues

### CR-01: GlobalExceptionFilter hardcodes INTERNAL_ERROR for all HTTP exceptions

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:39`

**Issue:** The `errorCode` field in the response envelope is always set to `PLATFORM_ERROR_CODES.INTERNAL_ERROR` regardless of the exception type. When NestJS throws `NotFoundException` (404), `ForbiddenException` (403), or `BadRequestException` (400), consumers receive `{ status: 404, errorCode: "PLATFORM.INTERNAL_ERROR" }`. The `PLATFORM_ERROR_CODES` constants `NOT_FOUND` and `VALIDATION_ERROR` are declared in `error-codes.ts` but are never referenced inside `GlobalExceptionFilter`. The unit tests never assert on `errorCode` for HTTP exceptions, so this passes the test suite undetected.

**Fix:**
```typescript
// Map HTTP status → platform error code
const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<number, PlatformErrorCode>> = {
  [HttpStatus.NOT_FOUND]:            PLATFORM_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]:             PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
  [HttpStatus.BAD_REQUEST]:          PLATFORM_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNPROCESSABLE_ENTITY]: PLATFORM_ERROR_CODES.VALIDATION_ERROR,
};

// In catch():
const errorCode = isHttp
  ? (HTTP_STATUS_TO_ERROR_CODE[status] ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR)
  : PLATFORM_ERROR_CODES.INTERNAL_ERROR;
```

---

### CR-02: Correlation-ID middleware propagates unsanitized client headers as traceId

**File:** `packages/backend/src/common/middleware/correlation-id.middleware.ts:8-11`

**Issue:** The raw value of `x-request-id` or `traceparent` is assigned directly to `req.traceId` without any validation:

```typescript
req.traceId = fromHeader ?? crypto.randomUUID();
```

A hostile client can supply an `x-request-id` value containing newlines, ANSI escape codes, or extremely long strings. This value is then written into response bodies (`traceId` field) and — when structured logging is added — into log lines, enabling log injection. CLAUDE.md Section 11 explicitly requires "Always assume hostile input" and "Never trust client data." There is no length cap, no character-set restriction, and no format validation.

**Fix:**
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractSafeTraceId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Accept a 32-char hex trace-id or a UUID-format string; reject everything else
  const candidate = raw.trim();
  if (UUID_RE.test(candidate)) return candidate;
  return undefined;
}

use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
  const rawId =
    (req.headers['x-request-id'] as string | undefined) ||
    extractTraceparentId(req.headers['traceparent'] as string | undefined);

  req.traceId = extractSafeTraceId(rawId) ?? crypto.randomUUID();
  next();
}
```

---

## Warnings

### WR-01: Filter registration order is silently critical and undocumented

**File:** `packages/backend/src/app.module.ts:11-14`

**Issue:** `GlobalExceptionFilter` must be registered before `PrismaExceptionFilter` because NestJS gives the last-registered `APP_FILTER` higher priority in the DI filter chain. If the two lines are ever swapped (e.g., during a refactor or merge conflict), `GlobalExceptionFilter` (which carries `@Catch()` — catches everything) would intercept all Prisma errors before `PrismaExceptionFilter` runs, silently breaking the `RESOURCE_CONFLICT` / `NOT_FOUND` error-code mapping. Nothing in the code communicates this constraint.

**Fix:** Add an inline comment documenting the ordering invariant:
```typescript
providers: [
  // ORDER MATTERS: global catch-all must come first so that the more-specific
  // PrismaExceptionFilter (registered last = highest priority) wins for Prisma errors.
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
],
```

---

### WR-02: String() coercion of array message will produce garbled output when ValidationPipe is added

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:32`

**Issue:** When NestJS's `ValidationPipe` rejects a request, `exception.getResponse().message` is a `string[]` (e.g., `["name must be a string", "email must be a valid email"]`). The current code does:

```typescript
String((rawResponse as Record<string, unknown>)['message'])
```

`String(["a","b"])` produces `"a,b"` — a single comma-joined string. API consumers will receive a malformed, non-structured message rather than the array they expect.

**Fix:**
```typescript
const rawMessage = (rawResponse as Record<string, unknown>)['message'];
const message = Array.isArray(rawMessage)
  ? rawMessage.join('; ')  // or keep as array in the body
  : typeof rawMessage === 'string'
    ? rawMessage
    : exception.message;
```

---

### WR-03: traceId fallback is the magic string 'unknown' instead of a generated UUID

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:41`

**Issue:** `traceId: request.traceId ?? 'unknown'` — if the correlation middleware has not run (e.g., future WebSocket or RPC context, misconfiguration, or a race condition during bootstrap), the traceId in the response and logs will be the literal string `'unknown'`, making log correlation impossible and silently violating the UUID contract that the integration test enforces on all other paths.

**Fix:**
```typescript
traceId: request.traceId ?? crypto.randomUUID(),
```

---

### WR-04: PrismaExceptionFilter injects AppConfigService but never uses it

**File:** `packages/backend/src/common/exceptions/prisma-exception.filter.ts:29`

**Issue:** `AppConfigService` is injected via the constructor but is never accessed anywhere in the `catch` method. This is dead code. The `config` private field adds noise to every code reader's mental model (why is it here? what should it control?) and violates the "no dead code" rule in CLAUDE.md's Definition of Done.

**Fix:** Remove the constructor parameter, or implement the intended behavior (e.g., include `exception.code` in the body when `!config.isProduction`):
```typescript
// Option A — remove entirely if config is never needed:
// constructor() {}  (or omit constructor)

// Option B — implement the dev-mode behavior that was presumably intended:
if (!this.config.isProduction) {
  body['prismaCode'] = exception.code;
}
```

---

### WR-05: PrismaExceptionFilter has the same 'unknown' traceId fallback

**File:** `packages/backend/src/common/exceptions/prisma-exception.filter.ts:45`

**Issue:** Same as WR-03. `traceId: request.traceId ?? 'unknown'` will write the literal `'unknown'` to the response when the middleware has not stamped the request.

**Fix:**
```typescript
traceId: request.traceId ?? crypto.randomUUID(),
```

---

### WR-06: traceparent header used as a whole value, not as a trace-id

**File:** `packages/backend/src/common/middleware/correlation-id.middleware.ts:9`

**Issue:** The W3C Trace Context header `traceparent` has the format `{version}-{trace-id}-{parent-id}-{trace-flags}` (e.g., `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`). Assigning the entire header value to `req.traceId` means the `traceId` field in response envelopes will be a 55-character multi-segment string, not a UUID. The integration test's UUID regex assertion (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-...$/`) would fail if a client sends a valid `traceparent`. The test only passes because it never sends this header.

**Fix:**
```typescript
function extractTraceparentId(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split('-');
  // traceparent: version(2)-traceId(32 hex)-parentId(16 hex)-flags(2)
  return parts.length >= 2 ? parts[1] : undefined;
}
```

---

### WR-07: bootstrap() called without error handler — unhandled rejection on startup failure

**File:** `packages/backend/src/main.ts:16`

**Issue:** `bootstrap()` is called bare without a `.catch()` handler. If `NestFactory.create()` fails (e.g., config validation throws, a required provider cannot be instantiated), or `app.listen()` fails (port already in use), the result is an unhandled promise rejection. In Node.js v15+, this terminates the process, but with no structured log line, no guaranteed non-zero exit code, and no actionable message — just an `UnhandledPromiseRejectionWarning`.

**Fix:**
```typescript
bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
```

---

### WR-08: DATABASE_URL validated only for non-empty; syntactically invalid URLs reach runtime

**File:** `packages/backend/src/config/env.schema.ts:6`

**Issue:** `z.string().min(1, 'DATABASE_URL is required')` accepts any non-empty string. A value like `notavalidurl` or `postgres://` (missing host) passes the schema at startup but causes an opaque Prisma connection error at runtime when the first query executes. The project's principle is to fail early with actionable errors.

**Fix:**
```typescript
DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
```

---

## Info

### IN-01: GlobalExceptionFilter tests do not assert errorCode for HTTP exceptions

**File:** `packages/backend/src/common/exceptions/global-exception.filter.spec.ts:20-29`

**Issue:** The test `'returns error envelope for HttpException'` checks `success`, `message`, and `traceId` but not `errorCode`. This coverage gap is the direct reason CR-01 passed the test suite undetected. Adding an assertion here would have caught the hardcoded `INTERNAL_ERROR` immediately.

**Fix:** Add to the test:
```typescript
expect(body.errorCode).toBe(PLATFORM_ERROR_CODES.NOT_FOUND);
```

---

### IN-02: Integration test for URI-versioning ordering is a tautology

**File:** `packages/backend/src/app.integration.spec.ts:58-59`

**Issue:** The test asserts `expect(wrongStatus).toBe(404)` for `GET /v1/api/nonexistent`. Because there are no routes defined in `AppModule`, both `/api/v1/nonexistent` and `/v1/api/nonexistent` return 404 from the catch-all `GlobalExceptionFilter`. This assertion will pass regardless of whether the prefix/versioning order is correct or reversed. The comment at line 55-57 actually acknowledges this but leaves the useless assertion in place.

**Fix:** Either remove the `wrongStatus` assertion and document why it is not testable with a pure catch-all filter, or add a real versioned route to the test module that only resolves under `/api/v1`.

---

### IN-03: Integration test manually duplicates bootstrap config from main.ts — drift risk

**File:** `packages/backend/src/app.integration.spec.ts:29-33`

**Issue:** The test manually calls `app.setGlobalPrefix('api')` and `app.enableVersioning(...)` to mirror `main.ts`. If `main.ts` is later updated to add a global pipe, guard, or interceptor, the integration test silently diverges and no longer reflects production behavior.

**Fix:** Extract the configuration step into a shared `configureApp(app: INestApplication)` helper in a test-support file and call it in both `main.ts` and the integration spec:
```typescript
// src/configure-app.ts
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
}
```

---

_Reviewed: 2026-07-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
