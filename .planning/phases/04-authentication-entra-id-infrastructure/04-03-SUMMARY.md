---
phase: 04-authentication-entra-id-infrastructure
plan: "03"
subsystem: backend/auth
tags: [auth, testing, vitest, jwt, entra-id, integration-tests, security]
dependency_graph:
  requires:
    - packages/backend/src/auth/entra-token-validator.ts
    - packages/backend/src/auth/stub-token-validator.ts
    - packages/backend/src/auth/jwt-auth.guard.ts
    - packages/backend/src/auth/decorators/public.decorator.ts
    - packages/backend/src/auth/decorators/current-user.decorator.ts
    - packages/backend/src/config/env.schema.ts (AUTH_MODE + ENTRA_* + superRefine)
  provides:
    - packages/backend/src/auth/jwt-auth.guard.spec.ts
    - packages/backend/src/auth/entra-token-validator.spec.ts (extended)
    - packages/backend/src/auth/stub-token-validator.spec.ts (extended)
    - packages/backend/src/app.integration.spec.ts (Phase 4 describe block)
  affects:
    - AUTH-01 through AUTH-05 requirements (all verified by automated tests)
tech_stack:
  added: []
  patterns:
    - buildMockContext factory pattern for NestJS ExecutionContext mocking
    - Local RSA keypair (generateKeyPairSync) for EntraTokenValidator JWT tests
    - AuthTestController test-only controller for CurrentUser resolution E2E
    - grep-based static import check (AUTH-02, excludes *.spec.ts)
    - process.cwd()+/src path for cross-CWD-safe grep command
key_files:
  created:
    - packages/backend/src/auth/jwt-auth.guard.spec.ts
  modified:
    - packages/backend/src/auth/entra-token-validator.spec.ts
    - packages/backend/src/auth/stub-token-validator.spec.ts
    - packages/backend/src/app.integration.spec.ts
decisions:
  - "AUTH-02 static grep uses --exclude=*.spec.ts to avoid the grep command finding 'passport-azure-ad' in the test file itself (self-reference trap)"
  - "AuthTestController GET /protected returns CurrentUser from @GetCurrentUser() wrapped by ResponseEnvelopeInterceptor so assertions use body.data.user (not body.user)"
  - "env.schema.spec.ts Tests 11-14 already present as A-D from Plan 02 — no changes needed; Plan 02 pre-executed this task as part of TDD GREEN phase"
  - "process.cwd()/src used in AUTH-02 grep (not __dirname) because ESM context makes __dirname unavailable, and process.cwd() resolves to packages/backend/ when npm workspace runs the test"
metrics:
  duration: "5 minutes"
  completed_date: "2026-07-02"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 04 Plan 03: Phase 4 Test Suite (Unit + Integration) Summary

**One-liner:** Created jwt-auth.guard.spec.ts (4 unit tests), extended entra-token-validator.spec.ts (+4 security tests for tampered payload/HS256/wrong-audience/missing-claims), extended stub-token-validator.spec.ts (+1 undefined rawToken test), and added a 6-test Phase 4 integration describe block with AuthTestController to verify CurrentUser resolution end-to-end; all 87 backend tests pass.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Create jwt-auth.guard.spec.ts; extend entra-token-validator.spec.ts (+4); extend stub-token-validator.spec.ts (+1) | 4c69776 | Done |
| 2 | Extend app.integration.spec.ts: AUTH_MODE env, AuthTestController, Phase 4 describe block (6 tests) | 8219276 | Done |

## Implementation Notes

### Task 1: Unit Test Specs

**jwt-auth.guard.spec.ts (new):**
Created `buildMockContext(headers)` factory returning both the `ExecutionContext` mock and the underlying `mockRequest` object for post-canActivate inspection. Four tests covering:
- @Public() bypass: `mockReflector.getAllAndOverride(true)` → returns true; `tokenValidator.validate` never called (D-07)
- Missing Authorization in entra mode: no `authorization` header → `AUTH.MISSING_TOKEN`
- Missing x-dev-user in stub mode: no `x-dev-user` header → `AUTH.MISSING_TOKEN`
- Successful stub auth: x-dev-user present → `canActivate` returns true; `request.user` set; `cls.set('user', user)` called

**entra-token-validator.spec.ts (extended):**
Added 4 tests building on the existing RSA keypair setup:
- Both preferred_username AND email absent → `AUTH.MISSING_REQUIRED_CLAIMS` (claim mapping validation)
- Tampered token (payload modified after signing) → `AUTH.TOKEN_INVALID` (signature mismatch; T-04-02 regression coverage)
- HS256 token → `AUTH.TOKEN_INVALID` (`algorithms:['RS256']` whitelist rejects; T-04-02)
- Wrong audience → `AUTH.TOKEN_INVALID` (jwt.verify audience check; T-04-04 cross-audience rejection)

