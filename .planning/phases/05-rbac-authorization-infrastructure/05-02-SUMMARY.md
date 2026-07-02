---
phase: 05-rbac-authorization-infrastructure
plan: "02"
subsystem: authorization
tags: [rbac, permission-resolver, cls-memoization, tdd, unit-tests]

dependency_graph:
  requires:
    - "05-01 (RequirePermissions decorator + metadata key)"
  provides:
    - "PermissionResolverService.resolve(email, organizationId?) → Promise<Set<string>>"
    - "PERMISSIONS_CLS_KEY constant for CLS store access"
  affects:
    - "05-03 (PermissionsGuard consumes PermissionResolverService)"

tech_stack:
  added: []
  patterns:
    - "findFirst with deletedAt: null on unique-indexed field (avoids findUnique non-unique-filter limitation)"
    - "CLS memoization: cls.get check → query → cls.set pattern (D-08)"
    - "noUncheckedIndexedAccess: non-null assertion on mock.calls[0]! in specs"

key_files:
  created:
    - packages/backend/src/authorization/permission-resolver.service.ts
    - packages/backend/src/authorization/permission-resolver.service.spec.ts
  modified: []

decisions:
  - "Used findFirst (not findUnique) to colocate the deletedAt: null filter in the WHERE clause while preserving the unique email index for O(1) lookup (plan design requirement)"
  - "void organizationId idiom chosen to suppress unused-variable lint error on the Phase-6 seam parameter without altering behavior"
  - "Non-null assertions (!) on mock.calls[0]! in spec required by noUncheckedIndexedAccess: true in tsconfig.base.json"

metrics:
  duration: "~8 minutes"
  completed_date: "2026-07-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 5 Plan 02: PermissionResolverService Summary

Single-query permission resolver that turns a principal's email into a `Set<string>` of effective permission codes, memoized per request in CLS with a documented Phase-6 org-narrowing seam and full fail-closed behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD RED) | Failing test for PermissionResolverService | 2c63f13 | permission-resolver.service.spec.ts |
| 1 (TDD GREEN) | Implement PermissionResolverService | 097a0e8 | permission-resolver.service.ts |
| 2 | Comprehensive unit spec | 80ae200 | permission-resolver.service.spec.ts |

## What Was Built

`PermissionResolverService` in `src/authorization/permission-resolver.service.ts`:

- `resolve(email: string, organizationId?: string): Promise<Set<string>>` — the single public method
- One `prisma.user.findFirst` call per request (keyed on the `@@unique` `User.email` index)
- Nested select: `userRoles → role → rolePermissions → permission.code`
- D-07 filters applied at query time: `UserRole.deletedAt: null`, `OR: [expiresAt null | gt now]`, `role.deletedAt: null`, `rolePermissions.deletedAt: null`, `permission.deletedAt: null`
- D-04 fail-closed: soft-deleted User (`deletedAt: null` in WHERE means a soft-deleted row returns null), unknown user, and empty roles all resolve to `new Set()` — never throws, never writes
- D-08 CLS memoization: `cls.get(PERMISSIONS_CLS_KEY)` before query; `cls.set(...)` after — one DB round-trip per request
- D-01 Phase-6 seam: `organizationId?` param declared, documented in JSDoc, explicitly unused (`void organizationId`)

Unit spec in `src/authorization/permission-resolver.service.spec.ts` (7 tests):
- (a) Happy path: union Set built from rolePermissions, `cls.set` called
- (b) Fail-closed unknown user: null → empty Set, no throw, findFirst called once
- (c) Empty roles: `userRoles: []` → empty Set
- (d) Memoization: pre-seeded CLS returns cached Set without calling findFirst
- (e) Query args: asserts email, `deletedAt: null` on User, UserRole filters, no `organizationId`
- (f) Soft-deleted user: null from findFirst (excluded by `deletedAt: null` filter) → empty Set
- Multi-role union: codes from two active roles combined

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASSED |
| `npx vitest run permission-resolver.service.spec.ts` | 7/7 PASSED |
| `npx eslint` on new files | PASSED (0 warnings) |
| `grep findFirst service.ts` | FOUND (exactly one) |
| `grep organizationId service.ts` | FOUND (Phase-6 seam) |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-05-03 | `deletedAt: null` filters on all 5 row types; exact-code data-driven resolution; no role-name bypass |
| T-05-04 | Null user or empty roles → empty Set → deny; never throws on absence |
| T-05-05 | `findFirst` only; no create/update/upsert in the resolution path |
| T-05-06 | Single indexed nested query + per-request CLS memoization; no N+1 |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the resolver is fully implemented. The `organizationId` param is not a stub; it is an intentional Phase-6 extension seam (D-01) that is explicitly declared unused this phase.

## Threat Flags

None — no new security-relevant surface beyond what the plan's threat model describes.

## Self-Check: PASSED

- [x] `packages/backend/src/authorization/permission-resolver.service.ts` — exists
- [x] `packages/backend/src/authorization/permission-resolver.service.spec.ts` — exists
- [x] Commit 2c63f13 (RED test) — exists
- [x] Commit 097a0e8 (GREEN impl) — exists
- [x] Commit 80ae200 (comprehensive spec) — exists
