---
phase: 02-platform-kernel-bootstrap-config-error-contract
verified: 2026-07-01T01:15:00Z
status: gaps_found
score: 4/5 roadmap success criteria verified
overrides_applied: 0
gaps:
  - truth: "Any thrown error returns a consistent envelope where errorCode accurately reflects the error type (INFRA-05 / SC4)"
    status: failed
    reason: "GlobalExceptionFilter hardcodes PLATFORM_ERROR_CODES.INTERNAL_ERROR for ALL exceptions including HTTP ones (404 NotFoundException, 400 BadRequestException). PLATFORM_ERROR_CODES.VALIDATION_ERROR is declared in error-codes.ts but is never referenced in any production file — it is dead code. PLATFORM_ERROR_CODES.NOT_FOUND is used only in PrismaExceptionFilter for Prisma P2025, not for HTTP 404 responses. A client receiving HTTP 404, errorCode: 'PLATFORM.INTERNAL_ERROR' cannot distinguish a not-found condition from a server crash. Code review CR-01 documents this as a critical pre-ship blocker."
    artifacts:
      - path: "packages/backend/src/common/exceptions/global-exception.filter.ts"
        issue: "Line 39: `errorCode: PLATFORM_ERROR_CODES.INTERNAL_ERROR` is unconditional. No HTTP status-to-errorCode mapping exists in this file."
      - path: "packages/backend/src/common/exceptions/error-codes.ts"
        issue: "PLATFORM_ERROR_CODES.VALIDATION_ERROR defined on line 4 but not referenced in any production source file. Dead code."
      - path: "packages/backend/src/common/exceptions/global-exception.filter.spec.ts"
        issue: "Test 1 ('returns error envelope for HttpException') asserts success, message, traceId but never asserts errorCode. This test gap allowed the hardcoded INTERNAL_ERROR to pass undetected."
    missing:
      - "Add HTTP status → errorCode mapping in GlobalExceptionFilter: 404→NOT_FOUND, 400→VALIDATION_ERROR, 409→RESOURCE_CONFLICT, all others→INTERNAL_ERROR"
      - "Add `expect(body.errorCode).toBe(PLATFORM_ERROR_CODES.NOT_FOUND)` assertion to global-exception.filter.spec.ts Test 1 to prevent regression"
human_verification:
  - test: "Review accepted risk T-02-08 — correlation-ID middleware propagates unsanitized client headers as traceId"
    expected: "Either (a) accept: document that Phase 3 structured-logging implementation will sanitize at the logging layer, or (b) reject: add UUID/hex validation and traceparent field extraction to CorrelationIdMiddleware before Phase 3 logging is wired"
    why_human: "The plan threat model accepted T-02-08 explicitly (disposition: accept). The code review CR-02 flags it as a critical defect citing CLAUDE.md Section 11. A human must decide whether the accepted disposition stands or should be upgraded to mitigate before Phase 3 adds structured logging that would echo unsanitized traceId values into log lines."
  - test: "Review WR-06 — traceparent header assigns entire W3C header string to traceId, not just the trace-id segment"
    expected: "The W3C traceparent format is `{version}-{trace-id}-{parent-id}-{flags}`. If a client sends a valid traceparent, req.traceId becomes a 55-char multi-segment string rather than a UUID. The integration test UUID regex assertion would fail for such requests."
    why_human: "The current integration test never sends a traceparent header so this defect is latent. Human must decide: (a) extract just the trace-id segment from traceparent or (b) accept that traceparent support is incomplete and remove the traceparent fallback until Phase 3 implements W3C Trace Context properly."
---

# Phase 2: Platform Kernel — Bootstrap, Config & Error Contract — Verification Report

**Phase Goal:** Establish the platform kernel — a running NestJS application with typed config (Zod env schema), a structured error contract (typed exception filters + correlation IDs), and a full turbo pipeline that passes lint, typecheck, test, and build.
**Verified:** 2026-07-01T01:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Step 0: Previous Verification

