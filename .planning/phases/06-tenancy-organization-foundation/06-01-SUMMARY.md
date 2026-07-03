---
phase: 06-tenancy-organization-foundation
plan: "01"
subsystem: tenancy
tags: [tenancy, prisma-extensions, cls, multi-tenant, base-repository, tdd]
dependency_graph:
  requires: []
  provides:
    - TENANT_ERROR_CODES (5-entry error catalog)
    - IS_NO_TENANT_SCOPE_KEY / @NoTenantScope decorator
    - TenantContextService (typed CLS getters)
    - TenantedPrismaService (Prisma $extends org-scoped client)
    - BaseRepository (abstract class with getSoftDeleteData())
  affects:
    - packages/backend/src/tenancy/ (new leaf module directory)
tech_stack:
  added: []
  patterns:
    - Prisma $extends query hook for org-scoped auto-injection
    - CLS closure capture at construction time (read at query execution time)
    - Fail-closed D-08: ForbiddenException on missing orgId for scoped model ops
    - Abstract BaseRepository pattern (no NestJS DI decorator — base class only)
    - Vitest unit tests with capturedExtension mock pattern (no real DB needed)
key_files:
  created:
    - packages/backend/src/tenancy/tenancy-error-codes.ts
    - packages/backend/src/tenancy/decorators/no-tenant-scope.decorator.ts
    - packages/backend/src/tenancy/tenant-context.service.ts
    - packages/backend/src/tenancy/tenanted-prisma.service.ts
    - packages/backend/src/tenancy/base-repository.ts
    - packages/backend/src/tenancy/tenanted-prisma.service.spec.ts
  modified: []
decisions:
  - "Captured ClsService as `clsRef` (not `cls`) in TenantedPrismaService constructor to avoid OXC/SWC identifier-redeclaration error; `cls` is already the constructor parameter name in scope"
  - "Used `as unknown as PrismaClient` type assertion for `TenantedPrismaService.client` to avoid DI-incompatible inferred return type from $extends"
  - "`organization` intentionally excluded from ORG_SCOPED_MODELS — Organization has no organizationId FK (it IS the root entity)"
metrics:
  duration: "~20 minutes"
  completed: "2026-07-03"
  tasks_completed: 3
  files_created: 6
---

# Phase 06 Plan 01: Tenancy Core Infrastructure Summary

Prisma $extends scoped client (TenantedPrismaService) with fail-closed CLS-backed
org injection, abstract BaseRepository, error catalog, @NoTenantScope decorator,
and typed CLS accessor service — all verified by 5 green unit tests.

## What Was Built

Six files in a new `packages/backend/src/tenancy/` directory comprising the complete
tenancy enforcement core (D-05, D-06, D-08):

- **tenancy-error-codes.ts**: `TENANT_ERROR_CODES` catalog with 5 entries using the
  `createErrorCatalog('TENANT', [...] as const)` pattern from Phase 5's AUTHZ catalog.
- **decorators/no-tenant-scope.decorator.ts**: `@NoTenantScope()` opt-out decorator
  (mirrors `@Public()` verbatim — same `SetMetadata` + `MethodDecorator & ClassDecorator`).
- **tenant-context.service.ts**: `TenantContextService` with typed `getUserId()`,
  `getOrganizationId()`, and `getOrganizationMemberId()` getters over `ClsService`.
- **tenanted-prisma.service.ts**: `TenantedPrismaService` wrapping `PrismaService.$extends`
  with a `$allOperations` query hook. Three module-scope `Set` constants control behavior:
  `ORG_SCOPED_MODELS` (7 models, 'organization' excluded), `NO_WHERE_OPERATIONS` (create ops),
  `UNIQUE_OPERATIONS` (findUnique ops). D-08 fail-closed: undefined orgId throws
  `ForbiddenException({ errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT })`.
- **base-repository.ts**: `abstract class BaseRepository` (no `@Injectable`) with
  `getSoftDeleteData()` reading `userId` from CLS.
- **tenanted-prisma.service.spec.ts**: 5 Vitest unit tests covering injection, fail-closed,
  NO_WHERE skip, UNIQUE skip, and non-scoped model skip behaviors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OXC identifier-redeclaration in TenantedPrismaService constructor**
- **Found during:** Task 3 (first test run)
- **Issue:** The RESEARCH.md pattern used `const cls = this.cls;` inside the constructor
  but `cls` is already declared as the constructor parameter in the same lexical scope.
  TypeScript's `tsc` accepts this, but OXC (Vitest's transformer) rejects it with a
  parse error: "Identifier `cls` has already been declared."
- **Fix:** Renamed the closure capture variable to `clsRef = this.cls`. Added a JSDoc
  comment explaining why the rename is necessary (inside `$allOperations`, `this` refers
  to the extension object, not the service instance, so a captured reference is required).
- **Files modified:** `packages/backend/src/tenancy/tenanted-prisma.service.ts`
- **Commit:** 75d30e5

## Known Stubs

None — all public interfaces are fully implemented and tested.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Files are internal service/infrastructure
code with no HTTP surface. The threat mitigations from the plan's `<threat_model>` are
implemented:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-06-01 (fail-open scoping) | MITIGATED — ForbiddenException thrown when orgId undefined (Test 2 verifies) |
| T-06-02 (where injection tampering) | MITIGATED — organizationId set server-side from CLS only |
| T-06-03 (findUnique bypass) | MITIGATED — UNIQUE_OPERATIONS skip set; Test 4 verifies args not mutated |
| T-06-04 (non-scoped fall-through) | IMPLEMENTED — ORG_SCOPED_MODELS whitelist; Test 5 verifies |

## Self-Check: PASSED
