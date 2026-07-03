---
phase: 06-tenancy-organization-foundation
fixed_at: 2026-07-03T00:00:00Z
review_path: .planning/phases/06-tenancy-organization-foundation/06-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-03
**Source review:** .planning/phases/06-tenancy-organization-foundation/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 critical + 6 warnings; 3 info findings deferred per scope)
- Fixed: 7
- Skipped: 0

**Verification (final):**
- `npx tsc --noEmit` (packages/backend): 10 errors, all pre-existing in `src/common/interceptors/*` (duplicate rxjs install). Zero errors in any touched file.
- `npx vitest run` (packages/backend): 130 passed | 10 skipped (was 129 | 10). The +1 is a new WR-02 regression test. No previously-passing test regressed.

## Fixed Issues

### CR-01: Member-management and org-read endpoints have no authorization

**Files modified:** `packages/backend/src/organization/api/organization.controller.ts`
**Commit:** b4bbee6
**Applied fix:** Gated `getOrganization` and `listMembers` behind `@RequirePermissions('organization:read')`, and `addMember`/`removeMember` behind `@RequirePermissions('organization:manage')` (both seeded codes; the seed grants `organization:read` to Developer but not `organization:manage`).

**Guard-ordering investigation (per review note + task brief):** `PermissionsGuard` runs before `TenantGuard` (app.module.ts:129-134). I traced `PermissionsGuard.canActivate` → `PermissionResolverService.resolve(email)`: resolution is keyed solely on `User.email` and is explicitly org-agnostic this phase (D-01 — the `organizationId` param is a declared-but-unapplied seam). It never reads the CLS `organizationId` that `TenantGuard` sets afterwards, so the decorators introduce no ordering dependency. No guard reordering was required.

**Residual concern (not a regression; pre-existing Phase-6 design seam):** because permission resolution is org-agnostic, a principal holding `organization:manage` in *any* org currently passes the check for the org named in `X-Organization-Id` (membership in that specific org is still enforced by `TenantGuard`). Narrowing permission resolution to the active org is the already-documented D-01 follow-up; it is out of scope for this fix and does not weaken the isolation guarantee delivered this phase.

### WR-01: Handlers returned raw Prisma entities — response DTOs dead, internal columns leaked

**Files modified:** `packages/backend/src/organization/api/organization.controller.ts`, `packages/backend/src/organization/api/dto/organization-response.dto.ts`, `packages/backend/src/organization/api/dto/member-response.dto.ts`
**Commit:** 4e2ff0b
**Applied fix:** Added static `from()` mappers to the (previously dead) `OrganizationResponseDto` and `MemberResponseDto` and applied them in every entity-returning handler (`createOrganization`, `listMyOrgs`, `getOrganization`, `addMember`, `listMembers`). The DTOs are explicit allowlists, so internal audit columns (`updatedBy`, `deletedBy`, `deletedAt`, and — for members — `createdBy`) no longer cross the API boundary. `removeMember` returns 204 (no body). Scope note: the finding cited three handlers by line, but `createOrganization`/`listMyOrgs` leaked identically; mapping all of them applies the finding's principle ("never return Prisma models across the API boundary") consistently.

### WR-02: Member routes silently ignored the `:id` path param

**Files modified:** `packages/backend/src/organization/api/organization.controller.ts`, `packages/backend/src/organization/application/member.service.ts`, `packages/backend/src/organization/application/member.service.spec.ts`
**Commit:** 5153038
**Applied fix:** Threaded the `:id` path param into `MemberService.addMember/listMembers/removeMember` and added a private `assertPathMatchesContext(id)` guard (mirroring `OrganizationService.findById`) that throws `ORG_ACCESS_DENIED` when the path id does not equal the CLS `organizationId`. The helper returns the validated id, which also let me drop the pre-existing `getOrganizationId()!` non-null assertions in those methods. Added a regression test asserting a path/header mismatch is rejected before any DB lookup.

### WR-03: `upsertMember` recorded the invited user as `createdBy`/`updatedBy`

