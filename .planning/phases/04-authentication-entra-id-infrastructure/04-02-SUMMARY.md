---
phase: 04-authentication-entra-id-infrastructure
plan: "02"
subsystem: backend/auth
tags: [auth, entra-id, jwt, jwks-rsa, nestjs, guard, di-tokens]
dependency_graph:
  requires:
    - packages/backend/src/auth/current-user.type.ts
    - packages/backend/src/auth/token-validator.ts
    - packages/backend/src/auth/decorators/public.decorator.ts
    - packages/backend/src/config/env.schema.ts (AUTH_MODE + ENTRA_* + superRefine)
  provides:
    - packages/backend/src/auth/entra-token-validator.ts
    - packages/backend/src/auth/stub-token-validator.ts
    - packages/backend/src/auth/auth-audit-context-provider.ts
    - packages/backend/src/auth/auth.module.ts
    - packages/backend/src/auth/jwt-auth.guard.ts
    - packages/backend/src/app.module.ts (AuthModule import, JwtAuthGuard APP_GUARD, AuthAuditContextProvider)
    - packages/backend/src/health/health.controller.ts (@Public() class decorator)
  affects:
    - packages/backend/src/app.integration.spec.ts
    - packages/backend/src/common/exceptions/error-codes.ts
    - packages/backend/src/common/exceptions/global-exception.filter.ts
    - packages/backend/vitest.config.ts
tech_stack:
  added: []
  patterns:
    - JwksClient from jwks-rsa with 10-min cache (T-04-02 alg whitelist, T-04-04 issuer+audience)
    - jwt.verify with algorithms:['RS256'] (algorithm confusion prevention)
    - preferred_username??email claim mapping (v2.0 upn-free, D-03 correction)
    - Custom CanActivate guard (not AuthGuard) with TokenValidator DI seam
    - vi.hoisted + plain class mock pattern for ES module mocking in Vitest v4
key_files:
  created:
    - packages/backend/src/auth/entra-token-validator.ts
    - packages/backend/src/auth/stub-token-validator.ts
    - packages/backend/src/auth/auth-audit-context-provider.ts
    - packages/backend/src/auth/auth.module.ts
    - packages/backend/src/auth/jwt-auth.guard.ts
    - packages/backend/src/auth/entra-token-validator.spec.ts
    - packages/backend/src/auth/stub-token-validator.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/health/health.controller.ts
    - packages/backend/src/app.integration.spec.ts
    - packages/backend/src/common/exceptions/error-codes.ts
    - packages/backend/src/common/exceptions/global-exception.filter.ts
    - packages/backend/vitest.config.ts
decisions:
  - "Used vi.hoisted + plain class constructor (not vi.fn().mockImplementation) for jwks-rsa mock — vi.fn() inside vi.mock factory is not supported in Vitest v4"
  - "Added PLATFORM.UNAUTHORIZED error code and 401→UNAUTHORIZED mapping to GlobalExceptionFilter (Rule 2: 401 auth errors need proper errorCode, not INTERNAL_ERROR)"
  - "Added X-Dev-User header to Phase 3 Test E in integration tests (Rule 1: Phase 3 test broke when JwtAuthGuard was wired to protected TestController endpoint)"
  - "Added explicit AUTH_MODE=stub to vitest.config.ts env for clarity (default behavior unchanged)"
  - "Headers typed as Record<string, string | string[] | undefined> in guard to match Express IncomingHttpHeaders (not DOM Request.Headers)"
metrics:
  duration: "~11 minutes"
  completed_date: "2026-07-02"
  tasks_completed: 2
  files_created: 7
  files_modified: 6
---

# Phase 04 Plan 02: Auth Service Classes and Guard Wiring Summary

**One-liner:** Implemented EntraTokenValidator (JwksClient + RS256 jwt.verify + preferred_username??email), StubTokenValidator (X-Dev-User header), AuthAuditContextProvider (null until Phase 6), JwtAuthGuard (pure CanActivate, IS_PUBLIC_KEY reflector, AUTH_MODE branch, cls.set), AuthModule (conditional useFactory), and wired everything into AppModule with HealthController @Public(); all 72 backend tests pass.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 RED | Add failing unit tests for EntraTokenValidator + StubTokenValidator | 42c379f | Done |
| 1 GREEN | Implement EntraTokenValidator, StubTokenValidator, AuthAuditContextProvider, AuthModule, stub JwtAuthGuard | 4b840d5 | Done |
| 2 | Real JwtAuthGuard + AppModule wiring + HealthController @Public() + integration tests | 3b41380 | Done |

## Implementation Notes

### Task 1 RED Phase

