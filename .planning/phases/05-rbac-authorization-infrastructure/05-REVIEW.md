---
phase: 05-rbac-authorization-infrastructure
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/backend/src/authorization/decorators/require-permissions.decorator.ts
  - packages/backend/src/authorization/authorization-error-codes.ts
  - packages/backend/src/authorization/permission-resolver.service.ts
  - packages/backend/src/authorization/permission-resolver.service.spec.ts
  - packages/backend/src/authorization/permissions.guard.ts
  - packages/backend/src/authorization/permissions.guard.spec.ts
  - packages/backend/src/authorization/authorization.module.ts
  - packages/backend/src/app.module.ts
  - packages/backend/src/common/exceptions/error-codes.ts
  - packages/backend/src/common/exceptions/global-exception.filter.ts
  - packages/backend/src/common/exceptions/global-exception.filter.spec.ts
  - packages/backend/src/app.integration.spec.ts
  - packages/backend/vitest.config.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-03
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the RBAC authorization infrastructure with an adversarial focus on fail-closed
behavior, exact-code matching, soft-delete/expiry filtering, the 403 error contract, and
the non-skippable CI security proof.

The core security posture is sound. The specific mechanisms the phase set out to guarantee
hold up under tracing:

- **Fail-closed is genuinely closed.** `PermissionsGuard` denies when `request.user` is
  absent (`permissions.guard.ts:52`), and `requiredCodes.every((code) => effective.has(code))`
  (`:61`) denies whenever the resolved Set is empty or missing any code. The resolver returns
  an empty `Set` for unknown/soft-deleted users and never throws (`permission-resolver.service.ts:97-101`).
- **No backdoors.** There is no `AUTH_MODE`/stub branch in the guard or resolver; stub
  identities resolve from the DB identically to real principals.
- **Exact-code matching** — `effective.has(code)` is a literal Set membership test; no
  wildcard, prefix, or role-name bypass.
- **Soft-delete / expiry filtering** is applied at every level of the resolver query
  (`User.deletedAt`, `UserRole.deletedAt`/`expiresAt`, `role.deletedAt`, `RolePermission.deletedAt`,
  `permission.deletedAt`).
- **403 contract** — `GlobalExceptionFilter` correctly surfaces the explicit
  `AUTHZ.PERMISSION_DENIED` errorCode and maps 403 → `PLATFORM.FORBIDDEN` as a fallback; the
  deny message is a fixed generic constant that leaks no codes/roles/IDs.
- **CI silent-skip guard is correctly wired.** The top-level non-skippable `it(...)` in
  `app.integration.spec.ts:106` asserts `realDbAvailable === true` whenever
  `RBAC_REALDB_REQUIRED=1`, and both the guard and the `describe.skipIf` derive from the same
  `realDbAvailable` value — so a mock/absent DB in CI turns the build red rather than green.
  `ci.yml` sets `RBAC_REALDB_REQUIRED=1` and a non-`mock` `DATABASE_URL`.

No BLOCKER-level defects were found. The findings below are correctness/robustness and
maintainability concerns, one of which (WR-01) may break the `lint` gate the project's own
Definition of Done requires.

## Warnings

### WR-01: Unreachable `void organizationId;` is dead code that fails its own stated purpose

**File:** `packages/backend/src/authorization/permission-resolver.service.ts:106-110`
**Issue:** The statement intended to suppress an unused-parameter lint error is placed
*after* `return resolved;`, so it is unreachable and never executes:

```ts
    return resolved;

    // Suppress "unused variable" lint error: organizationId is intentionally declared ...
    void organizationId;
```

Two problems:
1. It is dead code. TypeScript's `noUnusedParameters` check counts a textual reference
   regardless of reachability, so the parameter would already be considered "used" — the
   `void` line is not actually needed for that purpose.
2. If the ESLint config enables `no-unreachable` (part of `eslint:recommended`), this line is
   itself a lint **error**, which would fail `npx turbo run lint` and contradict CLAUDE.md §18
   ("lint passes", "no dead imports remain"). At best it is confusing noise.

**Fix:** Remove the trailing statement and mark the parameter unused via the conventional
prefix (assuming `argsIgnorePattern: '^_'`), or drop the `void` line and keep the doc comment:

```ts
async resolve(email: string, _organizationId?: string): Promise<Set<string>> {
  // ... existing body, ending with:
  return resolved;
}
```

### WR-02: CLS memoization is keyed only on presence, not on `email`/`organizationId`

