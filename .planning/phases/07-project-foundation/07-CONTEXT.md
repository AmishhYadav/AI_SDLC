# Phase 7: Project Foundation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **org-scoped Project CRUD**, **org-scoped Team management** (Team + TeamMember), **project membership** (ProjectMember), and a **published `OrganizationPort`/project-summary contract** under `packages/backend/src/contracts/` that downstream domains (Phases 8–9) depend on. This is the **first phase to introduce the `contracts/<domain>/` port pattern** that Phase 9 generalizes to all 14 domains.

Everything builds on Phase 6's tenancy foundation: the request-scoped tenant context (CLS: `userId`/`organizationId`/`organizationMemberId`), the global `TenantGuard` (Auth → RBAC → Tenancy chain), and the org-scoped, soft-delete-aware `BaseRepository` (via `TenantedPrismaService`). Project/Team/ProjectMember/TeamMember are org-owned models the `BaseRepository` scopes automatically.

**In scope (PROJ-01 … PROJ-04):**
- **Project CRUD** — create (user-supplied validated `key`, creator auto-added as ACTIVE ProjectMember), list/read all projects in the active org (org-scoped), update, soft-delete (PROJ-01, PROJ-02).
- **Team CRUD** — org-scoped Team create/list/read/update/soft-delete, plus **TeamMember** add/list/remove (PROJ-03).
- **ProjectMember management** — add existing ACTIVE org member to a project (optional free-form `roleName`), list, soft-remove/reactivate (PROJ-03, supports PROJ-01 creator auto-add).
- **`OrganizationPort`** — an in-process TS port (interface + DI token + summary DTOs) exposing `getOrganizationSummary`, `getProjectSummary`, and a membership check, published under `src/contracts/` as the domain's only cross-module surface (PROJ-04).

**Out of scope (defer to later phases):**
- **Project-scoped authorization / private projects** — ProjectMember does NOT gate reads this phase; every ACTIVE org member sees all org projects (D-06). Project-level access control is deferred.
- **Per-org RBAC provisioning** — carried from Phase 6 D-11; admin remains membership-based ("ACTIVE membership in the active org"), not org-scoped permissions.
- **TeamMember roles** — `TeamMember` has no `roleName` field; no role concept for teams this phase (D-04).
- **Repository entity / Repository assignment** — `Repository` is an org-owned model in the schema but is NOT in PROJ-01…04; defer.
- **JIT User/member provisioning** — add-member (team or project) operates on **existing ACTIVE `OrganizationMember`s only** (honors Phase 4 D-04 + Phase 6 D-13).
- **Any schema change** — schema is frozen this milestone; all work is runtime data + application code.
- **Broader / enumeration methods on `OrganizationPort`** — no speculative API; add list methods when a real consumer needs them (D-13).

</domain>

<decisions>
## Implementation Decisions

### Team semantics — resolving the roadmap-vs-schema conflict (PROJ-03)
- **D-01:** The roadmap's "create teams within a project" is **loose wording**. The frozen schema and the domain doc (`DAS-Volume-II`) both make **`Team` org-scoped** (`organizationId`, `@@unique([organizationId, name])`, **no `projectId`**), parallel to `Project`. We honor the schema: **Team is org-scoped**, and "team membership" = `TeamMember` (org-member ↔ team). "Project membership" is the separate `ProjectMember` join.
- **D-02:** Build **both** the org-scoped `Team` + `TeamMember` entities **and** `ProjectMember` management this phase — matching the two distinct entities the schema and domain doc define. Neither table is left unused.
- **D-03:** **TeamMember lifecycle mirrors Phase 6's OrganizationMember pattern (D-13/D-14):** add an **existing ACTIVE org member** (by `organizationMemberId`) to a team, list team members, **soft-remove** (`deletedAt`/`deletedBy`), and **reactivate on re-add** via `@@unique([teamId, organizationMemberId])`. No JIT provisioning — unknown/non-member ⇒ fail-closed with an actionable error.
- **D-04:** **No team-member role concept** — `TeamMember` has no `roleName` field, so we do not invent one (respects the frozen schema).

### Team entity CRUD & authorization (PROJ-03)
- **D-05:** **Full org-scoped Team CRUD** — create, list, read, **update** (rename / description / `type`), **soft-delete** — authorized by **ACTIVE org membership** (Phase 6 D-11; per-org RBAC deferred), enforced at the data layer by `BaseRepository`. **No "last member" guardrail** for teams — an empty team doesn't orphan anything (unlike an org, Phase 6 D-15).

