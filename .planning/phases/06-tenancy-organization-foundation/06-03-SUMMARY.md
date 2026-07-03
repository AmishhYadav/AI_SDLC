---
phase: 06-tenancy-organization-foundation
plan: "03"
subsystem: organization
tags: [organization, member, repository, service, unit-tests, tdd, tenancy]
dependency_graph:
  requires:
    - 06-01 (BaseRepository, TenantedPrismaService, TenantContextService, TENANT_ERROR_CODES)
  provides:
    - CreateOrganizationDto / OrganizationResponseDto / AddMemberDto / MemberResponseDto
    - OrganizationRepository (raw PrismaService — Organization has no organizationId FK)
    - MemberRepository (extends BaseRepository; upsertMember uses raw PrismaService)
    - OrganizationService (createOrganization atomic $transaction + email-based User lookup)
    - MemberService (addMember fail-closed, last-member guardrail, soft-delete)
    - 5 MemberService unit tests (USER_NOT_FOUND, re-add, LAST_MEMBER_REMOVAL, remove, list)
    - 4 OrganizationService unit tests (USER_NOT_FOUND, D-10 atomicity, IDOR guard, happy path)
  affects:
    - packages/backend/src/organization/ (new directory tree — 10 files)
tech_stack:
  added: []
  patterns:
    - Raw PrismaService for Organization root entity (no organizationId FK)
    - BaseRepository extension pattern with TenantedPrismaService for scoped member ops
    - Raw PrismaService for upsertMember to avoid RESEARCH A3 extension.where conflict
    - $transaction(async tx => ...) for atomic org + ACTIVE member creation (D-10)
    - Email-based User resolution on @NoTenantScope routes (CLS has no userId)
    - Direct constructor instantiation (no TestingModule) for all unit tests
key_files:
  created:
    - packages/backend/src/organization/api/dto/create-organization.dto.ts
    - packages/backend/src/organization/api/dto/organization-response.dto.ts
    - packages/backend/src/organization/api/dto/add-member.dto.ts
    - packages/backend/src/organization/api/dto/member-response.dto.ts
    - packages/backend/src/organization/persistence/organization.repository.ts
    - packages/backend/src/organization/persistence/member.repository.ts
    - packages/backend/src/organization/application/organization.service.ts
    - packages/backend/src/organization/application/member.service.ts
    - packages/backend/src/organization/application/member.service.spec.ts
    - packages/backend/src/organization/application/organization.service.spec.ts
  modified: []
decisions:
  - "OrganizationRepository uses raw PrismaService only — Organization has no organizationId FK; it is the root entity; the scoped client would fail-closed with NO_ORG_CONTEXT on unscoped routes"
  - "MemberRepository.upsertMember injects raw PrismaService separately from BaseRepository to avoid RESEARCH A3 (extension where-injection conflict on upsert unique-key clause)"
  - "OrganizationService resolves creator/caller identity from authenticated email (not CLS userId) because createOrganization and listMyOrgs run on @NoTenantScope routes where CLS has no userId set yet"
  - "MemberService.addMember never calls user.create() — D-13 requires existing User only; USER_NOT_FOUND on absent email"
  - "softDelete in MemberRepository sets status=REMOVED (not just deletedAt) to distinguish from INVITED/SUSPENDED states and satisfy the LAST_MEMBER_REMOVAL count filter"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-03"
  tasks_completed: 4
  files_created: 10
---

# Phase 06 Plan 03: Organization Data Layer Summary

DTOs, OrganizationRepository (raw PrismaService), MemberRepository (extends BaseRepository with
raw upsert), OrganizationService ($transaction atomic creator-as-member, IDOR guard), MemberService
(fail-closed user lookup, last-member guardrail, soft-delete), and 9 green unit tests.

## What Was Built

Ten files comprising the full organization data layer in a new
`packages/backend/src/organization/` directory tree:

