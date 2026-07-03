# Phase 6: Tenancy & Organization Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 6-Tenancy & Organization Foundation
**Areas discussed:** Active-org resolution, Enforcement mechanism, Org creation + bootstrap, Member lifecycle

---

## Active-org resolution

### How a request declares its acting Organization

| Option | Description | Selected |
|--------|-------------|----------|
| X-Organization-Id header | Client sends header; guard validates ACTIVE membership, populates tenant context. Transport-agnostic, uniform. | ✓ |
| URL path param | Org id in the route; every domain must carry `:orgId`, org-less routes need exceptions. | |
| Infer from sole membership | Use the user's only org; breaks the moment they join a second. | |

**User's choice:** X-Organization-Id header
**Notes:** JWT `tenantId` is the Entra tenant, not a platform org; users can belong to many orgs, so the acting org can't come from the token.

### Handling org-less endpoints (create org, list my orgs)

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-out decorator | Enforcement default-on/fail-closed; `@NoTenantScope()` exempts org-less routes (mirrors `@Public()`). | ✓ |
| Opt-in decorator | Org-less by default; `@TenantScoped()` opts in. Fail-open if forgotten. | |
| Path-convention based | Infer from route shape. Implicit and brittle. | |

**User's choice:** Opt-out decorator

### Tenant/actor context contents

| Option | Description | Selected |
|--------|-------------|----------|
| userId + orgId + memberId | One membership lookup serves BaseRepository, RBAC seam, and audit provider. | ✓ |
| Just organizationId | Minimal; forces repeated lookups for userId/member. | |
| Full member + roles | Overlaps Phase 5's memoized permission set; more work per request. | |

**User's choice:** userId + organizationId + organizationMemberId

### Where tenant context is populated in the pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| TenantGuard after RBAC | Global APP_GUARD after PermissionsGuard, completing Auth → RBAC → Tenancy. | ✓ |
| Middleware before guards | Runs before auth; CurrentUser may be unset. | |
| You decide at plan time | Capture intent, let planner pick the primitive. | |

**User's choice:** TenantGuard after RBAC

---

## Enforcement mechanism

### Tenant-enforcement mechanism (ADR — TENANT-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma client extension | App-layer auto-injection of `organizationId` + `deletedAt` filter. No DDL, pooling-safe, isolation-test-covered. RLS noted as future defense-in-depth. | ✓ |
| PostgreSQL RLS | DB-enforced via policies + session var. Strongest guarantee but DDL + pooling friction. | |
| Both (defense-in-depth) | Extension now + RLS backstop. Highest assurance, most work. | |

**User's choice:** Prisma client extension

### Implementation depth this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Implement scoping now | ADR + working BaseRepository, proven by two-org isolation test. | ✓ |
| ADR + minimal proof | ADR + just-enough scoping to pass the isolation test. | |
| ADR-only, defer impl | Record decision, defer all scoping code. | |

**User's choice:** Implement scoping now

### Reconciling the RBAC org-narrowing seam with Tenant-after-RBAC order

| Option | Description | Selected |
|--------|-------------|----------|
| Keep RBAC org-agnostic | RBAC stays union-across-memberships; org-scoping at the data layer; D-01 seam stays documented-but-unapplied. Respects roadmap order. | ✓ |
| Resolve org before RBAC | Reorder so RBAC narrows by active org; deviates from documented chain. | |
| You decide at plan time | Capture tension, let planner choose. | |

**User's choice:** Keep RBAC org-agnostic

### Escape hatch for unscoped/bootstrap access

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit unscoped path | Scoped by default; explicit auditable escape (raw accessor / `systemContext()`) for cross-org/bootstrap. Fail-closed otherwise. | ✓ |
| Model allowlist | Only auto-scope an allowlist; implicit bypass by type. | |
| You decide at plan time | Capture requirement, let planner design API. | |

**User's choice:** Explicit unscoped path

---

## Org creation + bootstrap

### Who can create an organization

| Option | Description | Selected |
|--------|-------------|----------|
| Any authenticated user | Self-service; creator becomes first member. Matches TENANT-03, unblocks isolation test. | ✓ |
| Platform-admin only | Invite-only via system-level permission; complicates setup. | |
| You decide at plan time | Capture that create must work; let planner pick the gate. | |

**User's choice:** Any authenticated user

### How org administration is authorized (frozen schema tension)

| Option | Description | Selected |
|--------|-------------|----------|
| Membership-based, defer role provisioning | ACTIVE membership authorizes org/member admin; per-org role provisioning deferred with a seam. In scope, no schema strain. | ✓ |
| Provision roles on create | Clone roles/permissions into new org, assign creator Owner; RBAC-gated admin. Coherent but adds scope. | |
| You decide at plan time | Capture tension, let planner choose. | |

**User's choice:** Membership-based, defer role provisioning
**Notes:** Seeded roles/permissions belong to the system org only; a new org starts with zero roles; `OrganizationMember` has no owner/admin field.

### Creator's initial member state

| Option | Description | Selected |
|--------|-------------|----------|
| ACTIVE + joinedAt now | Creator is immediately ACTIVE; no invite handshake. | ✓ |
| Leave schema defaults (INVITED) | Honor default; creator can't act until "accepted" — awkward. | |

**User's choice:** ACTIVE + joinedAt now

---

## Member lifecycle

### How a member is added (no JIT user provisioning)

| Option | Description | Selected |
|--------|-------------|----------|
| Existing users only | Resolve existing User by email/id; reject if none. No JIT (honors D-04 / frozen FK). | ✓ |
| Create pending invite | Store INVITED member for an email with no User — not viable (`userId` FK required). | |
| You decide at plan time | Capture constraint, let planner design contract. | |

**User's choice:** Existing users only

### Removal semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete | status=REMOVED + deletedAt/deletedBy; reactivate on re-add. Matches convention. | ✓ |
| Hard delete | Physically delete row; breaks convention, loses audit, FK cascade issues. | |

**User's choice:** Soft-delete

### Removal guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Block removing last member | Prevent orphaning the org; self-removal otherwise allowed. | ✓ |
| No guardrails yet | Any member can remove anyone incl. the last; org can be orphaned. | |
| You decide at plan time | Capture orphaning concern, let planner set the rule. | |

**User's choice:** Block removing last ACTIVE member

---

## Claude's Discretion

- Module placement (leaf-level `src/tenancy/` or `src/organization/`), depending only on config + Prisma + CLS.
- Exact `TenantGuard` primitive and CLS keys.
- Prisma client-extension API shape, `BaseRepository` surface, and unscoped-accessor name.
- `@NoTenantScope()` metadata key and Reflector read pattern.
- Error-code catalog additions for tenancy denials (reusing the standard envelope; non-sensitive messages).
- REST shape of org/member endpoints (routes, DTOs, pagination per SEAM-06).

## Deferred Ideas

- Per-org role/permission provisioning + org-scoped RBAC administration.
- PostgreSQL RLS as DB-level defense-in-depth (recorded in the ADR).
- Applying the RBAC org-narrowing seam (requires reordering the guard chain).
- Invite-by-email for not-yet-registered users (pending invites / JIT user provisioning).
- Owner/admin member roles and richer removal guardrails (ownership transfer, last-admin protection).