**stub-token-validator.spec.ts (extended):**
Added test for `validate(undefined as unknown as string)` — falsy check ensures guard's missing X-Dev-User header path (rawToken=undefined) throws `AUTH.STUB_MISSING_DEV_USER_HEADER`.

**env.schema.spec.ts (no change):**
Tests 11-14 (AUTH_MODE default, entra completeness, stub-in-prod guard) were already added as Tests A-D by Plan 02 Task 2 GREEN phase. No changes required.

### Task 2: Integration Test Extension

**AuthTestController:**
Test-only controller at `path: 'auth-test', version: '1'` with two GET routes:
- `GET public`: `@Public()` — returns `{ status: 'ok', auth: false }` (no auth required)
- `GET protected`: no `@Public()` — returns `{ status: 'ok', user }` via `@GetCurrentUser()` param decorator

Responses are wrapped by `ResponseEnvelopeInterceptor` (APP_INTERCEPTOR from AppModule): `{ success: true, data: { status, user }, meta: null, traceId }`.

**Phase 4 Authentication (AUTH-01..AUTH-05) describe block:**
6 tests in a dedicated `phase4App` instance with `AuthTestController` registered. Tests A-F cover all five AUTH requirements:
- (A) AUTH-03: public route accessible without Authorization (200)
- (B) AUTH-01+AUTH-03: protected route 401 when no credentials
- (C) AUTH-05: X-Dev-User header produces correct stub identity (email, entraId=`stub-${email}`, tenantId='stub-tenant')
- (D) AUTH-04: @GetCurrentUser() resolves full CurrentUser interface (entraId, email, tenantId properties present)
- (E) AUTH-01+AUTH-03: GET /api/v1/health/liveness → 200 without auth (HealthController @Public() class-level)
- (F) AUTH-02: static grep for 'passport-azure-ad' in src/*.ts (excl. *.spec.ts) exits 1 → execSync throws

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AUTH-02 static grep found 'passport-azure-ad' in the test file itself**
- **Found during:** Task 2 first test run — test (F) failed with "expected function to throw" because execSync did NOT throw
- **Issue:** The grep command `grep -r "passport-azure-ad" "${srcPath}"` found the string in `app.integration.spec.ts` itself (test name and command text contain the string). Grep exits 0 (matches found) so execSync does not throw.
- **Fix:** Added `--include="*.ts" --exclude="*.spec.ts"` flags to restrict search to production source files only
- **Files modified:** `packages/backend/src/app.integration.spec.ts`
- **Commit:** 8219276

### Pre-existing Issues (out of scope)

**1. [Pre-existing] ESLint errors in global-exception.filter.ts and audit.interceptor.spec.ts**
- Same pre-existing lint errors documented in Plans 01 and 02 SUMMARY. Out of scope.
- `npm run lint` exits 1 due to these pre-existing errors; `npm run test` exits 0.

**2. [Pre-existing] env.schema.spec.ts Test numbering mismatch**
- Plan 03 specified Tests 11-14 but Plan 02 already added them as Tests A-D. The test content is equivalent; only the naming differs. No action taken (tests already provide the required coverage).

## Known Stubs

None. All spec files contain real test assertions against real (or properly mocked) implementations. No placeholders or TODO comments in the new/modified test code.

## Threat Flags

No new security surface introduced. This plan is test-only. The threat model mitigations T-04-06, T-04-07, and T-04-08 from Plan 03's threat register are now verified by automated tests:
- T-04-06: entra-token-validator.spec.ts tests (E) and (F) verify tampered and HS256 tokens rejected
- T-04-07: integration test (B) verifies 401 on protected route; test (F) env schema Test D verifies stub-in-prod rejected
- T-04-08: entra-token-validator.spec.ts test (H) verifies wrong audience rejected

## Verification Results

```
npm run test --workspace=packages/backend
  Test Files  13 passed (13)
  Tests  87 passed (87)

grep -c "AUTH_MODE" packages/backend/src/app.integration.spec.ts → 7 (matches)
grep -r "passport-azure-ad" packages/backend/src --include="*.ts" --exclude="*.spec.ts" → (empty)
grep -c "Phase 4 Authentication" packages/backend/src/app.integration.spec.ts → 4 (matches)
```

## Self-Check: PASSED

- [x] `packages/backend/src/auth/jwt-auth.guard.spec.ts` exists
- [x] `packages/backend/src/auth/entra-token-validator.spec.ts` extended with 4 security tests
- [x] `packages/backend/src/auth/stub-token-validator.spec.ts` extended with undefined rawToken test
- [x] `packages/backend/src/app.integration.spec.ts` has AUTH_MODE env + AuthTestController + Phase 4 describe
- [x] Commit `4c69776` exists (Task 1)
- [x] Commit `8219276` exists (Task 2)
- [x] All 87 backend tests pass (13 test files)
- [x] All 9 AUTH-01..AUTH-05 behaviors covered by automated assertions
- [x] No existing Phase 3 tests regressed
