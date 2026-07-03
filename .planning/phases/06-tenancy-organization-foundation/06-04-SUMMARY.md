---
phase: 06-tenancy-organization-foundation
plan: "04"
subsystem: organization
tags: [organization, controller, app-guard, tenant-guard, integration-test, adr, ci]
dependency_graph:
  requires:
    - 06-02 (TenantGuard, TenancyModule, D-16 wiring)
    - 06-03 (OrganizationService, MemberService, repositories, DTOs)
  provides:
    - OrganizationController (6 REST endpoints; @NoTenantScope on create + listMyOrgs)
    - OrganizationModule (imports TenancyModule; wires controller + service + repos)
    - AppModule TenantGuard as fourth APP_GUARD (D-04: ThrottlerGuard → JwtAuthGuard → PermissionsGuard → TenantGuard)
    - Tenant isolation integration test (6 cases, TENANT-06 acceptance gate)
    - ADR-001 (Status: Accepted; Prisma $extends chosen; RLS deferred)
    - TENANT_REALDB_REQUIRED: '1' in CI
  affects:
    - packages/backend/src/organization/api/organization.controller.ts (new)
    - packages/backend/src/organization/organization.module.ts (new)
    - packages/backend/src/app.module.ts (TenantGuard + TenancyModule + OrganizationModule wired)
    - packages/backend/src/app.integration.spec.ts (isolation block + helper controller exemptions + MockPrismaModule fix)
    - .github/workflows/ci.yml (TENANT_REALDB_REQUIRED env var)
    - docs/adr/ADR-001-tenant-enforcement-mechanism.md (new)
tech_stack:
  added: []
  patterns:
    - OrganizationController delegates to OrganizationService and MemberService; no business logic (CLAUDE.md §6)
    - "@NoTenantScope() on create and listMyOrgs routes (org-less entry points)"
    - TenantGuard as fourth APP_GUARD after PermissionsGuard (D-04, TENANT-01, TENANT-02)
    - MockPrismaModule $extends() no-op stub for TenantedPrismaService instantiation in mock-mode tests
    - describe.skipIf(!realDbAvailable) isolation block with pre-cleanup idempotency pattern
    - Nygard ADR format with Status field and Consequences section
key_files:
  created:
    - packages/backend/src/organization/api/organization.controller.ts
    - packages/backend/src/organization/organization.module.ts
    - docs/adr/ADR-001-tenant-enforcement-mechanism.md
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/app.integration.spec.ts
    - .github/workflows/ci.yml
decisions:
  - "OrganizationController injects OrganizationService and MemberService only — TenantContextService is not needed in the controller because all org context reading is handled inside the service layer (CLAUDE.md §6 controllers orchestrate only)"
  - "MockPrismaModule requires $extends() no-op stub: TenantedPrismaService.constructor calls prisma.$extends() at instantiation time; without this the mock-mode integration tests all fail (Rule 1 auto-fix)"
  - "RbacTestController, TestController, AuthTestController all get class-level @NoTenantScope() — these are Phase 3/4/5 test helpers that have no org context and must not be blocked by the now-global TenantGuard"
metrics:
  duration: "~20 minutes"
  completed: "2026-07-03"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
---

# Phase 06 Plan 04: Organization API Layer, AppModule Wiring, and Isolation Test Summary

OrganizationController (6 routes), OrganizationModule (imports TenancyModule), TenantGuard as
fourth APP_GUARD in AppModule, two-organization isolation integration test (6 cases, TENANT-06
acceptance gate), TENANT_REALDB_REQUIRED CI env var, and ADR-001 (Prisma $extends, Status: Accepted).

## What Was Built

**Task 1 — `organization.controller.ts` + `organization.module.ts` + `app.module.ts`:**

`OrganizationController` at `@Controller({ path: 'organizations', version: '1' })` with 6 routes:
- `@Post('/') @NoTenantScope()` → `organizationService.createOrganization(user.email, dto)` (201)
- `@Get('/mine') @NoTenantScope()` → `organizationService.listMyOrgs(user.email)` (200)
- `@Get('/:id')` → `organizationService.findById(id)` (200; IDOR guard in service)
- `@Post('/:id/members')` → `memberService.addMember(dto.email)` (201)
- `@Get('/:id/members')` → `memberService.listMembers()` (200)
- `@Delete('/:id/members/:memberId') @HttpCode(204)` → `memberService.removeMember(memberId)`

`OrganizationModule`: `imports: [TenancyModule]`, `controllers: [OrganizationController]`,
`providers: [OrganizationService, MemberService, OrganizationRepository, MemberRepository]`.

`app.module.ts` surgical additions:
1. `TenancyModule` and `OrganizationModule` added to `imports[]` after `AuthorizationModule`.
2. `{ provide: APP_GUARD, useClass: TenantGuard }` inserted immediately after `PermissionsGuard` with D-04 comment block explaining guard chain and TENANT-01/TENANT-02 enforcement.
3. Audit context comment updated to reflect Phase 6 D-16 CLS wiring.

**Task 2 — `app.integration.spec.ts` + `.github/workflows/ci.yml`:**

Step 0 (regression fix): Added `import { NoTenantScope }` and `@NoTenantScope()` class decorator to `TestController`, `AuthTestController`, and `RbacTestController` — the Phase 3/4/5 test helpers that were never org-scoped but would now fail with `TENANT.MISSING_ORG_HEADER` under the global TenantGuard.

