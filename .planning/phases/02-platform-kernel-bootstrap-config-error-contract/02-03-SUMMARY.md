---
phase: 02-platform-kernel-bootstrap-config-error-contract
plan: 03
subsystem: infra
tags: [nestjs, exception-filter, error-contract, correlation-id, prisma, tdd]

# Dependency graph
requires:
  - phase: 02-02
    provides: "AppConfigService (AppConfigModule) with isProduction getter"
provides:
  - "packages/backend/src/common/exceptions/error-codes.ts (PLATFORM_ERROR_CODES const, PlatformErrorCode type)"
  - "packages/backend/src/common/middleware/correlation-id.middleware.ts (CorrelationIdMiddleware stamping req.traceId)"
  - "packages/backend/src/common/exceptions/global-exception.filter.ts (GlobalExceptionFilter @Catch() with APP_FILTER support)"
  - "packages/backend/src/common/exceptions/prisma-exception.filter.ts (PrismaExceptionFilter P2002→409, P2025→404)"
  - "packages/backend/src/common/exceptions/global-exception.filter.spec.ts (6 unit tests, passing)"
  - "packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts (4 unit tests, passing)"
affects: [02-04, all backend domain plans using error envelope]

# Tech tracking
tech-stack:
  added:
    - "@types/express ^5.0.6 (devDependency in packages/backend — was missing, required for Express Request/Response types)"
  patterns:
    - "@Catch() with no arguments catches all unhandled exceptions including non-HttpException types"
    - "body['stack'] guarded by !config.isProduction — reads isProduction via injected AppConfigService, never process.env"
    - "PRISMA_HTTP_MAP Record<string, ...> with noUncheckedIndexedAccess — ?? fallback chain handles undefined map entries"
    - "Prisma namespace imported from @repo/database barrel, not @prisma/client directly (INFRA-14)"
    - "crypto.randomUUID() from Node 22 built-in — no uuid package needed"
    - "TDD RED/GREEN/REFACTOR cycle for both tasks"

key-files:
  created:
    - "packages/backend/src/common/exceptions/error-codes.ts — PLATFORM_ERROR_CODES const (4 codes) + PlatformErrorCode type"
    - "packages/backend/src/common/middleware/correlation-id.middleware.ts — CorrelationIdMiddleware with x-request-id/traceparent/randomUUID chain"
    - "packages/backend/src/common/exceptions/global-exception.filter.ts — GlobalExceptionFilter with stack suppression in production"
    - "packages/backend/src/common/exceptions/global-exception.filter.spec.ts — 6 unit tests (RED a6f19f3, GREEN 844ccae)"
    - "packages/backend/src/common/exceptions/prisma-exception.filter.ts — PrismaExceptionFilter P2002/P2025 mapping"
    - "packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts — 4 unit tests (RED 6c4d95a, GREEN 9ffc3c1)"
  modified:
    - "packages/backend/package.json — added @types/express devDependency (Rule 3 auto-fix)"

key-decisions:
  - "PLATFORM_ERROR_CODES implemented as const object with as const (not enum) — allows Phase 3 catalog to absorb without renaming (D-05)"
  - "GlobalExceptionFilter stack guard uses !this.config.isProduction (AppConfigService) not process.env — preserves INFRA-03 process.env ban"
  - "PrismaExceptionFilter constructor accepts AppConfigService for DI consistency even though it is not used in the filter body — future logging use (Phase 3)"
  - "PRISMA_HTTP_MAP contains exactly P2002 and P2025 — no speculative entries; per D-09, broader codes added per-domain in future phases"
  - "exception.meta is never referenced in PrismaExceptionFilter response body — fixed message strings only (T-02-06)"

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 02 Plan 03: Error Contract — PLATFORM_ERROR_CODES, Correlation Middleware, and Exception Filters Summary

