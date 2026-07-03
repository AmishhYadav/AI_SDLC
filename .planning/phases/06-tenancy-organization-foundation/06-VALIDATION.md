---
phase: 6
slug: tenancy-organization-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
updated: 2026-07-03
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/backend/vitest.config.ts` (already present — Phases 1-5) |
| **Quick run command** | `npm test --workspace=packages/backend -- --run --testPathPattern="<file>"` |
| **Full suite command** | `npm test --workspace=packages/backend -- --run` |
| **Estimated runtime** | ~30-60 seconds (unit specs are pure constructor instantiation; the real-DB isolation block is `describe.skipIf` and skips locally) |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the task's spec (each `<task>` carries an `<automated>` verify).
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** Full suite must be green; the real-DB isolation block must execute (not skip) with a real `DATABASE_URL`.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-03 | 01 | 1 | TENANT-01/02, SEAM-05 | T-06 fail-closed | `$extends` injects org scope; throws `NO_ORG_CONTEXT` when CLS orgId unset; findUnique bypassed | unit | `... --testPathPattern="tenanted-prisma.service.spec"` | ✅ existing infra | ⬜ pending |
| 06-02-02 | 02 | 2 | TENANT-01/02 | T-06-15/17/18 | Guard bypasses @Public/@NoTenantScope; MISSING_ORG_HEADER; ORG_ACCESS_DENIED (no org-existence oracle); ACTIVE-only | unit | `... --testPathPattern="tenant.guard.spec"` | ✅ existing infra | ⬜ pending |
| 06-03-03 | 03 | 2 | TENANT-04/05 | T-06-10/11/14 | No JIT user creation (USER_NOT_FOUND); last-member guardrail; soft-delete; re-add reactivation | unit | `... --testPathPattern="member.service.spec"` | ✅ existing infra | ⬜ pending |
| 06-03-04 | 03 | 2 | TENANT-03 | T-06-12 | Atomic creator-as-ACTIVE-member (D-10); create USER_NOT_FOUND fail-closed; findById IDOR guard | unit | `... --testPathPattern="organization.service.spec"` | ✅ existing infra | ⬜ pending |
| 06-04-02 | 04 | 3 | TENANT-03..07 | T-06-15/16/17/18/19 | Two-org isolation (no cross-tenant leak); missing-header 403; INVITED 403; create-org happy path; helper controllers exempted (no regression) | integration (real DB) | `... --testPathPattern="app.integration.spec"` | ✅ existing infra | ⬜ pending |
| 06-04-03 | 04 | 3 | TENANT-07 | — | ADR-001 records $extends chosen, RLS deferred, isolation test as acceptance gate | doc (grep) | `test -f docs/adr/ADR-001-tenant-enforcement-mechanism.md` | ✅ existing infra | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Command prefix for all rows: `npm test --workspace=packages/backend -- --reporter=verbose --run`.*

---

## Wave 0 Requirements

Existing infrastructure (vitest, `packages/backend/vitest.config.ts`, the `app.integration.spec.ts` real-DB harness, and the CI `RBAC_REALDB_REQUIRED` pattern) covers all phase requirements. No new framework install and no Wave-0 test scaffolding required — every task ships its own spec or a grep-based artifact check.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The two-organization isolation proof (TENANT-06) is automated but gated on a real `DATABASE_URL`: locally it skips (`describe.skipIf(!realDbAvailable)`); in CI the non-skippable guard test fails loudly if `TENANT_REALDB_REQUIRED=1` and the DB is mock/absent, so there is no silent-skip path to green.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra)
- [x] No watch-mode flags (all commands use `--run`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-03
