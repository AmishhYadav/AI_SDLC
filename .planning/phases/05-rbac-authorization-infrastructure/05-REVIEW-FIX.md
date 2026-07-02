---
phase: 05-rbac-authorization-infrastructure
fixed_at: 2026-07-03T00:00:00Z
review_path: .planning/phases/05-rbac-authorization-infrastructure/05-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-03
**Source review:** .planning/phases/05-rbac-authorization-infrastructure/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01, WR-02, WR-03, WR-04 — the single Info finding IN-01 was out of scope for this pass)
- Fixed: 3 (WR-01, WR-02, WR-04)
- Skipped: 1 (WR-03 — requires an out-of-scope schema change)

**Note on fix ordering:** WR-02 was applied before WR-01 (deviating from document order) because the two findings compose on the same function. Keying the CLS memo on `organizationId` (WR-02) makes the parameter genuinely used, which lets WR-01 simply delete the unreachable `void organizationId;` line with no misleading `_`-prefix rename or `eslint-disable` hack. The project's resolved lint config confirmed this was necessary: `@typescript-eslint/no-unused-vars` is an error with no `argsIgnorePattern`, so removing the dead line without WR-02 would have failed lint. This ordering yields the cleanest final code and git history.

## Fixed Issues

### WR-02: CLS memoization keyed only on presence, not on `email`/`organizationId`

**Files modified:** `packages/backend/src/authorization/permission-resolver.service.ts`, `packages/backend/src/authorization/permission-resolver.service.spec.ts`
**Commit:** f420d14
**Applied fix:** Replaced the single global CLS key (`PERMISSIONS_CLS_KEY`) with a per-request key derived from the resolution inputs: `` `${PERMISSIONS_CLS_KEY}:${email}:${organizationId ?? ''}` ``, used for both `cls.get` and `cls.set`. This makes the memo correct by construction — two `resolve()` calls for different principals or organizations within one request can no longer read each other's cached Set (the latent cross-org bleed the Phase-6 org seam would have triggered). Updated the two spec assertions that asserted the old constant key, and added a focused test proving the memo is keyed on `email` + `organizationId`. Minimal and correct; no speculative Phase-6 query-filter scope was added.

**Security-sensitive — recommend human confirmation** of the cache-key derivation before the phase proceeds (verified by the new scoping test plus the existing 8 resolver tests, all green).

### WR-01: Unreachable `void organizationId;` dead code

**Files modified:** `packages/backend/src/authorization/permission-resolver.service.ts`
**Commit:** 2194a17
**Applied fix:** Removed the unreachable `void organizationId;` statement (and its preceding comment) that sat after `return resolved;`. The parameter remains referenced via the WR-02 cache key, so lint (`@typescript-eslint/no-unused-vars`) still passes with no rename or suppression directive. The Phase-6 org-narrowing seam remains documented in the method's JSDoc.

### WR-04: `@RequirePermissions()` with no arguments silently fails open

**Files modified:** `packages/backend/src/authorization/decorators/require-permissions.decorator.ts`, `packages/backend/src/authorization/decorators/require-permissions.decorator.spec.ts` (new)
**Commit:** c6a28a0
**Applied fix:** The decorator now throws at decoration time (module load) when called with zero codes: `throw new Error('@RequirePermissions requires at least one permission code.')`. This converts the silent fail-open footgun (an empty metadata array the guard cannot distinguish from "no decorator present") into a loud boot-time failure, consistent with the subsystem's fail-closed premise. The guard's existing fail-closed behavior was intentionally left unchanged — it retains its defensive `requiredCodes.length === 0` short-circuit, and the existing guard spec covering that path still passes. Added a new decorator spec covering the zero-arg throw, the spread-empty-array throw, and the non-empty happy path.

## Skipped Issues

### WR-03: Authorization keyed on mutable `email`; `User` has no immutable subject identifier

**File:** `packages/backend/src/authorization/permission-resolver.service.ts:60-64`; `packages/backend/src/authorization/permissions.guard.ts:60`
**Reason:** skipped — a real fix requires a schema change that is out of scope this milestone. Resolving permissions by a stable subject key (e.g. `entraId`/`oid`) requires adding a new immutable column to the `User` model (e.g. `User.entraObjectId @unique`) plus a migration and provisioning to populate it. CLAUDE.md §10 requires every schema change to ship with a migration and updated types, and the schema is frozen for this milestone (PROJECT.md marks schema changes out-of-scope). Applying a partial fix (adding the column without provisioning, or switching the join key before the column is populated) would break authorization. Recorded here as a known, documented risk to be addressed in the identity-provisioning phase rather than letting the mutable-email join calcify as the permanent authorization anchor.
**Original issue:** The guard resolves permissions via `request.user.email` and the resolver joins on `User.email`, which is mutable and (in Entra) reassignable. If an email/`preferred_username` is ever reassigned to a different Entra identity, the new principal would silently inherit the prior user's roles — a privilege-inheritance vector. The immutable `entraId`/`oid` is the recommended cross-app key, but the `User` model stores no such column.

## Verification

- `eslint 'src/**/*.ts'` — exit 0 (the one reported warning is a pre-existing unused `eslint-disable` directive in `common/interceptors/audit.interceptor.spec.ts`, unrelated to these fixes).
- `vitest run src/authorization` — 3 files, 18 tests, all passing.
- `tsc --noEmit` — no errors in any modified file. (Errors reported in `common/interceptors/*` are an rxjs dual-type-identity artifact of the isolated worktree's symlinked `node_modules`, present before these changes and unrelated to the authorization module.)

---

_Fixed: 2026-07-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
