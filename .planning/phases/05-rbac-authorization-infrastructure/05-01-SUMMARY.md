---
phase: 05-rbac-authorization-infrastructure
plan: "01"
subsystem: authorization
tags: [rbac, decorator, error-catalog, exception-filter, forbidden]
dependency_graph:
  requires: []
  provides:
    - "@RequirePermissions() decorator + REQUIRE_PERMISSIONS_KEY metadata"
    - "AUTHZ_ERROR_CODES.PERMISSION_DENIED stable error code"
    - "PLATFORM.FORBIDDEN platform error code"
    - "GlobalExceptionFilter 403 mapping + explicit errorCode passthrough"
  affects:
    - packages/backend/src/authorization/
    - packages/backend/src/common/exceptions/
tech_stack:
  added: []
  patterns:
    - "SetMetadata variadic decorator (mirrors @Public() shape)"
    - "createErrorCatalog helper for per-domain error catalogs"
    - "HTTP status → errorCode map in GlobalExceptionFilter"
    - "Explicit errorCode passthrough from HttpException response object"
key_files:
  created:
    - packages/backend/src/authorization/decorators/require-permissions.decorator.ts
    - packages/backend/src/authorization/authorization-error-codes.ts
  modified:
    - packages/backend/src/common/exceptions/error-codes.ts
    - packages/backend/src/common/exceptions/global-exception.filter.ts
    - packages/backend/src/common/exceptions/global-exception.filter.spec.ts
decisions:
  - "errorCode passthrough reads from HttpException response object as opaque data; no import from src/authorization/ in the platform kernel (T-05-02 isolation preserved)"
  - "PLATFORM.FORBIDDEN is the status-based fallback for bare ForbiddenException; domain code AUTHZ.PERMISSION_DENIED travels as explicit data on the exception response"
metrics:
  duration: "~8 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 5 Plan 01: Authorization Primitives Summary

## One-Liner

`@RequirePermissions()` decorator plus `AUTHZ.PERMISSION_DENIED` catalog, with `GlobalExceptionFilter` extended to map 403 to `PLATFORM.FORBIDDEN` and surface explicit domain error codes from exception response objects without leaking permission details.

## What Was Built

### Task 1: @RequirePermissions Decorator + AUTHZ Error Catalog (commit: ec6d3b6)

Created two new files in `src/authorization/`:

- `decorators/require-permissions.decorator.ts` — exports `REQUIRE_PERMISSIONS_KEY = 'requiredPermissions'` and a variadic `RequirePermissions(...codes: string[])` factory returning `MethodDecorator & ClassDecorator` via `SetMetadata`. Mirrors the `@Public()` shape exactly. Empty/absent metadata means the guard does not gate (D-05).
- `authorization-error-codes.ts` — exports `AUTHZ_ERROR_CODES = createErrorCatalog('AUTHZ', ['PERMISSION_DENIED'] as const)`, resolving to `{ PERMISSION_DENIED: 'AUTHZ.PERMISSION_DENIED' }`.

### Task 2: PLATFORM.FORBIDDEN + Filter Enhancement (commit: a274c66)

- `error-codes.ts` — added `FORBIDDEN: 'PLATFORM.FORBIDDEN'` to `PLATFORM_ERROR_CODES`, closing PATTERNS gap 1.
- `global-exception.filter.ts` — added `[HttpStatus.FORBIDDEN]: PLATFORM_ERROR_CODES.FORBIDDEN` to `HTTP_STATUS_TO_ERROR_CODE`; enhanced `errorCode` derivation to read an explicit `errorCode` string from the `HttpException` response object (when present) before falling back to the status map. Platform kernel imports nothing from `src/authorization/` — the domain code travels as opaque data on the exception response.
- `global-exception.filter.spec.ts` — corrected the existing 403 test (was asserting the buggy `INTERNAL_ERROR` behavior), added a test asserting a bare `ForbiddenException` yields `PLATFORM.FORBIDDEN`, and added a test for explicit `AUTHZ.PERMISSION_DENIED` passthrough. Total: 10 tests all passing.

## Verification

- `npx tsc --noEmit` — PASS
- `npx vitest run src/common/exceptions/global-exception.filter.spec.ts` — PASS (10/10)
- `npm run lint` — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected existing test that asserted the old buggy behavior**
- **Found during:** Task 2
- **Issue:** `global-exception.filter.spec.ts` had a test named "uses INTERNAL_ERROR for unmapped HTTP status codes" that passed a `ForbiddenException` and expected `INTERNAL_ERROR`. This test was asserting the pre-existing bug we were fixing; leaving it would cause it to fail after the fix.
- **Fix:** Updated the test to assert the correct post-fix behavior (`PLATFORM.FORBIDDEN`) and renamed it to "maps FORBIDDEN status to PLATFORM.FORBIDDEN (not INTERNAL_ERROR)".
- **Files modified:** `packages/backend/src/common/exceptions/global-exception.filter.spec.ts`
- **Commit:** a274c66

## Threat Surface Scan

No new network endpoints, auth paths, or file-access patterns introduced. All changes are within the existing exception-handling infrastructure or new leaf-level authorization primitives. Threat mitigations T-05-01 and T-05-02 are both satisfied:
- T-05-01 (information disclosure): `AUTHZ.PERMISSION_DENIED` is a fixed constant; the message must be generic (enforced in Plan 03).
- T-05-02 (tampering): platform kernel (`global-exception.filter.ts`) reads `errorCode` as opaque data from the exception response object; no import from `src/authorization/`.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/backend/src/authorization/decorators/require-permissions.decorator.ts` — EXISTS
- `packages/backend/src/authorization/authorization-error-codes.ts` — EXISTS
- `packages/backend/src/common/exceptions/error-codes.ts` contains `FORBIDDEN` — VERIFIED
- `packages/backend/src/common/exceptions/global-exception.filter.ts` contains `FORBIDDEN` — VERIFIED
- Commit ec6d3b6 — EXISTS
- Commit a274c66 — EXISTS
