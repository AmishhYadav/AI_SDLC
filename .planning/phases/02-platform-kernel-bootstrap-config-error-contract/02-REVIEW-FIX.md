---
phase: 02-platform-kernel-bootstrap-config-error-contract
fixed_at: 2026-07-01T01:16:00Z
review_path: .planning/phases/02-platform-kernel-bootstrap-config-error-contract/02-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-07-01T01:16:00Z
**Source review:** `.planning/phases/02-platform-kernel-bootstrap-config-error-contract/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (2 Critical + 8 Warning; Info excluded per scope)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: GlobalExceptionFilter hardcodes INTERNAL_ERROR for all HTTP exceptions

**Files modified:** `packages/backend/src/common/exceptions/global-exception.filter.ts`, `packages/backend/src/common/exceptions/global-exception.filter.spec.ts`
**Commit:** `5a0b7b0`
**Applied fix:**
- Added `HTTP_STATUS_TO_ERROR_CODE` map: 404→NOT_FOUND, 409→RESOURCE_CONFLICT, 400/422→VALIDATION_ERROR, all others→INTERNAL_ERROR
- Imported `PlatformErrorCode` type from error-codes.ts
- `errorCode` is now derived from the map (with INTERNAL_ERROR fallback) instead of hardcoded
- Added test assertions: per-status errorCode mapping, unmapped status falls back to INTERNAL_ERROR, non-HttpException uses INTERNAL_ERROR, array message joins with '; '

### CR-02: Correlation-ID middleware propagates unsanitized client headers as traceId

**Files modified:** `packages/backend/src/common/middleware/correlation-id.middleware.ts`
**Commits:** `831a5ea`, `22ad2de`
**Applied fix:**
- Added `extractSafeTraceId()`: validates UUID format via regex, trims to 128 chars, returns `undefined` for non-matching values
- Added `extractTraceparentId()`: parses W3C traceparent header, extracts segment[1] (32-char hex trace-id), converts to UUID format (8-4-4-4-12)
- Updated `use()` to apply both sanitizers in priority order, falling back to `crypto.randomUUID()`
- Guarded `parts[1]` array access with explicit `!traceHex` check (required by `noUncheckedIndexedAccess: true` in tsconfig)

### WR-01: Filter registration order is silently critical and undocumented

**Files modified:** `packages/backend/src/app.module.ts`
**Commit:** `13a7b16`
**Applied fix:** Added block comment above the `APP_FILTER` provider registrations explaining NestJS reverse-priority execution order and the consequence of swapping the two lines (GlobalExceptionFilter would intercept all Prisma errors, breaking RESOURCE_CONFLICT/NOT_FOUND codes).

### WR-02: String() coercion of array message produces garbled output

**Files modified:** `packages/backend/src/common/exceptions/global-exception.filter.ts`
**Commit:** `5a0b7b0` (combined with CR-01)
**Applied fix:** Replaced `String(rawMessage)` with a three-way check: `Array.isArray` joins with `'; '`, `typeof === 'string'` passes through, fallback to `exception.message`.

### WR-03: traceId fallback is magic string 'unknown'

**Files modified:** `packages/backend/src/common/exceptions/global-exception.filter.ts`
**Commit:** `5a0b7b0` (combined with CR-01)
**Applied fix:** Replaced `request.traceId ?? 'unknown'` with `request.traceId ?? crypto.randomUUID()`.

### WR-04: PrismaExceptionFilter injects AppConfigService but never uses it

**Files modified:** `packages/backend/src/common/exceptions/prisma-exception.filter.ts`, `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts`
**Commit:** `4ba0cf5`
**Applied fix:** Removed the `constructor(private readonly config: AppConfigService) {}` and its import. Updated the spec to instantiate `PrismaExceptionFilter()` without arguments.

### WR-05: PrismaExceptionFilter has same 'unknown' traceId fallback

**Files modified:** `packages/backend/src/common/exceptions/prisma-exception.filter.ts`
**Commit:** `4ba0cf5` (combined with WR-04)
**Applied fix:** Replaced `request.traceId ?? 'unknown'` with `request.traceId ?? crypto.randomUUID()`.

### WR-06: traceparent header used as whole value, not as trace-id

**Files modified:** `packages/backend/src/common/middleware/correlation-id.middleware.ts`
**Commits:** `831a5ea`, `22ad2de` (combined with CR-02)
**Applied fix:** `extractTraceparentId()` splits on `-`, takes segment[1] (32-char hex trace-id), validates format, and converts to UUID format so the value passes the UUID regex contract.

### WR-07: bootstrap() called without error handler

**Files modified:** `packages/backend/src/main.ts`
**Commit:** `b530a58`
**Applied fix:** Added `.catch((err: unknown) => { console.error('Fatal error during bootstrap:', err); process.exit(1); })` after `bootstrap()`.

### WR-08: DATABASE_URL validated only for non-empty

**Files modified:** `packages/backend/src/config/env.schema.ts`
**Commit:** `816dc14`
**Applied fix:** Changed `z.string().min(1, 'DATABASE_URL is required')` to `z.string().url('DATABASE_URL must be a valid URL')`. Verified with Zod v4.4.3 that `z.string().url()` is supported and all existing test values (`'postgresql://x'`) still pass.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-01T01:16:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
