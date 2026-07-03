---
phase: 06-tenancy-organization-foundation
verified: 2026-07-03T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the Tenant Isolation integration suite against a real PostgreSQL database"
    expected: |
      All 6 cases pass:
      (a) orgA ACTIVE member + correct x-organization-id → 200, success:true
      (b) orgA member + x-organization-id=orgB → 403 TENANT.ORG_ACCESS_DENIED
      (c) orgA member list response does NOT contain orgB user's userId
      (d) missing x-organization-id on tenant-scoped route → 403 TENANT.MISSING_ORG_HEADER
      (e) INVITED-status membership → 403 TENANT.ORG_ACCESS_DENIED
      (f) POST /api/v1/organizations creates org; creator is ACTIVE member with joinedAt set; GET /mine returns it
    why_human: "The describe.skipIf(!realDbAvailable) block skips entirely on local mock runs. Requires DATABASE_URL pointing to a real Postgres instance. TENANT_REALDB_REQUIRED=1 is set in CI to force execution, following the same pattern as Phase 5 RBAC tests."
---

# Phase 6: Tenancy Organization Foundation — Verification Report

**Phase Goal:** A trusted request-scoped tenant context exists and organization/member data is provably isolated across tenants, with the enforcement mechanism decided.
**Verified:** 2026-07-03
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request-scoped tenant/actor context (AsyncLocalStorage) is populated from the authenticated principal and is always available to repositories without per-query plumbing. | VERIFIED | `TenantContextService` provides typed CLS getters. `TenantGuard` atomically sets `organizationId`/`organizationMemberId`/`userId` after ACTIVE membership validation. `TenantedPrismaService.$extends` reads orgId at query execution time — repositories call `scopedPrisma.client.*` with zero per-query plumbing. 12 unit tests (5 TenantedPrismaService + 7 TenantGuard) pass. |
| 2 | A user can create an organization and is recorded as a member, can list/read organizations they belong to, and cannot read organizations they do not belong to. | VERIFIED | `createOrganization` uses `$transaction` to atomically create org + ACTIVE member with `joinedAt=new Date()` (D-10). `listMyOrgs` filters by ACTIVE membership. `findById` contains IDOR guard: throws `ORG_ACCESS_DENIED` if path id ≠ CLS org. `TenantGuard` rejects any user whose email has no ACTIVE membership in the presented org. 4 OrganizationService unit tests pass. |
| 3 | Organization members can be added, listed, and removed. | VERIFIED (with warnings) | `addMember` upserts by (org, user) — handles re-add reactivation. `listMembers` delegates to scoped `findManyByOrg()`. `removeMember` counts ACTIVE members before soft-deleting (D-15 last-member guard). 5 MemberService unit tests pass. See WARNING section for CR-01 (no @RequirePermissions on mutating routes). |
| 4 | A two-organization isolation test proves organization A never receives organization B's data. | UNCERTAIN | Test structure exists and is correct: `describe.skipIf(!realDbAvailable)` block at `app.integration.spec.ts:621` with 6 cases (a)–(f). Test (c) asserts `expect(memberUserIds).not.toContain(orgBUser.id)`. CI guard `it()` at line 137 fails build if `TENANT_REALDB_REQUIRED=1` but `DATABASE_URL` is mock. `TENANT_REALDB_REQUIRED: '1'` present in `.github/workflows/ci.yml:45`. Cannot execute locally without real Postgres — needs CI or human with real DB. |
| 5 | The tenant-enforcement mechanism is decided and recorded as an ADR, and an org-scoped, soft-delete-aware BaseRepository is available to domain repositories. | VERIFIED | `docs/adr/ADR-001-tenant-enforcement-mechanism.md` exists, `Status: Accepted`. Records Prisma `$extends` as chosen mechanism; PostgreSQL RLS rejected (DDL + pooler conflict) and deferred as defense-in-depth. `abstract class BaseRepository` in `packages/backend/src/tenancy/base-repository.ts` with `getSoftDeleteData()` reading userId from CLS. Extended by `MemberRepository`. |