**File:** `packages/backend/src/authorization/permission-resolver.service.ts:42-47, 104`
**Issue:** `resolve()` memoizes into the single constant CLS key `effectivePermissions` and
short-circuits on `cached !== undefined` without comparing the `email` (or the declared
`organizationId`) argument to whatever produced the cached value. Today this is safe because
one HTTP request carries exactly one principal and `organizationId` is unused. But it is a
latent authorization bug primed to fire the moment the Phase-6 org seam activates: calling
`resolve(email, orgA)` then `resolve(email, orgB)` within the same request returns orgA's
permission Set for orgB — a cross-organization permission bleed. It would likewise return the
wrong principal's Set if the resolver is ever invoked for two subjects in one request
(e.g., an impersonation or admin-acting-as flow).

**Fix:** Incorporate the resolution inputs into the cache key so the memo is correct by
construction rather than by the current single-principal assumption:

```ts
const cacheKey = `${PERMISSIONS_CLS_KEY}:${email}:${organizationId ?? ''}`;
const cached = this.cls.get<Set<string>>(cacheKey);
if (cached !== undefined) return cached;
// ...
this.cls.set(cacheKey, resolved);
```

### WR-03: Authorization is keyed on the mutable `email`; `User` has no immutable subject identifier

**File:** `packages/backend/src/authorization/permission-resolver.service.ts:60-64`;
`packages/backend/src/authorization/permissions.guard.ts:60`
**Issue:** The guard resolves permissions via `request.user.email`, and the resolver joins on
`User.email`. `CurrentUser` documents `email ← preferred_username ?? email` (mutable, and in
Entra reassignable), while `entraId ← oid` is explicitly called out as the "immutable object
ID; recommended cross-app key" (`current-user.type.ts:9-11`). The `User` model
(`identity.prisma`) stores no `oid`/`entraId` column at all, so authorization can only key on
the mutable email. Consequence: if an email/`preferred_username` is ever reassigned to a
different Entra identity (a documented Entra behavior), the new principal silently inherits
the prior user's roles and permissions — a privilege-inheritance vector.

**Fix:** This is the correct phase to flag the schema gap. Add an immutable external subject
column (e.g., `User.entraObjectId @unique`) and resolve permissions by that stable key instead
of email once user provisioning populates it. At minimum, record this as a known risk for the
identity-provisioning phase rather than letting the mutable-email join calcify as the
authorization anchor.

### WR-04: `@RequirePermissions()` with no arguments silently fails open

**File:** `packages/backend/src/authorization/decorators/require-permissions.decorator.ts:5`;
`packages/backend/src/authorization/permissions.guard.ts:48`
**Issue:** `RequirePermissions(...codes: string[])` accepts zero args, producing an empty
metadata array. The guard treats an empty array identically to "no decorator present":
`if (!requiredCodes || requiredCodes.length === 0) return true;`. A developer who writes
`@RequirePermissions()` (or `@RequirePermissions(...someVarThatIsEmpty)`) intending to gate a
route instead ships an **ungated** route that returns 200 to any authenticated principal — a
fail-open outcome in a subsystem whose whole premise is fail-closed. The guard cannot
distinguish "no gate intended" from "gate requested but empty," so the mistake is invisible.

**Fix:** Reject an empty code list at decoration time so the footgun fails loudly at boot
rather than silently at runtime:

```ts
export const RequirePermissions = (...codes: string[]): MethodDecorator & ClassDecorator => {
  if (codes.length === 0) {
    throw new Error('@RequirePermissions requires at least one permission code.');
  }
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, codes);
};
```

## Info

### IN-01: Real-DB detection relies on a brittle `'mock'` substring check

**File:** `packages/backend/src/app.integration.spec.ts:25`
**Issue:** `realDbAvailable` is derived from `!process.env['DATABASE_URL'].includes('mock')`.
This couples the security-critical CI gate to a magic substring: a legitimate Postgres URL
whose host/db name happens to contain "mock" would be misclassified as unavailable and
silently skip the real-DB RBAC proof, while a placeholder that omits the literal token "mock"
would be treated as real. It works for the current fixtures but is fragile to future
environment naming.

**Fix:** Gate on an explicit intent flag rather than pattern-matching the connection string —
e.g., treat the DB as real only when `RBAC_REALDB_REQUIRED === '1'` (or a dedicated
`USE_REAL_DB` flag) is set, and keep the substring check, if at all, as a secondary guard.

---

_Reviewed: 2026-07-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
