# Phase 5: RBAC Authorization Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 5-RBAC Authorization Infrastructure
**Areas discussed:** Org-scoping of permissions, Match & hierarchy semantics, Dev/test permission strategy, Resolution performance

---

## Org-scoping of permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Union, org-agnostic + seam | Resolve union of permissions across all active memberships (no org filter), exclude expired/soft-deleted UserRoles, document a Phase-6 tightening seam. Honest given RBAC-runs-before-Tenancy. | ✓ |
| Global, no org dimension | Treat codes as fully global; ignore organizationId, no Phase-6 seam. | |
| Require org from header now | Introduce X-Org-Id header and scope the query to it this phase. | |

**User's choice:** Union, org-agnostic + seam
**Notes:** Aligns with RBAC-03 (RBAC before Tenancy) and the frozen schema; Phase 6 narrows to the active org once tenant context exists.

---

## Match & hierarchy semantics

**Q1 — Multiple-code match logic:**

| Option | Description | Selected |
|--------|-------------|----------|
| AND — require all | Principal must hold every listed permission. Most explicit/secure default. | ✓ |
| OR — require any | Principal needs at least one listed code. | |
| Support both modes | Add a mode option to the decorator. | |

**Q2 — Privileged bypass / hierarchy:**

| Option | Description | Selected |
|--------|-------------|----------|
| No bypass, exact-code | No hardcoded super-role; Platform Administrator passes via seeded data; manage does not imply read; fully data-driven. | ✓ |
| Admin role bypass | Hardcode a super-role that skips checks. | |
| manage implies read | Expand a resource hierarchy. | |

**User's choice:** AND — require all; No bypass, exact-code
**Notes:** RolePermission table stays the single source of truth; no implicit privilege or un-auditable backdoor.

---

## Dev/test permission strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-test fixtures, no bypass | Tests insert User+OrganizationMember+UserRole rows to exercise the real guard (allow + deny); no production authZ bypass; optional dev-only seed helper kept out of production seed. | ✓ |
| Stub-mode grants all perms | AUTH_MODE=stub short-circuits the guard to grant everything. | |
| Seed a bootstrap admin user | Extend the shared production seed with a dev user mapped to Platform Administrator. | |

**User's choice:** Per-test fixtures, no bypass
**Notes:** No User/UserRole rows are seeded today; guard stays fail-closed in every mode, including stub.

---

## Resolution performance

| Option | Description | Selected |
|--------|-------------|----------|
| Query once, cache in CLS | One indexed query per request, memoized in request-scoped CLS; no cross-request staleness; cross-request cache seam deferred. | ✓ |
| Query on every check | Re-run the DB query at each check, no memoization. | |
| Short-TTL cross-request cache | Cache effective permissions per user for N seconds across requests. | |

**User's choice:** Query once, cache in CLS
**Notes:** Correctness-first; nestjs-cls already global so no new wiring. Cross-request cache only if load later demands it.

---

## Claude's Discretion

- Exact module/file placement (`src/auth/` extension vs sibling `src/authorization/` / `src/rbac/`), kept leaf-level to avoid cyclic DI.
- Exact `@RequirePermissions()` shape (variadic codes) and metadata key.
- Exact single-query Prisma form and the CLS key for the memoized permission set.
- 403 error-code selection from the existing catalog and the non-leaking message wording.

## Deferred Ideas

- Org-scoped permission narrowing — Phase 6 (seam defined this phase).
- JIT User provisioning + `entraId` schema column — Phase 6+ (schema frozen).
- OR-mode matching — only if a concrete endpoint needs it.
- Cross-request permission caching — only if load justifies it.
- Standing seeded dev/admin user — rejected for production seed.