**DTOs (4 files):**
- `CreateOrganizationDto`: `@IsString`, `@MinLength(2)`, `@MaxLength(100)` on `name`; `@Matches(/^[a-z0-9-]+$/)` + `@MinLength(2)`, `@MaxLength(60)` on `slug`. No `organizationId` field (T-06-13 mass-assignment prevention).
- `OrganizationResponseDto`: typed plain class; no `deletedAt`/`deletedBy` (sensitive data exclusion).
- `AddMemberDto`: `@IsEmail()` on `email`.
- `MemberResponseDto`: typed plain class; no `deletedAt`/`deletedBy`.

**Repositories (2 files):**
- `OrganizationRepository`: `@Injectable()` using raw `PrismaService` only. Three methods: `create`, `findById` (findUnique on PK — safe for root entity), `findByMemberUserId` (cross-org by design).
- `MemberRepository`: `extends BaseRepository`. Four methods: `findManyByOrg` and `findById` (findFirst) and `softDelete` use `scopedPrisma.client` (extension auto-injects `organizationId + deletedAt:null`); `upsertMember` uses raw `this.prisma` to avoid RESEARCH A3.

**Services (2 files):**
- `OrganizationService`:
  - `createOrganization(creatorEmail, dto)`: resolves User by email (fail-closed USER_NOT_FOUND); `$transaction` atomically creates org + ACTIVE member with `joinedAt=new Date()` (D-10).
  - `listMyOrgs(creatorEmail)`: resolves User by email; returns `findByMemberUserId` (unscoped cross-org).
  - `findById(id)`: IDOR guard — throws `ORG_ACCESS_DENIED` if `id !== ctx.getOrganizationId()` (T-06-12).
- `MemberService`:
  - `addMember(email)`: `user.findFirst` fail-closed (USER_NOT_FOUND); `upsertMember` (handles re-add reactivation); never calls `user.create()` (D-13).
  - `listMembers()`: delegates to `findManyByOrg()`.
  - `removeMember(memberId)`: counts ACTIVE members; throws `LAST_MEMBER_REMOVAL` if `<= 1` (D-15); then `softDelete`.

**Tests (2 files, 9 tests total):**
- `member.service.spec.ts`: 5 tests — USER_NOT_FOUND (upsertMember not called), re-add upsert path, LAST_MEMBER_REMOVAL (softDelete not called), normal remove, list members.
- `organization.service.spec.ts`: 4 tests — USER_NOT_FOUND ($transaction not called), D-10 atomic creator-as-member (joinedAt is Date, status='ACTIVE'), T-06-12 IDOR guard (findById not called), findById happy path.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all public interfaces are fully implemented with real business logic. No placeholder
values, hardcoded empty returns, or TODO markers.

## Threat Surface Scan

No new network endpoints introduced (controller wiring is Plan 06-04). All files are
service/repository layer. Threat mitigations from the plan's `<threat_model>` implemented:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-06-10 (JIT user creation) | MITIGATED — addMember throws USER_NOT_FOUND; user.create() never called (Test 1 verifies upsertMember not called on null user) |
| T-06-11 (last-member removal orphaning) | MITIGATED — count ACTIVE before remove; LAST_MEMBER_REMOVAL if count <= 1 (Test 3 verifies softDelete not called when count=1) |
| T-06-12 (IDOR via mismatched path id) | MITIGATED — findById validates id === ctx.getOrganizationId(); throws ORG_ACCESS_DENIED (Test 3 in org spec verifies orgRepo.findById not called) |
| T-06-13 (organizationId mass-assignment) | MITIGATED — DTOs contain no organizationId field; global ValidationPipe whitelist:true strips any injected field |
| T-06-14 (user existence oracle) | ACCEPTED — USER_NOT_FOUND only discloses no user exists at that email, not org-level membership data |
| T-06-SC (npm installs) | ACCEPTED — zero new packages installed |

## Self-Check: PASSED