Created `entra-token-validator.spec.ts` and `stub-token-validator.spec.ts`. Both fail with `ERR_MODULE_NOT_FOUND` because the implementation files don't exist yet (9 tests = pure RED state, all 60 prior tests still passing).

Key discovery: `vi.fn().mockImplementation()` inside `vi.mock` factory throws `is not a constructor` in Vitest v4 because `vi.fn()` is not available in the hoisted factory context. Fixed by using `vi.hoisted()` to create the mock function and then referencing it from a plain class in the factory.

### Task 1 GREEN Phase

**EntraTokenValidator** (`entra-token-validator.ts`):
- 4-step validate(): decode header → getSigningKey → jwt.verify → claim mapping
- `algorithms: ['RS256']` whitelist (T-04-02: prevents alg:none confusion attack)
- `issuer` and `audience` validation in jwt.verify (T-04-04: cross-tenant rejection)
- `preferred_username ?? email` — no `upn` lookup (D-03 correction; upn is v1.0-only)
- Raw token, public key, and payload never logged (T-04-05)
- JwksClient cache: 10-min TTL, 5 entries, 5 req/min rate limit

**StubTokenValidator** (`stub-token-validator.ts`):
- Reads rawToken directly (guard passes X-Dev-User header value in stub mode)
- `entraId: 'stub-${email}'` prefix ensures stub identity is distinguishable
- Empty rawToken → `AUTH.STUB_MISSING_DEV_USER_HEADER`

**AuthAuditContextProvider** (`auth-audit-context-provider.ts`):
- Extends IAuditContextProvider, injects ClsService
- `getContext()` returns null (D-04: no organizationId until Phase 6)
- AuditInterceptor skips writes when getContext returns null (pre-existing behavior preserved)

**AuthModule** (`auth.module.ts`):
- Imports ONLY `AppConfigModule` and `PassportModule` (D-08: no cyclic DI risk)
- `useFactory` conditional: entra mode → new EntraTokenValidator(config), else → new StubTokenValidator()
- Exports TokenValidator, JwtAuthGuard, AuthAuditContextProvider

**JwtAuthGuard stub** (`jwt-auth.guard.ts`):
- Minimal compilable stub (`implements CanActivate { canActivate(): boolean { return true } }`)
- Replaced by real implementation in Task 2

### Task 2

**JwtAuthGuard** (real implementation):
- Pure CanActivate (NOT extends AuthGuard — avoids passport pipeline coupling)
- `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` — class-level @Public() supported
- AUTH_MODE branch: stub reads `x-dev-user` header; entra uses `ExtractJwt.fromAuthHeaderAsBearerToken()`
- Headers typed as `Record<string, string | string[] | undefined>` to match Express IncomingHttpHeaders
- No try/catch — UnauthorizedException propagates to GlobalExceptionFilter (correct error envelope)
- `cls.set('user', currentUser)` stores principal for AuthAuditContextProvider consumers

**AppModule changes** (surgical edits):
- Added `AuthModule` to imports (after HealthModule)
- Added `{ provide: APP_GUARD, useClass: JwtAuthGuard }` AFTER ThrottlerGuard (D-09 order)
- Replaced `NoOpAuditContextProvider` with `AuthAuditContextProvider` for IAuditContextProvider token

