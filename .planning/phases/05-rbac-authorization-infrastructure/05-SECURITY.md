---
phase: 05
slug: rbac-authorization-infrastructure
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-03
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> RBAC Authorization Infrastructure. Plans audited: 05-01, 05-02, 05-03, 05-04.
> Threats closed: 16/16 · Open (blockers): 0 · Unregistered flags: 0.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| thrown exception → client envelope | The 403 body is attacker-visible; it must not leak which permission/role/ID was missing | Error code + generic message |
| principal email → permission set | Resolution decides capability; a wrong/over-broad result is privilege escalation | Identity → permission codes |
| request → database | The resolver reads identity data; it must never write during authorization | Read-only identity query |
| client request → gated handler | Untrusted principal crosses into an authorized operation; the guard is the enforcement point | HTTP request → route handler |
| authN result → authZ decision | Authorization must derive only from resolved permissions, never from the fact that authentication succeeded | Authenticated principal → permission check |
| CI signal → reviewers | A green CI run must mean the real-DB RBAC proof actually executed, not that it silently skipped | CI job status |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | 403 error envelope | mitigate | `permissions.guard.ts:53-57,66-69` — deny paths throw fixed `errorCode: AUTHZ.PERMISSION_DENIED`; missing permission never interpolated into message | closed |
| T-05-02 | Tampering | error-code catalog layering | mitigate | `global-exception.filter.ts:49-56` — reads `errorCode` as opaque data; filter has zero imports from `src/authorization/` | closed |
| T-05-03 | Elevation of Privilege | permission-resolution query | mitigate | `permission-resolver.service.ts:60-93` — single `findFirst`; non-deleted User + non-deleted/non-expired UserRole/Role/RolePermission/Permission; exact-code Set, no hierarchy | closed |
| T-05-04 | Elevation of Privilege / fail-open | unknown/soft-deleted user or empty roles | mitigate | `permission-resolver.service.ts:95-101` — `user?.userRoles.flatMap(...) ?? []`; null/soft-deleted user → empty Set; never throws on absence | closed |
| T-05-05 | Tampering | authorization during request | mitigate | `permission-resolver.service.ts:60` — only `findFirst`; no create/update/upsert/delete write path | closed |
| T-05-06 | Denial of Service | per-request query cost | mitigate | `permission-resolver.service.ts:44-47,60-93,104` — CLS read → single nested query → CLS memoize; no N+1 | closed |
| T-05-07 | Elevation of Privilege | authN/authZ conflation | mitigate | `permissions.guard.ts:59-69` — decision derives solely from resolved Set; insufficient permissions → 403, not passed on auth-success alone | closed |
| T-05-08 | Elevation of Privilege | guard registration order | mitigate | `app.module.ts:118,121,124` — ThrottlerGuard → JwtAuthGuard → PermissionsGuard; `permissions.guard.ts:51-57` — `!request.user` fails closed to 403 | closed |
| T-05-09 | Elevation of Privilege | AND-match bypass | mitigate | `permissions.guard.ts:61` — `requiredCodes.every((code) => effective.has(code))`; exact-code Set membership, no hierarchy | closed |
| T-05-10 | Information Disclosure | 403 message | mitigate | `permissions.guard.ts:54-56,67-68` — identical hardcoded message on both deny paths; no dynamic interpolation of codes/roles/IDs | closed |
| T-05-11 | Elevation of Privilege | stub backdoor | mitigate | `permissions.guard.ts` — no `AUTH_MODE`/stub branch in executable code (only a comment at :25); stub email resolves via DB identically to Entra identities | closed |
| T-05-12 | Elevation of Privilege | stub backdoor | mitigate | `app.integration.spec.ts:564-571` — stub principal with no seeded UserRole → `expect(status).toBe(403)` | closed |
| T-05-13 | Elevation of Privilege | authN/authZ conflation | mitigate | `app.integration.spec.ts:573-579` (no token → 401), `553-561` (valid-but-unauthorized → 403) | closed |
| T-05-14 | Information Disclosure | 403 body over the wire | mitigate | `app.integration.spec.ts:559-561` — `expect(body.message).not.toContain('organization:manage')` | closed |
| T-05-15 | Tampering | test fixture cleanup | accept | `app.integration.spec.ts:536-544` — `afterAll` deletes only fixture rows; seeded data read-only; ephemeral CI DB (see Accepted Risks Log) | closed |
| T-05-16 | Repudiation / false confidence | silent test skip in CI | mitigate | `app.integration.spec.ts:106-108` (non-skippable guard `it()`); `ci.yml:43-44` (`RBAC_REALDB_REQUIRED=1` + real `DATABASE_URL`); `vitest.config.ts:16` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-15 | `afterAll` deletes only created fixture rows (UserRole → OrganizationMember → User). Seeded reference data (permissions, roles, organization) is read-only in tests. CI uses an ephemeral `postgres:16` service container destroyed after the job, eliminating cross-run contamination. Accepted at plan time. | gsd-security-auditor (plan-time disposition) | 2026-07-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-03 | 16 | 16 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-03