**Four cross-cutting error infrastructure files created: PLATFORM_ERROR_CODES const, CorrelationIdMiddleware (crypto.randomUUID), GlobalExceptionFilter (stack suppression, traceId envelope), and PrismaExceptionFilter (P2002→409, P2025→404, meta never leaked) — all 17 unit tests pass, lint and typecheck clean.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-01T00:15:00Z
- **Completed:** 2026-07-01T00:22:32Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- `error-codes.ts`: `PLATFORM_ERROR_CODES` const object with 4 codes (`RESOURCE_CONFLICT`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`) using `PLATFORM.` prefix; exported `PlatformErrorCode` type
- `correlation-id.middleware.ts`: `CorrelationIdMiddleware` reads `x-request-id` → `traceparent` → `crypto.randomUUID()`; no external uuid package
- `global-exception.filter.ts`: `@Catch()` (no args) catches all exceptions; `body['stack']` only added when `!this.config.isProduction`; `traceId` reads from `request.traceId ?? 'unknown'`; `@Injectable()` for APP_FILTER DI
- `prisma-exception.filter.ts`: `PRISMA_HTTP_MAP` with exactly 2 entries; `@Catch(Prisma.PrismaClientKnownRequestError)`; imports `Prisma` from `@repo/database`; `exception.meta` never forwarded
- All 17 unit tests pass: 7 prior (sanity + env.schema) + 6 GlobalExceptionFilter + 4 PrismaExceptionFilter
- `npx tsc --noEmit` exits 0; `npm run lint` exits 0
- Zero direct `@prisma/client` imports anywhere in `packages/backend/src/`

## Task Commits

### Task 1: error-codes, correlation middleware, GlobalExceptionFilter + spec (INFRA-05)
1. **RED** — `a6f19f3`: `test(02-03): add failing GlobalExceptionFilter unit tests — RED phase`
2. **GREEN** — `844ccae`: `feat(02-03): implement error-codes, correlation middleware, GlobalExceptionFilter — GREEN phase (INFRA-05)`

### Task 2: PrismaExceptionFilter + spec (INFRA-06, INFRA-14)
3. **RED** — `6c4d95a`: `test(02-03): add failing PrismaExceptionFilter unit tests — RED phase`
4. **GREEN** — `9ffc3c1`: `feat(02-03): implement PrismaExceptionFilter — GREEN phase (INFRA-06, INFRA-14)`

## Files Created/Modified

- `packages/backend/src/common/exceptions/error-codes.ts` — pure constants file, no imports
- `packages/backend/src/common/middleware/correlation-id.middleware.ts` — NestMiddleware with built-in crypto
- `packages/backend/src/common/exceptions/global-exception.filter.ts` — @Catch() @Injectable() ExceptionFilter
- `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` — 6 Vitest tests
- `packages/backend/src/common/exceptions/prisma-exception.filter.ts` — @Catch(Prisma.PrismaClientKnownRequestError)
- `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` — 4 Vitest tests
- `packages/backend/package.json` — added `@types/express ^5.0.6` devDependency

## Decisions Made

- `as const` not `enum` for PLATFORM_ERROR_CODES — Phase 3 catalog absorbs it without renaming (D-05)
- `AppConfigService` injected into `PrismaExceptionFilter` even though not yet used — DI consistency for Phase 3 logging
- `exception.meta` not referenced anywhere in filter body — only `exception.code` used for the PRISMA_HTTP_MAP lookup
- PRISMA_HTTP_MAP scoped to P2002/P2025 exactly — broader codes are per-domain responsibility in future phases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @types/express devDependency in packages/backend**
- **Found during:** Task 1 GREEN (first tsc run)
- **Issue:** `npx tsc --noEmit` reported `error TS7016: Could not find a declaration file for module 'express'` for both `global-exception.filter.ts` and `correlation-id.middleware.ts`. `@types/express` was not present in `packages/backend/package.json` or the workspace root.
- **Fix:** `npm install --save-dev @types/express --workspace packages/backend` — added `@types/express ^5.0.6` as devDependency; lockfile updated.
- **Verification:** `npx tsc --noEmit` exits 0 after fix.
- **Files modified:** `packages/backend/package.json`, `package-lock.json`
- **Commit:** `844ccae` (included in GREEN commit)

**2. [Rule 1 - Bug] Unused variable in spec and `as any` return type lint errors**
- **Found during:** Task 1 GREEN (first lint run)
- **Issue:** Spec file had an unused `jsonArg` variable (line 23) and two `} as any` inline casts flagged by `@typescript-eslint/no-explicit-any`.
- **Fix:** Removed the unused variable; moved `eslint-disable-next-line` comments before the helper function declarations; changed `return { ... } as any` to explicit `: any` return type annotations on helper functions.
- **Files modified:** `packages/backend/src/common/exceptions/global-exception.filter.spec.ts`
- **Commit:** `844ccae` (included in GREEN commit)

## TDD Gate Compliance

### Task 1
- RED gate: commit `a6f19f3` (`test(02-03)`) — test file fails because `./global-exception.filter` does not exist
- GREEN gate: commit `844ccae` (`feat(02-03)`) — all 13 tests pass

### Task 2
- RED gate: commit `6c4d95a` (`test(02-03)`) — test file fails because `./prisma-exception.filter` does not exist
- GREEN gate: commit `9ffc3c1` (`feat(02-03)`) — all 17 tests pass

REFACTOR gate: not needed for either task — implementations were clean on first pass.

## Known Stubs

None. All PLATFORM_ERROR_CODES values are concrete strings, all filter logic is wired, no placeholder messages or TODO markers.

## Threat Flags

No new threat surface beyond what is in the plan's threat model.

STRIDE threat mitigations confirmed:
- T-02-05 (stack traces in production): mitigated — `body['stack']` only added when `!config.isProduction`; acceptance criterion Test 2 asserts `stack` undefined when `isProduction=true`
- T-02-06 (exception.meta leakage): mitigated — `PRISMA_HTTP_MAP` uses fixed message strings; `grep "exception.meta" prisma-exception.filter.ts` returns 0 lines
- T-02-07 (unknown Prisma error code): mitigated — unmapped codes produce status=500, errorCode=PLATFORM.INTERNAL_ERROR, message='Database operation failed' with no code or meta forwarded
- T-02-08 (inbound x-request-id spoofing): accepted per D-01 — traceId is correlation-only, not used for auth decisions

## Self-Check

- [x] `packages/backend/src/common/exceptions/error-codes.ts` exists with 4 PLATFORM_ERROR_CODES keys
- [x] `packages/backend/src/common/middleware/correlation-id.middleware.ts` exists, uses `crypto.randomUUID()`, no uuid package import
- [x] `packages/backend/src/common/exceptions/global-exception.filter.ts` exists with `@Catch()` and `@Injectable()`
- [x] `packages/backend/src/common/exceptions/prisma-exception.filter.ts` exists with `@Catch(Prisma.PrismaClientKnownRequestError)`
- [x] `grep "from '@prisma/client'" packages/backend/src/` returns 0 lines
- [x] `grep "exception.meta" prisma-exception.filter.ts` returns 0 lines
- [x] PRISMA_HTTP_MAP has exactly 2 keys (P2002, P2025)
- [x] `npm run test --workspace packages/backend` — 17/17 tests pass
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0

## Self-Check: PASSED

---
*Phase: 02-platform-kernel-bootstrap-config-error-contract*
*Completed: 2026-07-01*
