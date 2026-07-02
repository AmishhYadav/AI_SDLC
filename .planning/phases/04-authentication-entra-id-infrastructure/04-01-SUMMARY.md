---
phase: 04-authentication-entra-id-infrastructure
plan: "01"
subsystem: backend/auth
tags: [auth, entra-id, zod, nestjs, di-tokens, decorators]
dependency_graph:
  requires: []
  provides:
    - packages/backend/src/auth/current-user.type.ts
    - packages/backend/src/auth/token-validator.ts
    - packages/backend/src/auth/decorators/public.decorator.ts
    - packages/backend/src/auth/decorators/current-user.decorator.ts
    - packages/backend/src/config/env.schema.ts (AUTH_MODE + ENTRA_* + superRefine)
  affects:
    - packages/backend/src/config/env.schema.spec.ts
    - packages/backend/package.json
tech_stack:
  added:
    - "@nestjs/passport@11.0.5"
    - "passport@0.7.0"
    - "passport-jwt@4.0.1"
    - "jwks-rsa@4.1.0"
    - "jsonwebtoken@9.0.3"
    - "@types/passport-jwt@4.0.1"
    - "@types/passport@1.0.17"
    - "@types/jsonwebtoken@9.0.10"
  patterns:
    - Abstract-class-as-DI-token (TokenValidator follows IAuditContextProvider pattern)
    - SetMetadata key+factory pattern (Public/IS_PUBLIC_KEY follows RAW_RESPONSE_KEY pattern)
    - createParamDecorator (GetCurrentUser — first instance in codebase)
    - Zod .superRefine() production-guard chain
key_files:
  created:
    - packages/backend/src/auth/current-user.type.ts
    - packages/backend/src/auth/token-validator.ts
    - packages/backend/src/auth/decorators/public.decorator.ts
    - packages/backend/src/auth/decorators/current-user.decorator.ts
  modified:
    - packages/backend/src/config/env.schema.ts
    - packages/backend/src/config/env.schema.spec.ts
    - packages/backend/package.json
    - package-lock.json
decisions:
  - "Used string literal 'custom' (not z.ZodIssueCode.custom) in superRefine — RESEARCH.md flagged ZodIssueCode as ASSUMED in Zod v4"
  - "IS_PUBLIC_KEY exported from public.decorator.ts (guard imports constant, not magic string)"
  - "GetCurrentUser named to avoid shadowing CurrentUser type at call sites"
metrics:
  duration: "7 minutes"
  completed_date: "2026-07-02"
  tasks_completed: 3
  files_created: 4
  files_modified: 4
---

# Phase 04 Plan 01: Auth Infrastructure Dependencies and Type Contracts Summary

**One-liner:** Installed 8 auth packages (passport/jwt/jwks-rsa), extended Zod env schema with AUTH_MODE enum and ENTRA_* fields guarded by a superRefine production-lock, and created the four seam-contract files (CurrentUser type, TokenValidator DI token, @Public() decorator, @GetCurrentUser() param decorator) that Plans 02 and 03 build against.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Install auth runtime and dev-type packages | 9577d04 | Done |
| 2 RED | Add failing tests for AUTH_MODE + ENTRA_* + superRefine | 9590405 | Done |
| 2 GREEN | Extend env.schema.ts (AUTH_MODE, ENTRA_*, superRefine) | 651b5ed | Done |
| 3 | Create type contract files in src/auth/ | 63a4cae | Done |

## Implementation Notes

### Task 1: Package Install
All 8 packages verified [OK] in RESEARCH.md Package Legitimacy Audit before execution. No slopcheck checkpoint required. Runtime packages: `@nestjs/passport`, `passport`, `passport-jwt`, `jwks-rsa`, `jsonwebtoken`. Dev-type packages: `@types/passport-jwt`, `@types/passport`, `@types/jsonwebtoken`.