No previous verification file found. Initial mode.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC1 (INFRA-01) | App boots and serves routes under /api/v1 | VERIFIED | `main.ts` lines 10-11: `setGlobalPrefix('api')` then `enableVersioning(URI)`. Integration test: `GET /api/v1/nonexistent` returns 404 with our envelope. Turbo build: 7/7 tasks pass. |
| SC2 (INFRA-02) | App refuses to boot on missing/invalid env var; all config via typed service | VERIFIED | `envSchema.parse(env)` in `config.module.ts` (not safeParse). All 6 `env.schema.spec.ts` tests pass. `app-config.service.ts` uses `ConfigService<Env, true>`. No `process.env` in production files. |
| SC3 (INFRA-03) | Direct process.env outside config module fails lint | VERIFIED | `eslint.config.mjs` has `no-restricted-properties` for all `*.ts` with escape hatches for `packages/backend/src/config/**/*.ts` and `**/*.spec.ts`. `npm run lint` exits 0. Zero `process.env` in production source. |
| SC4 (INFRA-05) | Any error returns `{success, errorCode, message, traceId}`, no stack leaks in production | FAILED | Shape is present and stack is correctly suppressed in production. BUT: `GlobalExceptionFilter` hardcodes `PLATFORM_ERROR_CODES.INTERNAL_ERROR` for ALL exceptions including 404 and 400. `PLATFORM_ERROR_CODES.VALIDATION_ERROR` is defined but never used anywhere. A 404 NotFoundException returns `errorCode: 'PLATFORM.INTERNAL_ERROR'` — semantically incorrect. Code review CR-01 identifies this as a critical pre-ship blocker. |
| SC5 (INFRA-06 + INFRA-14) | Prisma errors map to correct HTTP status without schema leakage; Prisma only through @repo/database | VERIFIED | `PrismaExceptionFilter`: P2002→409/RESOURCE_CONFLICT, P2025→404/NOT_FOUND, unknown→500/INTERNAL_ERROR. `exception.meta` never referenced. `grep "@prisma/client" packages/backend/src/` returns 0 lines. All 4 Prisma filter unit tests pass. |

