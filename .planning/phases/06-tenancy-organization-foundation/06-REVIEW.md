---
phase: 06-tenancy-organization-foundation
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/backend/src/app.module.ts
  - packages/backend/src/auth/auth-audit-context-provider.ts
  - packages/backend/src/organization/api/dto/add-member.dto.ts
  - packages/backend/src/organization/api/dto/create-organization.dto.ts
  - packages/backend/src/organization/api/dto/member-response.dto.ts
  - packages/backend/src/organization/api/dto/organization-response.dto.ts
  - packages/backend/src/organization/api/organization.controller.ts
  - packages/backend/src/organization/application/member.service.ts
  - packages/backend/src/organization/application/organization.service.ts
  - packages/backend/src/organization/organization.module.ts
  - packages/backend/src/organization/persistence/member.repository.ts
  - packages/backend/src/organization/persistence/organization.repository.ts
  - packages/backend/src/tenancy/base-repository.ts
  - packages/backend/src/tenancy/decorators/no-tenant-scope.decorator.ts
  - packages/backend/src/tenancy/tenancy-error-codes.ts
  - packages/backend/src/tenancy/tenancy.module.ts
  - packages/backend/src/tenancy/tenant-context.service.ts
  - packages/backend/src/tenancy/tenant.guard.ts
  - packages/backend/src/tenancy/tenanted-prisma.service.ts
  - packages/backend/src/app.integration.spec.ts
  - packages/backend/src/organization/application/member.service.spec.ts
  - packages/backend/src/organization/application/organization.service.spec.ts
  - packages/backend/src/tenancy/tenant.guard.spec.ts
  - packages/backend/src/tenancy/tenanted-prisma.service.spec.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-03
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the tenancy/organization foundation. The core tenant-isolation primitives
(TenantGuard header validation, `$extends` where-injection, D-08 fail-closed on missing
org context, D-02 non-leaking error codes, array-header injection guard) are correctly
implemented and well-tested. Cross-tenant reads/writes through the *scoped* client cannot
escape the active org, and TenantGuard uses the raw client to avoid the circular deadlock.

However, the org/member HTTP surface ships with **no authorization checks** — any ACTIVE
member of any role can add or remove members. Additionally, handlers leak raw Prisma
entities (bypassing the response DTOs), the `:id` path param on member routes is silently
ignored, member audit attribution records the wrong actor, the last-member guardrail is a
TOCTOU race, and tenant isolation depends on a hand-maintained model allowlist that fails
open on omission. Details below.

## Critical Issues

### CR-01: Member-management and org-read endpoints have no authorization — any member can add/remove members

**File:** `packages/backend/src/organization/api/organization.controller.ts:45-64`
**Issue:** None of `getOrganization`, `addMember`, `listMembers`, or `removeMember` carry
`@RequirePermissions(...)`. TenantGuard only proves the caller is *an ACTIVE member* of the
org — it does not distinguish roles. Consequently any member (e.g. a `Developer` with only
`organization:read`) can `POST /:id/members` to grant a chosen user ACTIVE membership, or
`DELETE /:id/members/:memberId` to evict other members (including admins; only the last
active member is protected). This is privilege escalation / intra-org DoS and violates
CLAUDE.md §9 ("authorization checks" on every endpoint) and §11 (least privilege). Phase 5
already provides `PermissionsGuard` + `@RequirePermissions` and the RBAC test fixtures
reference `organization:manage`, so the mechanism exists but is unused here.
**Fix:** Gate mutating routes behind an org-management permission, e.g.:
```ts
@Post('/:id/members')
@RequirePermissions('organization:manage')
addMember(@Param('id') id: string, @Body() dto: AddMemberDto) { ... }

@Delete('/:id/members/:memberId')
@RequirePermissions('organization:manage')
@HttpCode(204)
removeMember(...) { ... }

@Get('/:id')
@RequirePermissions('organization:read')
getOrganization(...) { ... }
```
Note: verify guard ordering — `PermissionsGuard` runs *before* `TenantGuard`
(app.module.ts:129-134), so any org-scoped permission resolution must not depend on the CLS
`organizationId` that TenantGuard sets afterwards.

## Warnings

### WR-01: Handlers return raw Prisma entities — response DTOs are dead and internal columns leak

**File:** `packages/backend/src/organization/api/organization.controller.ts:46,52,57` and `api/dto/organization-response.dto.ts`, `api/dto/member-response.dto.ts`
**Issue:** `OrganizationResponseDto` and `MemberResponseDto` are defined but never imported
or applied anywhere (confirmed by grep). Handlers return the Prisma `Organization` /
`OrganizationMember` objects directly, so internal audit columns (`createdBy`, `updatedBy`,
`deletedBy`, `deletedAt`) are serialized to API clients. This violates CLAUDE.md §11
("never expose internal IDs unintentionally") and §9 ("typed responses").
**Fix:** Map service results to the response DTOs before returning (or apply a
`ClassSerializerInterceptor` with `@Expose`/`@Exclude`), and delete the DTOs if the mapping
approach differs. Do not return Prisma models across the API boundary.

### WR-02: Member routes silently ignore the `:id` path param — no path/header consistency check