**Files modified:** `packages/backend/src/organization/persistence/member.repository.ts`, `packages/backend/src/organization/application/member.service.ts`, `packages/backend/src/organization/application/member.service.spec.ts`
**Commit:** 39161a4
**Applied fix:** Added an `actorUserId` parameter to `upsertMember` and used it for `createdBy`/`updatedBy` instead of the added user's id. `MemberService.addMember` supplies the actor from `TenantContextService.getUserId()` (CLS). Updated the existing test to assert the actor is recorded.

### WR-04: Last-active-member guardrail (D-15) was a TOCTOU race

**Files modified:** `packages/backend/src/organization/application/member.service.ts`, `packages/backend/src/organization/persistence/member.repository.ts`, `packages/backend/src/organization/application/member.service.spec.ts`
**Commit:** 6ce510a
**Status:** fixed: requires human verification (concurrency-correctness fix — syntax/type/unit checks cannot prove the race is closed under real concurrent load)
**Applied fix:** Moved the `count(ACTIVE)` guard and the soft-delete into a single `prisma.$transaction(..., { isolationLevel: Serializable })`. Under Serializable isolation, two concurrent removals on a 2-member org can no longer both pass the `<= 1` guard — one transaction aborts. Because `$extends` does not propagate into interactive transactions (RESEARCH A2), the delete is written as a **scoped** `updateMany` (`where: { id, organizationId, deletedAt: null }`) so the raw tx client still cannot cross tenant boundaries; `deletedBy` is set from the actor's CLS id. The now-orphaned `MemberRepository.softDelete` (its only caller) was removed. Updated tests 3 and 4 to drive the transaction and assert the scoped `updateMany` and the Serializable isolation level.

**Residual note:** `BaseRepository.getSoftDeleteData()` is now unused by `MemberRepository` but was intentionally left in place — it is a reusable protected helper of the tenancy foundation, not code this change introduced. Human verification should also confirm the deployment's Postgres retries serialization failures (40001) at the app or client layer, since Serializable surfaces conflicts as errors to the loser.

### WR-05: `ORG_SCOPED_MODELS` allowlist fails OPEN for omitted models

**Files modified:** `packages/backend/src/tenancy/tenanted-prisma.service.ts`
**Commit:** 217c278
**Applied fix:** Added a maintenance-critical documentation guardrail on `ORG_SCOPED_MODELS` spelling out the fail-open-on-omission behavior, the invariant that any org-owned model MUST be listed before it becomes reachable via the scoped client, and the rationale for keeping the allowlist (ADR-001).

**Why not the review's "invert the default" / CI-completeness-check suggestion:** per the task brief the allowlist is an intentional ADR-001 design and must not be removed. Crucially, the schema declares **dozens** of `organizationId`-bearing models for future phases (Capability, Prompt, AiModel, Branch, Commit, PullRequest, GeneratedCode, WorkflowRun, …) that are not yet wired to any repository. A naive completeness assertion or default-scoped inversion would therefore fail/break the build today and is a larger design change — so the durable CI guardrail is documented as deferred follow-up rather than forced in this pass. This finding is a documentation-only mitigation; the underlying fail-open property remains by design and warrants human tracking.

### WR-06: `$extends` where-injection does not reach nested reads via `include`/`select`

**Files modified:** `packages/backend/src/tenancy/base-repository.ts`
**Commit:** c2bb659
**Applied fix:** Documented the constraint in `BaseRepository`: the query extension only rewrites the top-level operation's `where`, so relations loaded via `include`/`select` bypass the org/`deletedAt` filter. Added an explicit rule forbidding nested `include`/`select` of scoped relations through the scoped client (load related scoped data with a separate top-level scoped query, or write the nested filter explicitly). This is latent today (no scoped query uses a nested include), so the fix is preventive documentation; a real-DB regression test is recommended as follow-up.

## Skipped Issues

None. All 7 in-scope findings were fixed.

_Info findings IN-01, IN-02, IN-03 were out of scope (fix_scope: critical_warning) and were not addressed, except that WR-02's `assertPathMatchesContext` incidentally removed the `getOrganizationId()!` assertions IN-03 flagged in `member.service.ts`._

---

_Fixed: 2026-07-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