**HealthController**:
- Added `@Public()` at class level (D-10) — both liveness and readiness bypass JwtAuthGuard
- `import { Public }` from `../auth/decorators/public.decorator`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.fn() inside vi.mock factory not a constructor in Vitest v4**
- **Found during:** Task 1 RED → first GREEN run
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` inside vi.mock factory caused `TypeError: is not a constructor`. In Vitest v4, vi.fn() is not available in the hoisted factory context.
- **Fix:** Created mock function via `vi.hoisted(() => ({ mockGetSigningKey: vi.fn() }))`, then used a plain class (not vi.fn) in vi.mock factory that assigns the hoisted function as an instance property.
- **Files modified:** `packages/backend/src/auth/entra-token-validator.spec.ts`
- **Commit:** 4b840d5 (spec file updated)

**2. [Rule 2 - Missing Functionality] 401 responses returned PLATFORM.INTERNAL_ERROR**
- **Found during:** Task 2 integration test (Test I)
- **Issue:** GlobalExceptionFilter did not map HTTP 401 → error code. UnauthorizedException (401) fell through to the INTERNAL_ERROR fallback, producing misleading errorCode in the response envelope.
- **Fix:** Added `UNAUTHORIZED: 'PLATFORM.UNAUTHORIZED'` to error-codes.ts and mapped `HttpStatus.UNAUTHORIZED` in GlobalExceptionFilter's HTTP_STATUS_TO_ERROR_CODE table.
- **Files modified:** `packages/backend/src/common/exceptions/error-codes.ts`, `packages/backend/src/common/exceptions/global-exception.filter.ts`
- **Commit:** 3b41380

**3. [Rule 1 - Bug] Phase 3 Test E (ValidationPipe) would fail after guard wires**
- **Found during:** Task 2 implementation analysis
- **Issue:** `POST /api/v1/test/echo` in Phase 3 integration tests would receive 401 (JwtAuthGuard blocks unauthenticated requests to TestController which has no @Public()). Test E expected 400 and 201.
- **Fix:** Added `.set('x-dev-user', 'test@example.com')` to both POST requests in Test E. Added comment explaining Auth_MODE=stub requirement.
- **Files modified:** `packages/backend/src/app.integration.spec.ts`
- **Commit:** 3b41380

**4. [Rule 2 - Missing Functionality] TypeScript type error in guard request headers access**
- **Found during:** Task 2 tsc check
- **Issue:** `(request.headers as Record<string, string>)['x-dev-user']` failed because DOM `Request.headers` type (`Headers`) doesn't overlap with `Record<string, string>`.
- **Fix:** Changed `getRequest` type parameter to `{ headers: Record<string, string | string[] | undefined>; user?: CurrentUser }` (matching Express IncomingHttpHeaders structure). Added array handling for `x-dev-user` header value.
- **Files modified:** `packages/backend/src/auth/jwt-auth.guard.ts`
- **Commit:** 3b41380

**5. [Rule 2 - Missing Functionality] Phase 4 integration tests added**
- **Found during:** Task 2 integration review
- **Context:** RESEARCH.md Validation Architecture specified extending `app.integration.spec.ts` with Phase 4 auth cases. Tests H/I/J cover AUTH-01 (protected → 401), AUTH-03 (@Public() → 200), AUTH-05 (stub X-Dev-User → 200).
- **Files modified:** `packages/backend/src/app.integration.spec.ts`
- **Commit:** 3b41380

## Known Stubs

None. All files have real implementations:
- `entra-token-validator.ts` — real JWKS + jwt.verify
- `stub-token-validator.ts` — real stub (intentional for dev mode)
- `auth-audit-context-provider.ts` — returns null intentionally per D-04; Phase 6 will complete
- `jwt-auth.guard.ts` — real guard replacing Task 1 stub

## Threat Flags

No new security surface beyond what the plan's threat model covers:
- No new HTTP endpoints introduced (guard is middleware, not a controller)
- JwtAuthGuard is global — all existing and future routes are protected by default
- HealthController @Public() is the only route explicitly whitelisted

## TDD Gate Compliance

- RED gate commit: `42c379f` (test(04-02): add failing unit tests for EntraTokenValidator and StubTokenValidator)
- GREEN gate commit: `4b840d5` (feat(04-02): implement EntraTokenValidator, StubTokenValidator, AuthAuditContextProvider, AuthModule)
- REFACTOR gate: Not required (no cleanup needed)

## Verification Results

```
grep 'algorithms:' packages/backend/src/auth/entra-token-validator.ts → algorithms: ['RS256']
grep preferred_username packages/backend/src/auth/entra-token-validator.ts → MATCH
grep "payload\['upn'\]" packages/backend/src/auth/entra-token-validator.ts → (empty — not used as claim)
grep APP_GUARD packages/backend/src/app.module.ts → ThrottlerGuard THEN JwtAuthGuard (D-09 order)
grep @Public packages/backend/src/health/health.controller.ts → MATCH
grep -r passport-azure-ad packages/backend/src → (empty — AUTH-02 satisfied)
npx tsc --noEmit → exits 0
npm run test --workspace=packages/backend → 72 passed (12 test files)
```

## Self-Check: PASSED

- [x] `packages/backend/src/auth/entra-token-validator.ts` exists
- [x] `packages/backend/src/auth/stub-token-validator.ts` exists
- [x] `packages/backend/src/auth/auth-audit-context-provider.ts` exists
- [x] `packages/backend/src/auth/auth.module.ts` exists
- [x] `packages/backend/src/auth/jwt-auth.guard.ts` exists (real implementation)
- [x] `packages/backend/src/health/health.controller.ts` has @Public()
- [x] `packages/backend/src/app.module.ts` has two APP_GUARD entries (ThrottlerGuard + JwtAuthGuard)
- [x] `packages/backend/src/common/exceptions/error-codes.ts` has UNAUTHORIZED
- [x] Commit `42c379f` exists (Task 1 RED)
- [x] Commit `4b840d5` exists (Task 1 GREEN)
- [x] Commit `3b41380` exists (Task 2)
- [x] All 72 backend tests pass
- [x] TypeScript compiles clean (0 errors)