**Score:** 4/5 truths verified (1 uncertain — needs CI/real-DB execution)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/tenancy/tenanted-prisma.service.ts` | Prisma $extends scoped client (D-05, D-06) | VERIFIED | `ORG_SCOPED_MODELS` (7 models, 'organization' excluded), `NO_WHERE_OPERATIONS`, `UNIQUE_OPERATIONS` sets. D-08 fail-closed: throws `ForbiddenException(TENANT.NO_ORG_CONTEXT)` when orgId undefined on scoped model op. `deletedAt: null` injected alongside `organizationId`. |
| `packages/backend/src/tenancy/tenanted-prisma.service.spec.ts` | 5 unit tests for injection/skip/fail-closed | VERIFIED | 5 tests: injection, fail-closed (verifies `NO_ORG_CONTEXT` error code), NO_WHERE skip, UNIQUE skip, non-scoped model skip. All pass. |
| `packages/backend/src/tenancy/base-repository.ts` | Abstract BaseRepository with getSoftDeleteData() | VERIFIED | `abstract class BaseRepository` (no @Injectable). `getSoftDeleteData()` returns `{ deletedAt: new Date(), deletedBy: cls.get('userId') ?? null }`. |
| `packages/backend/src/tenancy/decorators/no-tenant-scope.decorator.ts` | @NoTenantScope opt-out decorator | VERIFIED | `IS_NO_TENANT_SCOPE_KEY = 'isNoTenantScope'`. `NoTenantScope = (): MethodDecorator & ClassDecorator => SetMetadata(...)`. |
| `packages/backend/src/tenancy/tenancy-error-codes.ts` | 5-entry TENANT error catalog | VERIFIED | `createErrorCatalog('TENANT', [...] as const)` with MISSING_ORG_HEADER, ORG_ACCESS_DENIED, NO_ORG_CONTEXT, USER_NOT_FOUND, LAST_MEMBER_REMOVAL. |
| `packages/backend/src/tenancy/tenant-context.service.ts` | Typed CLS getter service | VERIFIED | `getUserId()`, `getOrganizationId()`, `getOrganizationMemberId()` — each returns `cls.get<string>(key)`. |
| `packages/backend/src/tenancy/tenant.guard.ts` | Global TenantGuard populating CLS | VERIFIED | 6-step decision tree. Uses raw `PrismaService` (not `TenantedPrismaService`). Array header guard. Atomic CLS population of 3 keys. |
| `packages/backend/src/tenancy/tenant.guard.spec.ts` | 7 unit tests covering all guard paths | VERIFIED | All 7 paths covered: @Public bypass, @NoTenantScope bypass, missing user, missing header, non-ACTIVE member, ACTIVE member (3 cls.set calls verified), array header. All pass. |
| `packages/backend/src/tenancy/tenancy.module.ts` | Leaf TenancyModule | VERIFIED | `imports: [AppConfigModule]` only. `providers/exports: [TenantGuard, TenantedPrismaService, TenantContextService]`. No PrismaModule or ClsModule (correctly absent — @Global()). |
| `packages/backend/src/organization/api/organization.controller.ts` | 6 REST endpoints with @NoTenantScope on POST/ and GET/mine | VERIFIED | POST /, GET /mine (@NoTenantScope), GET /:id, POST /:id/members, GET /:id/members, DELETE /:id/members/:memberId. No business logic in controller (CLAUDE.md §6). |
| `packages/backend/src/organization/organization.module.ts` | OrganizationModule importing TenancyModule | VERIFIED | `imports: [TenancyModule]`. `controllers: [OrganizationController]`. `providers: [OrganizationService, MemberService, OrganizationRepository, MemberRepository]`. No PrismaModule or ClsModule. |
| `packages/backend/src/organization/persistence/organization.repository.ts` | Raw PrismaService only (Organization has no organizationId FK) | VERIFIED | Injects `PrismaService` only — zero `TenantedPrismaService` references. Methods: `create`, `findById`, `findByMemberUserId`. |
| `packages/backend/src/organization/persistence/member.repository.ts` | Extends BaseRepository; upsertMember uses raw PrismaService | VERIFIED | `extends BaseRepository`. `findManyByOrg`/`findById`/`softDelete` use `this.scopedPrisma.client`. `upsertMember` uses raw `this.prisma` (avoids RESEARCH A3 extension.where conflict). No `findUnique` calls. |
| `packages/backend/src/organization/application/organization.service.ts` | createOrganization atomic $transaction, IDOR guard, email-based User lookup | VERIFIED | `$transaction` creates org + ACTIVE member (D-10). `findById` throws `ORG_ACCESS_DENIED` if path id ≠ CLS org (T-06-12). Both `createOrganization` and `listMyOrgs` resolve User from email (CLS has no userId on @NoTenantScope routes). |
| `packages/backend/src/organization/application/member.service.ts` | addMember fail-closed, last-member guardrail, soft-delete | VERIFIED | USER_NOT_FOUND on absent user (never calls user.create). LAST_MEMBER_REMOVAL if activeCount <= 1. Soft-delete via `memberRepo.softDelete(memberId)`. |
| `packages/backend/src/organization/application/member.service.spec.ts` | 5 unit tests | VERIFIED | All 5 tests pass: USER_NOT_FOUND (upsertMember not called), re-add upsert path, LAST_MEMBER_REMOVAL (softDelete not called), normal remove, list. |
| `packages/backend/src/organization/application/organization.service.spec.ts` | 4 unit tests | VERIFIED | All 4 tests pass: USER_NOT_FOUND ($transaction not called), D-10 atomicity (status:'ACTIVE', joinedAt is Date), IDOR guard (orgRepo.findById not called on mismatch), happy path. |
| `packages/backend/src/app.module.ts` | TenantGuard as 4th APP_GUARD; TenancyModule + OrganizationModule imported | VERIFIED | Line 134: `{ provide: APP_GUARD, useClass: TenantGuard }` follows `PermissionsGuard` at line 129. `TenancyModule` and `OrganizationModule` in imports at lines 96–97. |
| `packages/backend/src/app.integration.spec.ts` | 6-case isolation block; helper controllers @NoTenantScope-exempted; CI guard | VERIFIED (structure) | `describe.skipIf(!realDbAvailable)` at line 621. 6 test cases (a)–(f). 3 helper controllers carry `@NoTenantScope()` (lines 73, 87, 109). CI guard `it()` at line 137. `tenantRealDbRequired` variable at line 39. Cannot execute locally — needs real DB. |
| `.github/workflows/ci.yml` | TENANT_REALDB_REQUIRED: '1' in CI env block | VERIFIED | Found at line 45 of CI workflow. |
| `docs/adr/ADR-001-tenant-enforcement-mechanism.md` | Status: Accepted; Prisma $extends chosen; RLS deferred | VERIFIED | All required elements present: Status: Accepted, Decision (Prisma $extends, fail-closed D-08), Alternatives (RLS rejected — DDL + pool conflict, recorded as future defense-in-depth), Consequences. |
| `packages/backend/src/auth/auth-audit-context-provider.ts` | D-16: reads organizationId + userId from CLS | VERIFIED | Constructor injects `ClsService`. `getContext()` reads `organizationId` and `userId`; returns null when `organizationId` not set. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TenantedPrismaService.$extends closure` | `ClsService.get('organizationId')` | CLS read inside `$allOperations` callback (not at construction time — captured as `clsRef`) | WIRED | `clsRef.get<string>('organizationId')` at line 82 of tenanted-prisma.service.ts |
| `BaseRepository.getSoftDeleteData()` | `ClsService.get('userId')` | `deletedBy` field assignment | WIRED | `this.cls.get<string>('userId') ?? null` in base-repository.ts:32 |
| `TenantGuard.canActivate()` | `PrismaService.organizationMember.findFirst()` | Raw (unscoped) PrismaService — CLS orgId not yet set when guard runs | WIRED | Line 78 of tenant.guard.ts: `this.prisma.organizationMember.findFirst(...)`. No TenantedPrismaService in guard. |
| `TenantGuard (after successful lookup)` | `ClsService.set('organizationId'/'userId'/'organizationMemberId')` | Atomic CLS population after all validations pass | WIRED | Lines 95–97 of tenant.guard.ts: 3 consecutive `cls.set()` calls with no early returns between them |
| `AppModule.providers[]` | `{ provide: APP_GUARD, useClass: TenantGuard }` | Fourth APP_GUARD after PermissionsGuard (D-04) | WIRED | app.module.ts line 134, immediately following PermissionsGuard at line 129 |
| `OrganizationController.createOrganization()` | `@NoTenantScope()` | Opt-out decorator — TenantGuard skips, identity from JWT email | WIRED | organization.controller.ts line 31: `@NoTenantScope()` on `@Post('/')` |
| `MemberRepository.findManyByOrg()` | `TenantedPrismaService.client.organizationMember.findMany()` | Extension auto-injects organizationId + deletedAt:null | WIRED | member.repository.ts line 26: `this.scopedPrisma.client.organizationMember.findMany()` |
| `MemberRepository.upsertMember()` | `PrismaService (raw).organizationMember.upsert()` | Raw client to avoid RESEARCH A3 extension.where conflict | WIRED | member.repository.ts line 50: `this.prisma.organizationMember.upsert(...)` |
| `AuthAuditContextProvider.getContext()` | `ClsService.get('organizationId') + ClsService.get('userId')` | CLS reads after TenantGuard populates keys | WIRED | auth-audit-context-provider.ts lines 22–24: reads both keys, returns null when organizationId not set |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MemberRepository.findManyByOrg()` | `OrganizationMember[]` | `TenantedPrismaService.client.organizationMember.findMany()` — $extends injects `{ organizationId, deletedAt: null }` from CLS | Yes — queries real DB table with org-scoped filter | FLOWING |
| `TenantGuard.canActivate()` | `member` | `PrismaService.organizationMember.findFirst({ where: { organizationId, status: 'ACTIVE', ... } })` | Yes — real DB lookup against membership table | FLOWING |
| `OrganizationService.createOrganization()` | `org` + member row | `PrismaService.$transaction` with `tx.organization.create` + `tx.organizationMember.create` | Yes — real DB writes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TenantedPrismaService fail-closed: orgId undefined → ForbiddenException NO_ORG_CONTEXT | `npm test --workspace=packages/backend -- --run` (tenanted-prisma spec) | Test 2 passes: `expect(callAllOperations('organizationMember', 'findMany')).rejects.toThrow(ForbiddenException)` with `NO_ORG_CONTEXT` error code verified | PASS |
| TenantGuard rejects non-member (findFirst null) with ORG_ACCESS_DENIED | `npm test` (tenant.guard spec) | Test 5 passes: throws ForbiddenException with `errorCode: 'TENANT.ORG_ACCESS_DENIED'` | PASS |
| OrganizationService IDOR guard: path id mismatch throws ORG_ACCESS_DENIED | `npm test` (organization.service spec) | Test 3 passes: `findById('different-org')` throws ORG_ACCESS_DENIED; `orgRepo.findById` not called | PASS |
| MemberService last-member guard: count=1 blocks softDelete | `npm test` (member.service spec) | Test 3 passes: throws ForbiddenException LAST_MEMBER_REMOVAL; softDelete not called | PASS |
| TypeScript build clean | `npm run -w packages/backend build 2>&1 \| grep "error TS" \| wc -l` | Output: 0 | PASS |
| All unit tests pass | `npm test --workspace=packages/backend -- --run` | 129 passed, 10 skipped (real-DB isolation block) | PASS |
| Isolation test (c): orgA never returns orgB data | Requires real Postgres DB | Cannot execute locally — skipped | SKIP (needs CI) |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files found for Phase 6. Phase uses Vitest integration tests as the verification harness.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TENANT-01 | 06-01, 06-02 | Request-scoped tenant context populated from authenticated principal | SATISFIED | TenantGuard populates CLS; TenantContextService provides typed getters; 12 unit tests cover all paths |
| TENANT-02 | 06-01, 06-02 | Tenant context always available to repositories (no per-query discipline) | SATISFIED | TenantedPrismaService auto-injects; fail-closed on missing context; MemberRepository uses scopedPrisma.client with zero per-query plumbing |
| TENANT-03 | 06-03, 06-04 | User can create organization and be recorded as member | SATISFIED | createOrganization uses $transaction (D-10); creator ACTIVE member with joinedAt atomically |
| TENANT-04 | 06-03, 06-04 | User can list/read own orgs; cannot read others | SATISFIED | listMyOrgs filtered by ACTIVE membership; findById IDOR guard; TenantGuard enforces org membership before any handler |
| TENANT-05 | 06-03, 06-04 | Members can be added, listed, removed | SATISFIED (with CR-01 warning) | 3 routes functional with correct service layer; LAST_MEMBER_REMOVAL guard; soft-delete with status=REMOVED |
| TENANT-06 | 06-04 | Two-organization isolation test | UNCERTAIN | Test structure correct (6 cases, correct assertions), CI guard in place, TENANT_REALDB_REQUIRED set in CI, but locally skipped — requires human/CI verification |
| TENANT-07 | 06-04 | Enforcement mechanism decided and recorded as ADR | SATISFIED | ADR-001: Status Accepted, Prisma $extends chosen, RLS deferred as future defense-in-depth |
| SEAM-05 | 06-01 | Org-scoped soft-delete-aware BaseRepository available | SATISFIED | abstract class BaseRepository with getSoftDeleteData() reading userId from CLS; extended by MemberRepository |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `organization/api/organization.controller.ts` | 50–64 | No `@RequirePermissions(...)` on addMember, listMembers, removeMember, getOrganization (CR-01 from 06-REVIEW.md) | WARNING | Any ACTIVE member can add/remove other members regardless of role. Privilege escalation within a tenant. Does not break cross-tenant isolation. Violates CLAUDE.md §9 ("authorization checks" on every endpoint). Mechanism exists (Phase 5 PermissionsGuard + @RequirePermissions) but unused here. |
| `organization/api/organization.controller.ts` | 36–43 | Response DTOs unused; raw Prisma entities returned (WR-01 from 06-REVIEW.md) | WARNING | `OrganizationResponseDto` and `MemberResponseDto` are defined but never applied. Internal Prisma audit columns (`createdBy`, `updatedBy`, `deletedBy`, `deletedAt`) are serialized to API clients. Violates CLAUDE.md §11 ("never expose internal IDs unintentionally"). |
| `organization/api/organization.controller.ts` | 50–64 | Path `:id` silently discarded on member routes (WR-02 from 06-REVIEW.md) | WARNING | `_id` is bound and ignored. POST /organizations/ORG_A/members with X-Organization-Id: ORG_B mutates ORG_B silently. Inconsistent with `getOrganization`'s explicit path-vs-CLS check. |
| `organization/persistence/member.repository.ts` | 52–64 | `upsertMember` uses `userId` (the invited user) for `createdBy`/`updatedBy` instead of the acting member (WR-03 from 06-REVIEW.md) | WARNING | Audit attribution is wrong — the invited user appears to have added themselves. Actor's userId is available via TenantContextService. |
| `organization/application/member.service.ts` | 64–78 | TOCTOU race on last-member guardrail (WR-04 from 06-REVIEW.md) | WARNING | `count(ACTIVE)` then `softDelete` are separate non-transactional operations. Two concurrent removals on a 2-member org can both pass the count check and both soft-delete, leaving 0 active members. |
| `tenancy/tenanted-prisma.service.ts` | 12–20 | `ORG_SCOPED_MODELS` is a hand-maintained allowlist that fails OPEN for future unregistered models (WR-05 from 06-REVIEW.md) | WARNING | Any new org-owned model omitted from the set is silently unscoped — full cross-tenant read with no error, contradicting D-08. Affects long-term isolation robustness, not current models. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase files. No stub return patterns found.

---

### Human Verification Required

#### 1. Two-Organization Isolation Test — CI / Real-DB Execution

**Test:** Set `DATABASE_URL` to a real Postgres instance and run `npm test --workspace=packages/backend -- --run`. The `describe.skipIf(!realDbAvailable)('Tenant Isolation (real DB) (TENANT-06)', ...)` block (app.integration.spec.ts:621) will execute.

**Expected:**
- **(a)** orgA ACTIVE member + correct x-organization-id → 200, `body.success === true`
- **(b)** orgA member + x-organization-id=orgB → 403 `TENANT.ORG_ACCESS_DENIED`
- **(c)** GET orgA members: result array does NOT contain orgB user's userId
- **(d)** No x-organization-id header on tenant-scoped route → 403 `TENANT.MISSING_ORG_HEADER`
- **(e)** INVITED membership → 403 `TENANT.ORG_ACCESS_DENIED`
- **(f)** POST /api/v1/organizations → 201 + creator is ACTIVE member with joinedAt; GET /mine returns the new org

**Why human:** `realDbAvailable = !!process.env['DATABASE_URL'] && DATABASE_URL !== MOCK_DATABASE_URL`. No real Postgres is available in the local verification environment. This is the primary acceptance gate for TENANT-06 (D-06) and is intentionally deferred to CI, following the same pattern established by Phase 5 RBAC tests.

---

### Gaps Summary

No must-have truths are definitively FAILED. All 5 success criteria are either VERIFIED or UNCERTAIN (SC 4 / TENANT-06). The phase's tenant isolation machinery is correctly implemented and all unit tests pass (129/129). The isolation test structure is correct and has the right CI guards, but cannot be run without a real database.

**Code Review findings from 06-REVIEW.md are warnings, not blockers for the phase goal:**

- **CR-01** (no @RequirePermissions on member routes): Phase goal is cross-tenant isolation, not intra-tenant RBAC. The routes are functional per SC 3 ("members can be added, listed, removed"). However, any ACTIVE member can currently perform admin-level operations — this should be addressed before production.
- **WR-01** (raw Prisma entities returned, internal columns leaked): Response DTOs defined but unused. Internal audit fields exposed to API clients.
- **WR-02** through **WR-06**: Additional quality/security concerns documented in 06-REVIEW.md, none of which break cross-tenant isolation.

These warnings were identified by an independent code review (06-REVIEW.md) and should be incorporated into a Phase 6 follow-up fix or Phase 7 planning. They do not prevent proceeding to human verification of the isolation test.

---

_Verified: 2026-07-03_
_Verifier: Claude (gsd-verifier)_