### Project read/access model (PROJ-02)
- **D-06:** **`list`/`read` return ALL projects in the active org** — pure org-scoping via `BaseRepository` (`organizationId` + `deletedAt: null`). Matches PROJ-02's "within their organization, scoped by the tenant context" literally. **`ProjectMember` does NOT gate reads this phase**; it is a membership record only. (Project-level private access is explicitly deferred.)

### Project creation, key, and membership (PROJ-01)
- **D-07:** The Project **`key`** (`@@unique([organizationId, key])`) is **user-supplied and validated** on create — client provides `name` + `key`; reject with an actionable error on duplicate-in-org or format violation (JIRA-style project code). Do not auto-derive.
- **D-08:** On project creation the **creator is auto-added as an ACTIVE `ProjectMember`** (mirrors Phase 6 D-10 org-create), so every project has at least one member and a natural owner. Set the creator's `roleName` to an owner marker (see Discretion).
- **D-09:** Project create authorization is **membership-based** (any ACTIVE member of the active org), consistent with D-05 and Phase 6 D-11.

### Project member management (PROJ-03)
- **D-10:** **ProjectMember lifecycle:** add an existing ACTIVE org member (by `organizationMemberId`) to a project with an **optional free-form `roleName`** (e.g. `OWNER`/`CONTRIBUTOR` — a label only, **not RBAC-enforced** this phase), list, **soft-remove**, **reactivate on re-add** via `@@unique([projectId, organizationMemberId])`. Mirrors Phase 6 add-member (existing members only, fail-closed on unknown).

### OrganizationPort / published contract (PROJ-04)
- **D-11:** The published contracts live at **`packages/backend/src/contracts/`** (start with `contracts/organization/`). It holds **pure TS port interfaces + DI tokens + read-only summary DTO types**, depending on **nothing** in any domain module. The Organization domain **provides** the token (binds the port to its service); consumers **inject the interface**. Matches Phase 9's `contracts/<domain>/` literally with no workspace/build changes. This is the domain's **only cross-module surface**.
- **D-12:** `OrganizationPort` is an **in-process synchronous port** (NestJS provider bound to a DI token) — appropriate for the modular monolith and extraction-ready (interface-only boundary; a future microservice swaps the binding for a remote adapter).
- **D-13:** **Port surface (minimal but sufficient):** `getOrganizationSummary(orgId)`, `getProjectSummary(projectId)` — both returning **lean read-only DTOs** (e.g. `id`, `name`, `key`, `status`; **never** Prisma entities or internal/soft-delete fields) — **plus a membership check** (e.g. `isActiveMember(...)`) that downstream authorization will need. **No list/enumeration methods** (no speculative API).

### Claude's Discretion
- Exact module placement — a new leaf-level `src/project/` (and possibly `src/team/`, or teams folded into `src/organization/`), depending only on config + `TenantedPrismaService`/`BaseRepository` + CLS, mirroring the Phase 4/5/6 leaf-module constraint to avoid cyclic DI. Whether Project and Team are one module or two is your call.
- Whether `ProjectMember`/`TeamMember` repos extend `BaseRepository` directly or use a thin membership-repo variant (both `projectId`/`teamId` are org-owned, so auto-scoping applies).
- The creator's `roleName` value on auto-add (D-08) — e.g. `OWNER` — and the allowed `roleName` vocabulary for D-10 (free-form string vs. a small validated enum-in-code). Keep it a label; do not wire it to RBAC.
- Exact REST shape (routes, DTOs, pagination, idempotency) — follow the SEAM-06 pagination/idempotency/error conventions established in the kernel phase and reused in Phase 6's org/member endpoints.
- Project `key` validation rules (charset, length, casing) and error codes — extend the tenancy/error catalog via `createErrorCatalog`, reusing the `{ success, errorCode, message, traceId }` envelope; messages actionable but non-sensitive.
- Naming of the port interface, DI token, and DTOs; the exact `src/contracts/organization/` file layout that Phase 9 will template.
- Whether `getProjectSummary`/membership-check are enforced through the scoped or unscoped Prisma path (the port may be called cross-org by future consumers — decide the scoping contract explicitly and fail-closed, per Phase 6 D-08).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Projects & Teams" — **PROJ-01 … PROJ-04** (authoritative requirement text).
- `.planning/ROADMAP.md` § "Phase 7: Project Foundation" — goal + 4 success criteria; note Phase 8/9 depend on the `OrganizationPort` published here.
- `.planning/PROJECT.md` § Constraints / Context — modular-monolith + microservice-ready (ports enable extraction), frozen schema (additive-only), least-privilege, never expose internal IDs / stack traces, cross-domain DB access prohibited.

