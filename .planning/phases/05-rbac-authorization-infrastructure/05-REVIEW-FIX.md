---
phase: 05-rbac-authorization-infrastructure
fixed_at: 2026-07-03T00:00:00Z
review_path: .planning/phases/05-rbac-authorization-infrastructure/05-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-03
**Source review:** .planning/phases/05-rbac-authorization-infrastructure/05-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (WR-01, WR-02, WR-03, WR-04, IN-01 — `--all` pass now includes the Info finding)
- Fixed: 4 (WR-01, WR-02, WR-04 in iteration 1; IN-01 this pass)
- Skipped: 1 (WR-03 — requires an out-of-scope frozen-schema migration)

This is the cumulative report across both passes. Iteration 1 fixed the three warnings (WR-01, WR-02, WR-04) and deferred WR-03. Iteration 2 (this `--all` pass) is scoped to the single new in-scope finding, IN-01. The three iteration-1 warning fixes were verified already present in the working tree and were NOT re-applied, re-edited, or reverted.

## Fixed Issues

### IN-01: Real-DB detection relied on a brittle `'mock'` substring check

**Files modified:** `packages/backend/src/app.integration.spec.ts`
**Commit:** 865cc9b
**Applied fix:** Replaced the fragile substring test `!process.env['DATABASE_URL'].includes('mock')` with an EXACT comparison against the placeholder connection string. Introduced a single named module constant `MOCK_DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock'` and reused it in three places that previously repeated the literal: the `DATABASE_URL` default assignment, the `realDbAvailable` derivation, and the Rate-Limiting mock config map. `realDbAvailable` is now `!!process.env['DATABASE_URL'] && process.env['DATABASE_URL'] !== MOCK_DATABASE_URL`, so a legitimate Postgres endpoint whose host/db name merely contains "mock" is no longer misclassified as unavailable, and a placeholder that omits the literal token can no longer masquerade as real. The adjacent comment was updated to describe the exact-match sentinel approach.

`realDbAvailable` (a real, non-placeholder DB is configured) was deliberately kept INDEPENDENT of `realDbRequired` (the `RBAC_REALDB_REQUIRED` CI intent flag). Collapsing the two would have made the non-skippable guard `if (realDbRequired) expect(realDbAvailable).toBe(true)` tautological and neutered the silent-skip protection (D-09 / T-05-16); the guard must still fail loudly when CI sets the flag but the DB is mis-wired.

**Verification:**
- `eslint src/app.integration.spec.ts` — exit 0, no errors.
- `tsc --noEmit` — no errors referencing `app.integration.spec.ts`.
- `vitest run src/app.integration.spec.ts` — 1 file, 20 passed / 4 skipped. The RBAC real-DB `describe.skipIf` correctly skips locally (no real DB), and the non-skippable guard passes trivially since `realDbRequired` is unset locally.

### WR-02: CLS memoization keyed only on presence, not on `email`/`organizationId`

**Files modified:** `packages/backend/src/authorization/permission-resolver.service.ts`, `packages/backend/src/authorization/permission-resolver.service.spec.ts`
**Commit:** f420d14 (iteration 1)
**Status this pass:** no_change_needed — already fixed in iteration 1; verified present (`` `${PERMISSIONS_CLS_KEY}:${email}:${organizationId ?? ''}` `` used for both `cls.get` and `cls.set`). Not re-applied or reverted.
**Applied fix:** Replaced the single global CLS key with a per-request key derived from the resolution inputs (`email` + `organizationId`), making the memo correct by construction and closing the latent cross-org / cross-principal permission-bleed the Phase-6 org seam would have triggered.

### WR-01: Unreachable `void organizationId;` dead code

**Files modified:** `packages/backend/src/authorization/permission-resolver.service.ts`
**Commit:** 2194a17 (iteration 1)
**Status this pass:** no_change_needed — already fixed in iteration 1; verified the unreachable statement is gone. Not re-applied or reverted.
**Applied fix:** Removed the unreachable `void organizationId;` statement (and its preceding comment) sitting after `return resolved;`. The parameter remains referenced via the WR-02 cache key, so `@typescript-eslint/no-unused-vars` still passes with no rename or suppression directive.

### WR-04: `@RequirePermissions()` with no arguments silently fails open

**Files modified:** `packages/backend/src/authorization/decorators/require-permissions.decorator.ts`, `packages/backend/src/authorization/decorators/require-permissions.decorator.spec.ts` (new)
**Commit:** c6a28a0 (iteration 1)
**Status this pass:** no_change_needed — already fixed in iteration 1; verified the zero-arg throw is present. Not re-applied or reverted.
**Applied fix:** The decorator now throws at decoration time (module load) when called with zero codes, converting the silent fail-open footgun into a loud boot-time failure consistent with the subsystem's fail-closed premise. The guard's defensive `requiredCodes.length === 0` short-circuit was intentionally left unchanged.

## Skipped Issues

### WR-03: Authorization keyed on mutable `email`; `User` has no immutable subject identifier

**File:** `packages/backend/src/authorization/permission-resolver.service.ts:60-64`; `packages/backend/src/authorization/permissions.guard.ts:60`
**Reason:** skipped (deferred) — a real fix requires a frozen-schema migration that is out of scope for this milestone. Resolving permissions by a stable subject key (e.g. `entraId`/`oid`) requires adding a new immutable column to the `User` model (e.g. `User.entraObjectId @unique`) plus a migration and provisioning to populate it. CLAUDE.md §10 requires every schema change to ship with a migration and updated types, and the schema is frozen for this milestone (PROJECT.md marks schema changes out-of-scope). Applying a partial fix (adding the column without provisioning, or switching the join key before the column is populated) would break authorization. Recorded as a known, documented risk to be addressed in the identity-provisioning phase.
**Original issue:** The guard resolves permissions via `request.user.email` and the resolver joins on `User.email`, which is mutable and (in Entra) reassignable. If an email/`preferred_username` is ever reassigned to a different Entra identity, the new principal would silently inherit the prior user's roles — a privilege-inheritance vector.

## Verification (iteration 2)

- IN-01: `eslint` exit 0; `tsc --noEmit` no errors referencing the modified file; `vitest run src/app.integration.spec.ts` → 20 passed / 4 skipped (RBAC real-DB block skips locally, non-skippable guard passes).
- WR-01 / WR-02 / WR-04: verified already applied in the working tree (commits 2194a17, f420d14, c6a28a0); not touched this pass.

---

_Fixed: 2026-07-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
