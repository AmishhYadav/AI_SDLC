---
phase: 06-tenancy-organization-foundation
plan: "02"
subsystem: tenancy
tags: [tenancy, guard, cls, app-guard, audit, module, tdd]
dependency_graph:
  requires:
    - TENANT_ERROR_CODES (06-01)
    - IS_NO_TENANT_SCOPE_KEY / @NoTenantScope decorator (06-01)
    - TenantContextService (06-01)
    - TenantedPrismaService (06-01)
  provides:
    - TenantGuard (global APP_GUARD, D-04)
    - TenancyModule (leaf module exporting TenantGuard, TenantedPrismaService, TenantContextService)
    - AuthAuditContextProvider D-16 (reads userId + organizationId from CLS)
  affects:
    - packages/backend/src/tenancy/ (TenantGuard + TenancyModule)
    - packages/backend/src/auth/auth-audit-context-provider.ts (D-16 CLS wiring)
tech_stack:
  added: []
  patterns:
    - APP_GUARD chain enforcement (ThrottlerGuard → JwtAuthGuard → PermissionsGuard → TenantGuard)
    - Raw PrismaService in guard to avoid CLS bootstrap deadlock (Pitfall 4, D-08)
    - Atomic CLS population after all validations pass (organizationId, organizationMemberId, userId)
    - D-02: same TENANT.ORG_ACCESS_DENIED for "org not found" and "not a member" (no org-existence oracle)
    - T-06-08: Array.isArray header guard for X-Organization-Id injection prevention
    - D-16: ClsService injected into AuthAuditContextProvider; returns null when no org context
key_files:
  created:
    - packages/backend/src/tenancy/tenant.guard.ts
    - packages/backend/src/tenancy/tenant.guard.spec.ts
    - packages/backend/src/tenancy/tenancy.module.ts
  modified:
    - packages/backend/src/auth/auth-audit-context-provider.ts
decisions:
  - "TenantGuard uses raw PrismaService (NOT TenantedPrismaService) — prevents CLS bootstrap deadlock (Pitfall 4): TenantGuard populates the CLS orgId that TenantedPrismaService reads; using scoped client in the guard creates a circular dependency at query time"
  - "TenancyModule imports AppConfigModule only — PrismaModule and ClsModule are @Global(); listing them would cause unnecessary module re-registration, matching the exact leaf-module pattern from authorization.module.ts"
  - "D-16: AuthAuditContextProvider returns null when organizationId is not set in CLS — AuditInterceptor already skips writes on null (existing behavior), so @NoTenantScope and @Public routes produce no audit entries without any AuditInterceptor changes"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 06 Plan 02: TenantGuard, TenancyModule, and D-16 Summary

TenantGuard (APP_GUARD after PermissionsGuard) validates ACTIVE membership via raw
PrismaService and populates CLS with organizationId/organizationMemberId/userId; TenancyModule
packages all three tenancy providers as a leaf module; AuthAuditContextProvider wired to CLS for D-16.

## What Was Built

**Task 1 — `tenant.guard.ts`:**

Global `TenantGuard` implementing `CanActivate` with a six-step decision tree:
1. `@Public()` bypass (no principal to scope)
2. `@NoTenantScope()` bypass (cross-org routes: create org, list my orgs)
3. Fail-closed on missing `request.user` → `TENANT.NO_ORG_CONTEXT`
4. `X-Organization-Id` header extraction with `Array.isArray` guard (T-06-08) → `TENANT.MISSING_ORG_HEADER`
5. ACTIVE membership lookup using raw `PrismaService.organizationMember.findFirst` → `TENANT.ORG_ACCESS_DENIED` (D-02: same code for "org not found" and "not a member")
6. Atomic CLS population: `organizationId`, `organizationMemberId`, `userId` — all three keys set before returning true

**Task 2 — `tenant.guard.spec.ts`:**

7 Vitest unit tests covering every guard decision path:
- `@Public()` → returns true, prisma not called
- `@NoTenantScope()` → returns true, prisma not called
- Missing `request.user` → ForbiddenException TENANT.NO_ORG_CONTEXT
- Missing `X-Organization-Id` header → ForbiddenException TENANT.MISSING_ORG_HEADER
- Non-ACTIVE membership (findFirst returns null) → ForbiddenException TENANT.ORG_ACCESS_DENIED
- ACTIVE membership → returns true, `cls.set` called 3 times with correct keys
- Array header `['org-1', 'org-2']` → takes `'org-1'` only; prisma lookup uses first value

**Task 2 — `tenancy.module.ts`:**

Leaf `TenancyModule` following the exact `authorization.module.ts` pattern:
- `imports: [AppConfigModule]` only — no PrismaModule or ClsModule (they are @Global())
- `providers: [TenantGuard, TenantedPrismaService, TenantContextService]`
- `exports: [TenantGuard, TenantedPrismaService, TenantContextService]`

**Task 2 — `auth-audit-context-provider.ts` (D-16):**

Added `ClsService` constructor injection. `getContext()` now reads `organizationId` and
`userId` from CLS. Returns null when `organizationId` is not set (covers `@Public()` and
`@NoTenantScope()` routes). Activates existing `AuditInterceptor` writes for all tenant-scoped
requests without any changes to the interceptor itself.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all public interfaces are fully implemented.

## Threat Surface Scan

No new network endpoints introduced. All changes are guard/module/service infrastructure.
Threat mitigations from the plan's `<threat_model>` are implemented:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-06-05 (X-Organization-Id IDOR) | MITIGATED — TenantGuard validates real OrganizationMember row with status=ACTIVE; forged header → ORG_ACCESS_DENIED |
| T-06-06 (org-existence oracle) | MITIGATED — same TENANT.ORG_ACCESS_DENIED for "not found" and "not a member" |
| T-06-07 (guard-order regression) | MITIGATED — fail on missing request.user gives early signal; covered by test 3 |
| T-06-08 (header injection) | MITIGATED — Array.isArray guard takes first value only; test 7 verifies |
| T-06-09 (bootstrap deadlock) | MITIGATED — TenantGuard injects PrismaService only; TenantedPrismaService absent from guard constructor |

## Self-Check: PASSED