### Prior phase context (decisions this phase extends)
- `.planning/phases/06-tenancy-organization-foundation/06-CONTEXT.md` — **D-11** (membership-based admin; per-org RBAC deferred), **D-05/D-06** (Prisma-extension `BaseRepository` scoping + isolation gate), **D-08** (explicit fail-closed unscoped path for cross-org/bootstrap reads — relevant to the port), **D-10** (creator auto-added as ACTIVE member — mirrored for projects), **D-13/D-14** (add existing members only + soft-delete/reactivate lifecycle — mirrored for Team/Project members), **D-15** (last-member guardrail rationale — NOT applied to teams).
- `.planning/phases/05-rbac-authorization-infrastructure/05-CONTEXT.md` — RBAC stays org-agnostic; guard chain order (`TenantGuard` after `PermissionsGuard`).
- `.planning/phases/04-authentication-entra-id-infrastructure/04-CONTEXT.md` — no JIT User provisioning; unknown user ⇒ fail-closed.

### Database (schema is FROZEN — read to build queries & scoping)
- `packages/database/prisma/schema/organization.prisma` — `Project` (`@@unique([organizationId, key])`, `status ProjectStatus`, soft-delete fields, `onDelete: Restrict`), `ProjectMember` (`organizationId`+`projectId`+`organizationMemberId`, nullable `roleName`, `status ProjectMemberStatus`, `@@unique([projectId, organizationMemberId])`), `Team` (org-scoped, `type TeamType`, `@@unique([organizationId, name])`, **no `projectId`**), `TeamMember` (`teamId`+`organizationMemberId`, **no `roleName`**, `@@unique([teamId, organizationMemberId])`), and `OrganizationMember` (the identity the member joins reference).
- `packages/database/prisma/schema/identity.prisma` — `User`, `Role`/`Permission` (seeded for the **system org only** — reinforces membership-based, not RBAC, admin for new orgs).
- `packages/database/prisma/seed.ts` — no `User`/`OrganizationMember`/`Project` rows seeded; tests create their own fixtures.

### Current codebase state (what Phase 7 builds on)
- `packages/backend/src/tenancy/base-repository.ts` — the abstract org-scoped, soft-delete-aware `BaseRepository` (constructor: `TenantedPrismaService` + `ClsService`; `getSoftDeleteData()` helper) that Project/Team/member repositories extend.
- `packages/backend/src/tenancy/tenanted-prisma.service.ts` — the auto-scoping (`organizationId` + `deletedAt: null`) Prisma client extension; fail-closed when no CLS org context.
- `packages/backend/src/tenancy/tenant-context.service.ts` + `tenancy.module.ts` — CLS accessors for `userId`/`organizationId`/`organizationMemberId`; module Phase 7 modules import.
- `packages/backend/src/organization/` — the Phase 6 reference implementation to mirror: `api/` (controller + DTOs), `application/` (services + specs), `persistence/` (repositories), `organization.module.ts`. Note `organization.repository.ts` uses **raw `PrismaService`** for the root/unscoped org entity — the pattern for any unscoped port lookups.
- `packages/backend/src/common/exceptions/global-exception.filter.ts` + `error-codes.ts` + `common/error-catalog/create-error-catalog.ts` — error envelope + code source for project/team denials and key-collision errors.
- `@repo/database` `PrismaService` (global) — the single Prisma access path.

