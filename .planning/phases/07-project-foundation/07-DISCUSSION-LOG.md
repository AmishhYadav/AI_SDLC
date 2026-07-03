# Phase 7: Project Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 7-Project Foundation
**Areas discussed:** Team semantics, Project create + key, Project access model, OrganizationPort contract

---

## Team semantics (PROJ-03 vs frozen schema)

| Option | Description | Selected |
|--------|-------------|----------|
| Both: Team + ProjectMember | Build org-scoped Team + TeamMember CRUD AND ProjectMember management; honors both entities the schema/domain doc define | ✓ |
| ProjectMember only | Interpret "team membership" as ProjectMember; defer standalone Team entity | |
| Team only (org-scoped) | Build Team + TeamMember; treat "within a project" as loose; defer ProjectMember | |

**User's choice:** Both: Team + ProjectMember
**Notes:** Resolved the roadmap-vs-schema conflict — `Team` is org-scoped in the frozen schema (no `projectId`) and the domain doc lists Organization/Project/Team as parallel entities. "Teams within a project" is loose wording.

### Team membership operations

| Option | Description | Selected |
|--------|-------------|----------|
| Add / list / remove (mirror Phase 6) | Add existing ACTIVE org member, list, soft-remove + reactivate-on-readd | ✓ |
| Add / list / remove + update role | Same but TeamMember has no roleName field | |
| Add / list only | Defer removal | |

**User's choice:** Add / list / remove (mirror Phase 6)
**Notes:** No team-member role — schema has no `TeamMember.roleName`.

### Team entity CRUD & authorization

| Option | Description | Selected |
|--------|-------------|----------|
| Create/list/read/update/soft-delete, any ACTIVE member | Full org-scoped Team CRUD, membership-based auth (D-11), no last-member guardrail | ✓ |
| Create/list/read only, any ACTIVE member | Defer update + soft-delete | |
| Full CRUD, but gated differently | Different authorization model | |

**User's choice:** Create/list/read/update/soft-delete, any ACTIVE member

---

## Project create + key (PROJ-01)

### Project key handling

| Option | Description | Selected |
|--------|-------------|----------|
| User-supplied, validated | Client provides name + key; reject on duplicate-in-org or format violation | ✓ |
| Auto-derived from name | Slugify/uppercase, dedupe with suffix | |
| User-supplied, auto-derive fallback | Use key if provided, else derive | |

**User's choice:** User-supplied, validated

### Creator membership

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-add creator as ACTIVE ProjectMember | Mirror Phase 6 D-10; creator's OrganizationMember added as ACTIVE ProjectMember | ✓ |
| No auto-membership | Project created with zero members | |

**User's choice:** Yes, auto-add creator as ACTIVE ProjectMember

---

## Project access model (PROJ-02)

### Project read scoping

| Option | Description | Selected |
|--------|-------------|----------|
| All projects in the active org | Pure org-scoping via BaseRepository; ProjectMember does not gate reads | ✓ |
| Only projects I'm a member of | Filter reads by ACTIVE ProjectMember; introduces project-scoped authz | |

**User's choice:** All projects in the active org
**Notes:** Matches PROJ-02's "within their organization, scoped by the tenant context" literally.

### ProjectMember management operations

| Option | Description | Selected |
|--------|-------------|----------|
| Add / list / remove + optional roleName | Add existing ACTIVE org member (optional free-form roleName), list, soft-remove/reactivate | ✓ |
| Add / list / remove, ignore roleName | Same lifecycle, leave roleName null | |
| Add / list only | Defer removal | |

**User's choice:** Add / list / remove + optional roleName
**Notes:** `roleName` is a free-form label, not RBAC-enforced this phase.

---

## OrganizationPort contract (PROJ-04)

### Contracts location

| Option | Description | Selected |
|--------|-------------|----------|
| packages/backend/src/contracts/ | Top-level dir inside backend package; pure interfaces + tokens + DTOs; matches Phase 9's contracts/<domain>/ | ✓ |
| New @repo/contracts workspace package | Dedicated shared package | |
| Co-located per module (organization/contracts/) | Each domain owns a contracts/ subfolder | |

**User's choice:** packages/backend/src/contracts/

### Port surface

| Option | Description | Selected |
|--------|-------------|----------|
| getOrganizationSummary + getProjectSummary + membership check | Two lookups + isActiveMember-style check returning lean DTOs | ✓ |
| getOrganizationSummary + getProjectSummary only | Just the two lookups PROJ-04 names | |
| Broader (list projects, teams, members) | Add enumeration methods now | |

**User's choice:** getOrganizationSummary + getProjectSummary + membership check
**Notes:** No speculative enumeration methods — add when a real consumer needs them.

---

## Claude's Discretion

- Exact module placement (one project/team module vs. split; teams folded into organization or standalone), preserving the leaf-module / no-cyclic-DI constraint.
- Whether member repos extend `BaseRepository` directly or use a thin variant.
- Creator's `roleName` value on auto-add and the allowed `roleName` vocabulary (label only, not RBAC).
- REST shape (routes, DTOs, pagination, idempotency) per SEAM-06 conventions.
- Project `key` validation rules (charset/length/casing) and error codes.
- Naming of the port interface, DI token, DTOs, and the `src/contracts/organization/` file layout.
- Whether the port lookups use the scoped or unscoped Prisma path — decided explicitly and fail-closed.

## Deferred Ideas

- Project-level (private) access control gating reads by ProjectMember.
- Team/Project member roles wired to enforced RBAC.
- Repository entity / Repository assignment.
- OrganizationPort enumeration methods (list projects/teams/members).
- Per-org role provisioning (carried from Phase 6).