Step 0b (Rule 1 fix): Updated `MockPrismaModule` to include `$extends: () => ({})` so that `TenantedPrismaService` can instantiate when the mock Prisma client is in scope. Without this, all describe blocks using `MockPrismaModule` failed with `TypeError: prisma.$extends is not a function`.

Step 1: `tenantRealDbRequired` variable added after `realDbRequired`.

Step 2: Guard `it()` added — `'real-DB tenant isolation block must actually execute when TENANT_REALDB_REQUIRED is set'` — fails CI if `TENANT_REALDB_REQUIRED=1` but `DATABASE_URL` is mock.

Step 3: Full isolation `describe.skipIf(!realDbAvailable)` block with 6 test cases (a)-(f):
- **(a)** allow: orgA ACTIVE member + correct x-organization-id → 200
- **(b)** cross-tenant deny: orgA member + x-organization-id=orgB → 403 TENANT.ORG_ACCESS_DENIED
- **(c)** isolation proof: orgA member list never contains orgB member userId (T-06-16 acceptance gate)
- **(d)** missing header: no x-organization-id → 403 TENANT.MISSING_ORG_HEADER (T-06-19)
- **(e)** non-ACTIVE: INVITED status → 403 TENANT.ORG_ACCESS_DENIED (T-06-18)
- **(f)** create-org: `POST /api/v1/organizations` @NoTenantScope → 201 + creator is ACTIVE member with joinedAt set + `GET /mine` returns the new org (D-10, TENANT-03, Success Criterion 2 end-to-end)

CI: `TENANT_REALDB_REQUIRED: '1'` added to `.github/workflows/ci.yml` env block.

**Task 3 — `docs/adr/ADR-001-tenant-enforcement-mechanism.md`:**

Nygard-format ADR in new `docs/adr/` directory:
- **Status:** Accepted
- **Decision:** Prisma `$extends` with `$allModels.$allOperations` query hook; fail-closed (D-08); `ORG_SCOPED_MODELS` whitelist
- **Alternatives Considered:** PostgreSQL RLS (rejected — DDL required, pool incompatibility, recorded as future defense-in-depth), Prisma `$use` middleware (rejected — removed in Prisma 6), request-scoped PrismaClient (rejected — exhausts connection pool)
- **Consequences:** Notes intentional `PrismaService` bypass cases (Organization root entity, upsertMember RESEARCH A3, TenantGuard bootstrap deadlock)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MockPrismaModule missing `$extends()` stub**
- **Found during:** Task 2 test run
- **Issue:** `TenantedPrismaService.constructor` calls `prisma.$extends()` at instantiation time. With TenancyModule now imported by AppModule (Task 1), `TenantedPrismaService` is instantiated in all test modules — including those using `MockPrismaModule`. The mock `{ onModuleInit: async () => {} }` doesn't have `$extends`, causing `TypeError: prisma.$extends is not a function` in all 5 mock-mode describe blocks.
- **Fix:** Added `$extends: () => ({})` to `MockPrismaModule`'s mock `PrismaService` value. The returned stub is never used for actual queries in mock mode.
- **Files modified:** `packages/backend/src/app.integration.spec.ts`
- **Commit:** 2df440d

**2. [Rule 2 - Missing Critical] Helper controllers need @NoTenantScope exemption**
- **Found during:** Task 2 planning (Step 0 in plan action)
- **Issue:** `TestController`, `AuthTestController`, and `RbacTestController` are Phase 3/4/5 test fixtures that make requests without `X-Organization-Id` headers. With `TenantGuard` now globally active (Task 1), these would return `403 TENANT.MISSING_ORG_HEADER`, breaking all Phase 3/4/5 integration tests.
- **Fix:** Added `@NoTenantScope()` class-level decorator to all three controllers and imported `NoTenantScope` from the tenancy decorators module. This restores the pre-TenantGuard behavior for routes that were never tenant-scoped.
- **Files modified:** `packages/backend/src/app.integration.spec.ts`
- **Commit:** 2df440d

## Known Stubs

None — all routes are wired to real service methods (built in 06-03). No placeholder values,
hardcoded empty returns, or TODO markers.

## Threat Surface Scan

OrganizationController introduces 6 new network endpoints. Threat mitigations from the plan's
`<threat_model>` are verified:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-06-15 (APP_GUARD order regression) | MITIGATED — TenantGuard added after PermissionsGuard; comment documents D-04 order; test (d) asserts 403 (not 401) on missing header when auth passes |
| T-06-16 (cross-tenant data leak) | MITIGATED — Test (c) asserts orgA member list never contains orgB user's userId |
| T-06-17 (org-existence disclosure) | MITIGATED — Test (b) asserts TENANT.ORG_ACCESS_DENIED (generic, not 404) for non-member cross-org request |
| T-06-18 (INVITED-status bypass) | MITIGATED — Test (e) asserts INVITED status returns 403 ORG_ACCESS_DENIED |
| T-06-19 (CI silent skip) | MITIGATED — TENANT_REALDB_REQUIRED: '1' in ci.yml; guard it() fails CI if DATABASE_URL is mock |
| T-06-SC (npm installs) | ACCEPTED — zero new packages installed |

## Self-Check: PASSED