**File:** `packages/backend/src/organization/api/organization.controller.ts:50-64`
**Issue:** `addMember`, `listMembers`, and `removeMember` bind `:id` as `_id` and discard it;
the target org is taken entirely from the `X-Organization-Id` header via CLS. So
`POST /organizations/ORG_A/members` with header `X-Organization-Id: ORG_B` mutates ORG_B while
the URL claims ORG_A. This is inconsistent with `getOrganization`/`findById`, which explicitly
compares the path id against the CLS org (organization.service.ts:89-95) to prevent IDOR
confusion. While the header org is still membership-validated (so it is not a cross-tenant
breach), a client legitimately targeting the path org can silently operate on a different org.
**Fix:** Validate `id === ctx.getOrganizationId()` at the start of each member route (mirror the
`findById` guard, throwing `ORG_ACCESS_DENIED` on mismatch), so the path and header must agree.

### WR-03: `upsertMember` records the invited user as `createdBy`/`updatedBy`, not the acting member

**File:** `packages/backend/src/organization/persistence/member.repository.ts:52-64`
**Issue:** `upsertMember(organizationId, userId)` sets `createdBy: userId` and
`updatedBy: userId`, where `userId` is the user *being added*, not the member performing the
add. Audit attribution is therefore wrong: the invited user appears to have added themselves.
The acting identity is available via `TenantContextService.getUserId()` (CLS `userId`).
**Fix:** Pass the actor's user id into the repository and use it for `createdBy`/`updatedBy`:
```ts
upsertMember(organizationId: string, userId: string, actorUserId: string) { ...
  create: { ..., createdBy: actorUserId },
  update: { ..., updatedBy: actorUserId },
}
```

### WR-04: Last-active-member guardrail (D-15) is a TOCTOU race

**File:** `packages/backend/src/organization/application/member.service.ts:64-78`
**Issue:** `removeMember` runs a `count(status:ACTIVE)` and then a separate `softDelete`, with
no transaction or row locking between them. Two concurrent `removeMember` calls on a 2-member
org can both observe `activeCount = 2`, both pass the `<= 1` check, and both soft-delete —
leaving the org with **zero** active members, defeating the D-15 invariant.
**Fix:** Perform the count and the delete inside a single `$transaction`, or make the delete
conditional (e.g. `updateMany` guarded by a subquery / `SELECT ... FOR UPDATE` on the active
set) so the invariant is enforced atomically.

### WR-05: `ORG_SCOPED_MODELS` allowlist fails OPEN for omitted models

**File:** `packages/backend/src/tenancy/tenanted-prisma.service.ts:12-20,77-94`
**Issue:** Tenant scoping is applied only to the hand-maintained `ORG_SCOPED_MODELS` set. The
D-08 fail-closed behavior triggers *only* for models already in the set. Any future org-owned
model that a developer forgets to add is silently NOT scoped — the extension passes the query
through unmodified, yielding a full-table cross-tenant read/write with no error. This is the
opposite of the "fail-closed" guarantee the file's header comment claims, and is the highest
long-term isolation risk in a multi-tenant codebase.
**Fix:** Invert the default: derive the scoped-model set from schema metadata (models that
declare an `organizationId` field), or maintain an explicit `ROOT/UNSCOPED_MODELS` opt-out list
and treat every other model as scoped-by-default, throwing if an unclassified model is queried.
At minimum add a CI check that every model with an `organizationId` column is present in the set.

### WR-06: `$extends` where-injection does not reach nested reads via `include`/`select`

**File:** `packages/backend/src/tenancy/tenanted-prisma.service.ts:63-97`
**Issue:** Prisma query extensions do not fire for relations loaded through `include`/`select`;
only the top-level operation's `where` is scoped here. No current scoped query uses a nested
`include` on another scoped model, so this is latent — but the moment one does (e.g.
`project.findMany({ include: { members: true } })`), the nested rows bypass the
`organizationId`/`deletedAt` filter and cross-tenant data leaks.
**Fix:** Document this constraint in `BaseRepository` and forbid nested `include` of scoped
relations through the scoped client; require nested org filters to be written explicitly, or add
a repository-level lint/guard. Consider a real-DB test that asserts a nested include stays scoped.

## Info

### IN-01: Dead repository method — `OrganizationRepository.create`

**File:** `packages/backend/src/organization/persistence/organization.repository.ts:15-17`
**Issue:** `create()` is never called; `createOrganization` writes via `tx.organization.create`
inside the transaction (organization.service.ts:48). Dead code (CLAUDE.md §18).
**Fix:** Remove the unused method, or route org creation through the repository for consistency.

### IN-02: Dead repository method — `MemberRepository.findById`

**File:** `packages/backend/src/organization/persistence/member.repository.ts:29-31`
**Issue:** `findById` is not referenced by `MemberService` or any caller (confirmed by grep).
Dead code.
**Fix:** Remove it, or wire it into the member-detail route if one is planned.

### IN-03: Non-null assertions mask a missing-context failure mode

**File:** `packages/backend/src/organization/application/member.service.ts:34,65`
**Issue:** `this.ctx.getOrganizationId()!` suppresses the `undefined` case. On a correctly
guarded route CLS is populated, but if this service is ever reached without TenantGuard the `!`
turns a clear failure into a downstream `organizationId: undefined` write/count. Prefer an
explicit guard that throws `NO_ORG_CONTEXT`.
**Fix:**
```ts
const organizationId = this.ctx.getOrganizationId();
if (!organizationId) throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT, ... });
```

---

_Reviewed: 2026-07-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