### Task 2: Env Schema Extension (TDD)
Extended `z.object({})` in-place by adding `AUTH_MODE: z.enum(['stub', 'entra']).default('stub')` and three optional `ENTRA_*` string fields. Chained `.superRefine()` implementing two guards:
1. Production-lock (T-04-01 threat mitigation): rejects `NODE_ENV=production` + `AUTH_MODE=stub`
2. Entra completeness: rejects `AUTH_MODE=entra` when any of `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, or `ENTRA_AUDIENCE` is absent

Used `code: 'custom'` string literal (not `z.ZodIssueCode.custom`) per RESEARCH.md caution on Zod v4 enum stability.

Updated Test 1's `toEqual` expected object to include `AUTH_MODE: 'stub'` (the only full-equality test broken by the new default). Tests 2-10 and 7 use `.toBe()` on individual fields — unaffected.

TDD gate: RED phase (4 failing, 10 passing) → GREEN phase (14 passing).

### Task 3: Type Contract Files
Created four files following established codebase patterns:
- `current-user.type.ts`: claims-only interface (D-01, D-03) mapping oid→entraId, preferred_username→email, tid→tenantId, name→displayName
- `token-validator.ts`: abstract class (not interface) as NestJS DI token, following `IAuditContextProvider` convention exactly
- `decorators/public.decorator.ts`: IS_PUBLIC_KEY constant + Public factory, following `RAW_RESPONSE_KEY` pattern exactly
- `decorators/current-user.decorator.ts`: createParamDecorator reading `request.user ?? null`, named GetCurrentUser to avoid type-name collision

## Deviations from Plan

### Pre-existing Issues (out of scope)

**1. [Pre-existing] Dual rxjs version in workspace**
- **Found during:** Task 3 TypeScript verification
- **Issue:** Root `node_modules/rxjs@7.8.1` and `packages/backend/node_modules/rxjs@7.8.2` coexist, causing TypeScript cross-package type incompatibilities in pre-existing files (`audit.interceptor.ts`, `audit.interceptor.spec.ts`, `response-envelope.interceptor.ts`)
- **Confirmed:** Same errors present in main repo (pre-existing from Phase 3 backend setup)
- **Impact:** `npx tsc --noEmit` exits non-zero across the workspace; does NOT affect the four new auth files (zero errors in `src/auth/`)
- **Action:** Logged to `deferred-items.md`; out of scope for this plan

**2. [Pre-existing] ESLint errors in unrelated files**
- **Found during:** Task 2 lint verification
- **Files:** `global-exception.filter.ts` (unused `request` variable), `audit.interceptor.spec.ts` (stale eslint-disable)
- **Action:** Logged to `deferred-items.md`; out of scope for this plan

## Known Stubs

None. This plan creates type-contract files only — no data-fetching, rendering, or UI wiring that could be stubbed.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers. The superRefine production guard directly mitigates T-04-01 (elevation of privilege via stub mode in production).

## TDD Gate Compliance

- RED gate commit: `9590405` (test(04-01): add failing tests for AUTH_MODE + ENTRA_* + superRefine)
- GREEN gate commit: `651b5ed` (feat(04-01): extend env schema...)
- REFACTOR gate: Not required (no cleanup needed)

## Verification Results

```
grep superRefine packages/backend/src/config/env.schema.ts → MATCH
grep abstract class TokenValidator packages/backend/src/auth/ → MATCH
grep IS_PUBLIC_KEY packages/backend/src/auth/decorators/public.decorator.ts → MATCH
npm run test --workspace=packages/backend → 60 passed (10 test files)
tsc errors in src/auth/ files → 0 (new files compile clean)
```

## Self-Check: PASSED

- [x] `packages/backend/src/auth/current-user.type.ts` exists
- [x] `packages/backend/src/auth/token-validator.ts` exists
- [x] `packages/backend/src/auth/decorators/public.decorator.ts` exists
- [x] `packages/backend/src/auth/decorators/current-user.decorator.ts` exists
- [x] `packages/backend/src/config/env.schema.ts` has superRefine
- [x] Commit `9577d04` exists (Task 1)
- [x] Commit `9590405` exists (Task 2 RED)
- [x] Commit `651b5ed` exists (Task 2 GREEN)
- [x] Commit `63a4cae` exists (Task 3)
- [x] All 60 backend tests pass