### Authoritative design (org/project/team domain semantics + API contracts)
- `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-II-Business-Domains.md` § "Organization Domain" — confirms Organization/Project/Team as **parallel core entities** (Team is org-level, NOT project-nested), owned services (Organization/Project/Team Service), published events (`ProjectCreated`/`TeamCreated`), and APIs (Create Project, Add Member). Grounds D-01.
- `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-I-Foundation.md` § modular-monolith → microservice migration — the extraction-readiness rationale behind the `OrganizationPort` boundary (D-11/D-12).
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — API/REST conventions; confirm any prescribed resource shapes for projects/teams/members before finalizing routes.
- `Enterprise-AI-Delivery-Platform-Documentation/06-Module-Specifications/Module-Specifications.md` § "Cross-Module Workflow" — cross-module contract expectations the published port must satisfy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseRepository` (`src/tenancy/base-repository.ts`) + `TenantedPrismaService` — Project/Team/ProjectMember/TeamMember repos extend it and are auto-scoped by `organizationId` + `deletedAt: null` for free (all four models carry `organizationId` — `TeamMember` reaches it via `team`, confirm scoping path).
- Phase 6 `src/organization/` module — controller/DTO/service/repository/spec layout to copy verbatim for the new project/team module(s).
- `OrganizationRepository` raw-`PrismaService` pattern — the precedent for any **unscoped** port lookup (e.g. a cross-org `getProjectSummary`), with the explicit fail-closed discipline from Phase 6 D-08.
- Error catalog (`createErrorCatalog`) + `GlobalExceptionFilter` — standard `{ success, errorCode, message, traceId }` envelope for key-collision, unknown-member, and denial errors.
- Phase 6 member add/remove services — the exact add-existing-member + soft-delete + reactivate-on-readd logic to mirror for Team/Project members.

### Established Patterns
- Membership-based authorization (Phase 6 D-11) — ACTIVE org membership authorizes CRUD; enforced at the data layer, not via org-scoped RBAC.
- Leaf-level module depending only on config + tenancy (`TenantedPrismaService`/`ClsService`) to avoid cyclic DI (Phase 4/5/6 constraint).
- Platform-wide soft-delete (`deletedAt`/`deletedBy`) + reactivate-on-readd via composite `@@unique` (Phase 6 D-14).
- Creator becomes first member on resource creation (Phase 6 D-10 → applied to projects, D-08).

### Integration Points
- New project/team module(s) register in `app.module.ts` and import `TenancyModule` (mirror `OrganizationModule`).
- The Organization domain module **provides** the `OrganizationPort` DI token (binds it to the org/project services); downstream domains (Phases 8–9) will inject the interface from `src/contracts/organization/`.
- `contracts/` becomes a new top-level surface inside `packages/backend/src/` — the template Phase 9 replicates as `contracts/<domain>/` for all 14 domains.

### Landmines
- **Team is NOT project-scoped** — the schema has no `Team.projectId`. Do not add one (frozen schema). "Teams within a project" is delivered as org-scoped Teams + separate ProjectMembers (D-01).
- **Port scoping** — a future cross-org consumer may call `getProjectSummary`; decide explicitly whether the port uses the scoped or unscoped Prisma path and **fail-closed** (never a silent unscoped full-table read), per Phase 6 D-08.
- **`contracts/` must depend on nothing** — pure interfaces + tokens + DTOs; a contract that imports a domain's internals defeats the extraction boundary (D-11).
- **DTO leakage** — port/summary DTOs must expose only public fields (`id`, `name`, `key`, `status`), never Prisma entities, soft-delete metadata, or internal IDs (PROJECT.md security constraint).
- **Frozen schema** — `TeamMember` has no `roleName`; `Project.key` is required + unique per org; add-member FKs require existing `OrganizationMember`s. Design around these, do not migrate.
- **`onDelete: Restrict`** on Project/ProjectMember relations — deletion is soft-delete only; do not attempt hard deletes that violate the restrict constraints.

</code_context>

<specifics>
## Specific Ideas

- Contracts location: `packages/backend/src/contracts/organization/` — port interface + DI token + summary DTOs; the exact layout Phase 9 will template for `contracts/<domain>/`.
- `OrganizationPort` surface: `getOrganizationSummary(orgId)`, `getProjectSummary(projectId)`, `isActiveMember(...)` — lean read-only DTOs only.
- Project `key`: user-supplied JIRA-style code (e.g. `PLAT`), validated unique-per-org with an actionable duplicate/format error.
- Creator auto-added as ACTIVE `ProjectMember` with an owner-marker `roleName` (e.g. `OWNER`) on project create.
- Mirror Phase 6's org/member module structure and add/remove/reactivate lifecycle for Team/Project members.

</specifics>

<deferred>
## Deferred Ideas

- **Project-level (private) access control** — gating project reads by `ProjectMember` so members only see their own projects; introduces project-scoped authorization. Revisit when private projects are needed.
- **Team/Project member roles wired to RBAC** — turning `ProjectMember.roleName` (and any team role) into enforced permissions; blocked on per-org RBAC provisioning (Phase 6 deferred).
- **Repository entity / Repository assignment** — org+project-owned `Repository` model exists in the schema but is outside PROJ-01…04; its own future phase.
- **`OrganizationPort` enumeration methods** (list projects/teams/members) — add when a real downstream consumer needs them, not speculatively.
- **Per-org role provisioning** (carried from Phase 6) — cloning standard roles into new orgs; would let project/team admin move from membership-based to RBAC-based.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 7-Project Foundation*
*Context gathered: 2026-07-03*
