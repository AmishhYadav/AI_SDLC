---
phase: 05-rbac-authorization-infrastructure
plan: "03"
subsystem: authorization
tags: [rbac, permissions-guard, nestjs-guard, app-guard, authorization-module]
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["05-04"]
  affects: ["packages/backend/src/authorization/", "packages/backend/src/app.module.ts"]
tech_stack:
  added: []
  patterns:
    - "NestJS APP_GUARD chained global guard (ThrottlerGuard → JwtAuthGuard → PermissionsGuard)"
    - "Reflector.getAllAndOverride for handler/class-level metadata (IS_PUBLIC_KEY, REQUIRE_PERMISSIONS_KEY)"
    - "AND-match exact permission code via Set.has + Array.every"
    - "Leaf-level NestJS module with global provider dependencies"
key_files:
  created:
    - packages/backend/src/authorization/permissions.guard.ts
    - packages/backend/src/authorization/permissions.guard.spec.ts
    - packages/backend/src/authorization/authorization.module.ts
  modified:
    - packages/backend/src/app.module.ts
decisions:
  - "Used mockImplementation(key => ...) pattern in spec instead of mockReturnValueOnce chaining — vi.clearAllMocks() does not flush the once-queue, causing leftover truthy values to pollute subsequent tests; key-based dispatch is immune to call-order drift"
  - "AuthorizationModule imports only AppConfigModule; PrismaModule and ClsModule are @Global() so PrismaService and ClsService are available without explicit import, preventing cyclic-DI risk"
  - "ForbiddenException thrown for undefined request.user (fail-closed D-04) rather than returning false — ensures the 403 envelope with errorCode is emitted by GlobalExceptionFilter"
metrics:
  duration: "~8 minutes"
  completed: "2026-07-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 05 Plan 03: PermissionsGuard + AuthorizationModule Summary

PermissionsGuard with AND-semantics exact-code authorization, registered globally as third APP_GUARD after JwtAuthGuard.

## What Was Built

**Task 1 (TDD): PermissionsGuard + unit spec**

`permissions.guard.ts` implements `CanActivate` injecting `Reflector` and `PermissionResolverService`. Decision order:

1. `@Public()` (IS_PUBLIC_KEY) via `reflector.getAllAndOverride([handler, class])` → return true immediately, resolver NOT called
2. No `@RequirePermissions` metadata (undefined or empty) → return true, resolver NOT called (D-05)
3. `request.user` undefined → throw `ForbiddenException` fail-closed (D-04), resolver NOT called
4. AND-match: `requiredCodes.every(c => effective.has(c))` → allow or throw `ForbiddenException` with `errorCode: AUTHZ.PERMISSION_DENIED` and fixed generic message (D-02, D-03, D-54)

Security properties enforced:
- RBAC-04 / D-06: authorization derives solely from the resolved Set, never from auth success alone; valid token with no required codes → 403 not 401
- D-03 / T-05-09: no role-name bypass, no hierarchy — exact code membership only
- D-54 / T-05-10: deny message is fixed constant `'You do not have permission to perform this action.'`; missing codes never appear
- D-09 / T-05-11: no AUTH_MODE/stub branch; stub identities resolve via DB identical to real principals

**Task 2: AuthorizationModule + AppModule wiring**

`authorization.module.ts` is a leaf-level `@Module` that imports only `AppConfigModule`, provides and exports `PermissionsGuard` and `PermissionResolverService`. PrismaModule and ClsModule are `@Global()`, making PrismaService and ClsService available without explicit import (prevents cyclic-DI).

`app.module.ts` changes:
- Added `AuthorizationModule` import after `AuthModule`
- Registered `{ provide: APP_GUARD, useClass: PermissionsGuard }` immediately after `JwtAuthGuard` entry

Guard execution chain is now: ThrottlerGuard → JwtAuthGuard → PermissionsGuard (RBAC-03, D-05).

## Verification

- `npx tsc --noEmit` → exits 0
- `npx vitest run src/authorization/permissions.guard.spec.ts` → 7/7 tests pass
- Guard order check: `useClass: JwtAuthGuard` at char 5492, `useClass: PermissionsGuard` at char 5724 → `order ok`
- `npx vitest run src/app.integration.spec.ts` → 19/19 tests pass (no regression; routes without `@RequirePermissions` pass the guard transparently)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock isolation in PermissionsGuard spec using mockImplementation**
- **Found during:** Task 1, TDD GREEN run
- **Issue:** `vi.clearAllMocks()` clears call counts but NOT `mockReturnValueOnce` queues. Test 3 set `mockReturnValueOnce(false)` and `mockReturnValueOnce([])`. The guard consumed only the first two queue entries but `[]` remained. In test 4, the guard's first `getAllAndOverride` call consumed `[]` (truthy in JS), so `if (isPublic) return true` fired, making the "request.user undefined → deny" test report "resolved true instead of rejecting".
- **Fix:** Replaced `mockReturnValueOnce` chaining with a `setupReflector(isPublic, requiredCodes)` helper using `mockImplementation((key) => ...)` keyed on `IS_PUBLIC_KEY` / `REQUIRE_PERMISSIONS_KEY`. This dispatch is immune to call-order accumulation entirely.
- **Files modified:** `packages/backend/src/authorization/permissions.guard.spec.ts`
- **Commit:** d56a2a0

## Known Stubs

None — no placeholder values or hardcoded data flows to UI. This is a pure server-side guard.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced beyond the threat model in the plan. The five threat register entries (T-05-07 through T-05-11) are all mitigated in the implementation as specified.

## Self-Check: PASSED

All files exist on disk. All task commits found in git log:
- d4d654e: test(05-03): add failing unit spec for PermissionsGuard
- d56a2a0: feat(05-03): implement PermissionsGuard with AND-match exact-code authorization
- 3ed2e23: feat(05-03): add AuthorizationModule and wire PermissionsGuard as global APP_GUARD