**Score:** 4/5 roadmap success criteria verified

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/package.json` | @nestjs/platform-express, @nestjs/config, zod, @nestjs/testing, supertest, @types/supertest | VERIFIED | All 6 packages present at expected versions. |
| `packages/backend/nest-cli.json` | `entryFile: "main"` with SWC builder preserved | VERIFIED | `entryFile: "main"`, `builder.type: "swc"`, `deleteOutDir: true` — all correct. |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `eslint.config.mjs` | `no-restricted-properties` ban with escape hatches | VERIFIED | Ban rule for `**/*.ts`, escape hatch for `packages/backend/src/config/**/*.ts`, escape hatch for `**/*.spec.ts`. prettierConfig remains last among rule objects. |
| `packages/backend/src/config/env.schema.ts` | `envSchema` (ZodObject) + `Env` type | VERIFIED | `z.coerce.number()` for PORT, `z.string().min(1)` for DATABASE_URL, `z.enum(...)` for NODE_ENV. |
| `packages/backend/src/config/env.schema.spec.ts` | 6 unit tests, all passing | VERIFIED | All 6 tests pass: coercion, defaults, missing DATABASE_URL, PORT=0, PORT=abc, empty DATABASE_URL. |
| `packages/backend/src/config/app-config.service.ts` | `AppConfigService` with `ConfigService<Env, true>` | VERIFIED | `get<K extends keyof Env>` with strict inference, `isProduction` getter. |
| `packages/backend/src/config/config.module.ts` | `@Global()` AppConfigModule with `envSchema.parse` validate | VERIFIED | `@Global()`, `ConfigModule.forRoot({ validate: (env) => envSchema.parse(env) })`, exports `AppConfigService`. |

### Plan 02-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/common/exceptions/error-codes.ts` | `PLATFORM_ERROR_CODES` const + `PlatformErrorCode` type | STUB (partial) | Constants declared correctly. BUT `VALIDATION_ERROR` is dead code — never referenced in any production file. |
| `packages/backend/src/common/middleware/correlation-id.middleware.ts` | CorrelationIdMiddleware stamping req.traceId | VERIFIED | x-request-id → traceparent → crypto.randomUUID(). No external uuid package. |
| `packages/backend/src/common/exceptions/global-exception.filter.ts` | GlobalExceptionFilter @Catch() with correct error envelope | PARTIAL | Shape correct. Stack suppression in production correct. BUT errorCode is always INTERNAL_ERROR — no HTTP status routing. |
| `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` | 6 unit tests passing | VERIFIED | All 6 tests pass. Spec gap: no test asserts errorCode value for HTTP exceptions (allows hardcoded INTERNAL_ERROR to pass). |
| `packages/backend/src/common/exceptions/prisma-exception.filter.ts` | PrismaExceptionFilter with P2002/P2025 mapping | VERIFIED | Correct mapping, no meta leakage, imports from `@repo/database`. |
| `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` | 4 unit tests passing | VERIFIED | All 4 tests pass including meta-exclusion test. |

### Plan 02-04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/main.ts` | Bootstrap: setGlobalPrefix then enableVersioning, config.get('PORT') | VERIFIED | Line 10: `setGlobalPrefix('api')`, line 11: `enableVersioning(URI)`. `config.get('PORT')` — no process.env. |
| `packages/backend/src/app.module.ts` | AppModule: imports, APP_FILTER pair, CorrelationIdMiddleware on '*' | VERIFIED | `imports: [AppConfigModule, PrismaModule]`. GlobalExceptionFilter registered first, PrismaExceptionFilter second. `forRoutes('*')`. |
| `packages/backend/src/app.integration.spec.ts` | 3 integration tests; traceId UUID assertion | VERIFIED | 3 tests pass. traceId matches UUID v4 regex. MockPrismaModule overrides PrismaModule. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `config.module.ts` ConfigModule.forRoot validate() | `env.schema.ts` envSchema.parse | `validate: (env) => envSchema.parse(env)` | VERIFIED | config.module.ts line 10-12 confirmed. |
| `app-config.service.ts` AppConfigService.get | `@nestjs/config` ConfigService<Env, true> | `config.get(key, { infer: true })` | VERIFIED | Strict inference flag present. |
| `global-exception.filter.ts` | `AppConfigService.isProduction` | `constructor(private readonly config: AppConfigService)` | VERIFIED | `!this.config.isProduction` gates stack. |
| `global-exception.filter.ts` | `request.traceId` | `host.switchToHttp().getRequest<Request & { traceId?: string }>()` | VERIFIED | `request.traceId ?? 'unknown'` in body. |
| `app.module.ts` providers | `GlobalExceptionFilter` (first) | `{ provide: APP_FILTER, useClass: GlobalExceptionFilter }` | VERIFIED | Index 0. |
| `app.module.ts` providers | `PrismaExceptionFilter` (second) | `{ provide: APP_FILTER, useClass: PrismaExceptionFilter }` | VERIFIED | Index 1 — runs first per reverse NestJS order. |
| `app.module.ts` configure() | `CorrelationIdMiddleware` | `consumer.apply(CorrelationIdMiddleware).forRoutes('*')` | VERIFIED | Covers all routes. |
| `app.module.ts` imports | `@repo/database` PrismaModule | `import { PrismaModule } from '@repo/database'` | VERIFIED | No new PrismaClient instantiation. |
| `main.ts` setGlobalPrefix | `main.ts` enableVersioning | setGlobalPrefix line 10 before enableVersioning line 11 | VERIFIED | Ordering correct. |
| `eslint.config.mjs` no-restricted-properties | config/ escape hatch | second rule object files: `packages/backend/src/config/**/*.ts` | VERIFIED | Escape hatch present. |

---

## Data-Flow Trace (Level 4)

Applicable artifacts rendering dynamic data: integration test response body.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `app.integration.spec.ts` | `body.traceId` | `CorrelationIdMiddleware` → `crypto.randomUUID()` | Yes — UUID generated per-request | FLOWING |
| `app.integration.spec.ts` | `body.errorCode` | `GlobalExceptionFilter` hardcoded `PLATFORM_ERROR_CODES.INTERNAL_ERROR` | Static value (not semantically correct for 404) | STATIC — CR-01 defect |
| `config.module.ts` | Env variables | `ConfigModule.forRoot` reads process.env via NestJS at bootstrap | Yes — real env vars | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All backend tests pass | `npm run test --workspace packages/backend` | 5 test files, 20/20 tests pass | PASS |
| Full turbo pipeline | `npx turbo run lint typecheck test build` | 7/7 tasks successful | PASS |
| TypeScript typecheck | `npx tsc --noEmit --project packages/backend/tsconfig.json` | No errors | PASS |
| Zero @prisma/client imports | `grep -r "from '@prisma/client'" packages/backend/src/` | 0 lines | PASS |
| VALIDATION_ERROR dead code | `grep -rn "VALIDATION_ERROR" packages/backend/src/ \| grep -v spec \| grep -v error-codes` | 0 lines — only defined, never used | FAIL (dead code confirms CR-01) |

---

## Probe Execution

Step 7c: SKIPPED — not a migration/CLI phase. No `scripts/*/tests/probe-*.sh` files exist.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 02-01, 02-04 | NestJS boots under /api/v1 URI versioning | SATISFIED | setGlobalPrefix before enableVersioning; integration test confirms /api/v1 routes |
| INFRA-02 | 02-02 | Typed fail-fast config with Zod validation | SATISFIED | envSchema.parse in validate callback; 6 unit tests cover all fail-fast cases |
| INFRA-03 | 02-02 | process.env lint ban outside config module | SATISFIED | no-restricted-properties rule active; 0 violations in production source |
| INFRA-05 | 02-03, 02-04 | Global exception filter with consistent envelope | BLOCKED (CR-01) | Envelope shape present, traceId is UUID, stack suppressed in production. BUT errorCode is always INTERNAL_ERROR for HTTP exceptions — NOT_FOUND and VALIDATION_ERROR codes defined but unused |
| INFRA-06 | 02-03 | Prisma errors map to correct HTTP status without schema leakage | SATISFIED | P2002→409/RESOURCE_CONFLICT, P2025→404/NOT_FOUND, unknown→500; exception.meta never forwarded |
| INFRA-14 | 02-01, 02-03, 02-04 | Prisma accessed only through @repo/database | SATISFIED | grep returns 0 lines for @prisma/client imports in packages/backend/src/ |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `global-exception.filter.ts` | 39 | `errorCode: PLATFORM_ERROR_CODES.INTERNAL_ERROR` (unconditional) | BLOCKER | All HTTP exceptions (404, 400, 403) return errorCode: 'PLATFORM.INTERNAL_ERROR' — incorrect error semantics, confuses API consumers |
| `error-codes.ts` | 4 | `VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR'` (never used in production) | BLOCKER | Dead code. VALIDATION_ERROR was intended for 400 responses but GlobalExceptionFilter never calls it |
| `global-exception.filter.spec.ts` | 20-29 | Test 1 never asserts `body.errorCode` | WARNING | Coverage gap that hid CR-01 — test passes even though errorCode is always INTERNAL_ERROR |
| `correlation-id.middleware.ts` | 8-11 | Raw header value assigned to req.traceId without sanitization | WARNING | Log injection risk when Phase 3 adds structured logging; traceparent header assigns 55-char string not UUID (WR-06) |
| `app.module.ts` | 11-14 | APP_FILTER registration order has no explanatory comment | WARNING | If order is ever swapped (refactor/merge conflict), PrismaExceptionFilter silently stops working — nothing in the code communicates the invariant |
| `main.ts` | 16 | `bootstrap()` called without `.catch()` handler | WARNING | Unhandled promise rejection on NestFactory.create() or app.listen() failure gives no structured log output |

---

## Critical Defects from Code Review (02-REVIEW.md)

### CR-01 — GlobalExceptionFilter errorCode mapping broken (BLOCKER)

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:39`

**Verified:** The implementation hardcodes `PLATFORM_ERROR_CODES.INTERNAL_ERROR` for every exception type. Grep confirms:

- `PLATFORM_ERROR_CODES.VALIDATION_ERROR` — defined in error-codes.ts, never used in any production file
- `PLATFORM_ERROR_CODES.NOT_FOUND` — only in PrismaExceptionFilter (for Prisma P2025), not for HTTP 404 NotFoundException

**Impact on SC4:** A client receives `HTTP 404` with `errorCode: "PLATFORM.INTERNAL_ERROR"`. This contradicts the stated phase goal of "a structured error contract" because the contract delivers incorrect semantics for any HTTP exception that is not a 5xx.

**Required fix before proceeding:**
```typescript
// In global-exception.filter.ts catch():
const HTTP_ERROR_CODE_MAP: Partial<Record<number, PlatformErrorCode>> = {
  [HttpStatus.NOT_FOUND]:            PLATFORM_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]:             PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
  [HttpStatus.BAD_REQUEST]:          PLATFORM_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNPROCESSABLE_ENTITY]: PLATFORM_ERROR_CODES.VALIDATION_ERROR,
};

const errorCode = isHttp
  ? (HTTP_ERROR_CODE_MAP[status] ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR)
  : PLATFORM_ERROR_CODES.INTERNAL_ERROR;
```

### CR-02 — Unsanitized header propagation in CorrelationIdMiddleware (WARNING → Human decision needed)

**File:** `packages/backend/src/common/middleware/correlation-id.middleware.ts:8-11`

**Verified:** Raw header value assigned directly to `req.traceId` with no sanitization, length cap, or format validation. Plan threat model T-02-08 accepted this risk with disposition `accept`. Code review says CLAUDE.md Section 11 ("Always assume hostile input") requires mitigation.

Additionally (WR-06): A valid W3C `traceparent` header (`00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`) would assign a 55-character multi-segment string to `req.traceId`. The integration test's UUID regex assertion passes only because no `traceparent` is ever sent in tests.

---

## Human Verification Required

### 1. Accepted-risk review — unsanitized correlation ID headers (CR-02)

**Test:** Evaluate whether T-02-08 disposition `accept` should be upgraded to `mitigate` before Phase 3 adds structured logging.
**Expected:** Decision documented in 02-DISCUSSION-LOG.md or the gap remediation plan: either (a) accept and plan Phase 3 sanitization at the logging layer, or (b) add UUID/format validation to CorrelationIdMiddleware now.
**Why human:** The plan threat model accepted this risk; the code review flags it as a security blocker per CLAUDE.md Section 11. Competing design authorities — requires developer judgment.

### 2. traceparent parsing correctness (WR-06)

**Test:** Decide whether to (a) extract only the trace-id segment from a W3C `traceparent` header, (b) reject `traceparent` and only accept `x-request-id`, or (c) defer to Phase 3 Observability where W3C Trace Context is explicitly designed.
**Expected:** The current implementation would fail the UUID regex if a client sends a valid `traceparent`. Either fix before Phase 3 or document that `traceparent` support is incomplete.
**Why human:** The correct behavior depends on whether distributed tracing (INFRA-04, deferred to Phase 3) will own this header or whether the Phase 2 middleware should partially handle it.

---

## Gaps Summary

One confirmed blocker prevents the phase goal from being fully achieved:

**CR-01 (BLOCKER):** `GlobalExceptionFilter` hardcodes `PLATFORM.INTERNAL_ERROR` as the `errorCode` for every exception it handles, including HTTP `NotFoundException` (404), `BadRequestException` (400), and `ForbiddenException` (403). The error constants `PLATFORM_ERROR_CODES.NOT_FOUND` and `PLATFORM_ERROR_CODES.VALIDATION_ERROR` are defined but unused in production code — `VALIDATION_ERROR` is never referenced anywhere. The phase goal requires "a structured error contract" but delivers a contract where `errorCode` values do not distinguish error types for HTTP exceptions.

**Root cause:** Plan 02-03 task 1 specified `errorCode: PLATFORM_ERROR_CODES.INTERNAL_ERROR` without a per-status mapping, and the integration test in plan 02-04 asserted exactly this value (`errorCode: 'PLATFORM.INTERNAL_ERROR'`), creating a test that confirmed the wrong behavior. The implementation faithfully executed the plan, but the plan had a design flaw.

**Two warnings require human decisions** before Phase 3 adds structured logging: the unsanitized header propagation in `CorrelationIdMiddleware` (CR-02) and the incomplete `traceparent` parsing (WR-06).

All other phase deliverables — `entryFile`, package installation, Zod fail-fast config, ESLint process.env ban, PrismaExceptionFilter mappings, INFRA-14 boundary — are fully verified and production-ready. The turbo pipeline (7/7 tasks) and all 20 tests pass on the main branch.

---

_Verified: 2026-07-01T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
