---
phase: 04
slug: authentication-entra-id-infrastructure
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-01
updated: 2026-07-01
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (SWC) |
| **Config file** | `packages/backend/vitest.config.ts` (inherited from Phase 1) |
| **Quick run command** | `npm run test --workspace=packages/backend` |
| **Full suite command** | `npm run test --workspace=packages/backend` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=packages/backend`
- **After every plan wave:** Run `npm run test --workspace=packages/backend`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Task IDs: `04-NN-TM` = Plan 04-NN, Task M

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-02-T1 | 04-02 | 2 | AUTH-01 | T-04-02, T-04-04 | `EntraTokenValidator.validate()` returns `CurrentUser` for a valid RS256 JWT with correct claims | unit | `npm run test --workspace=packages/backend` | ❌ W0 (04-03-T1 creates spec) | ⬜ pending |
| 04-03-T1 | 04-03 | 3 | AUTH-01 | T-04-02 | `EntraTokenValidator.validate()` throws `UnauthorizedException` for tampered/expired/HS256 token | unit | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-01 | T-04-07 | Protected endpoint returns 401 when `Authorization` header is missing and `X-Dev-User` is absent | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | AUTH-02 | — | No `passport-azure-ad` import anywhere in `src/` (never imported in EntraTokenValidator or any auth file) | static | `grep -r "passport-azure-ad" packages/backend/src && exit 1 \|\| exit 0` | ✅ (static check on new files) | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-02 | — | Static integration test confirms `grep -r "passport-azure-ad"` returns no matches (execSync throws on non-zero exit) | static | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-01-T3 | 04-01 | 1 | AUTH-03 | — | `IS_PUBLIC_KEY` constant and `Public()` decorator factory exported from `decorators/public.decorator.ts` | static | `npx tsc --noEmit -p packages/backend/tsconfig.json` | ❌ W0 (04-01-T3 creates file) | ⬜ pending |
| 04-02-T2 | 04-02 | 2 | AUTH-03 | T-04-07 | `@Public()` class-level decorator on `HealthController`; guard's `Reflector.getAllAndOverride` skips validation | unit/integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-03 | T-04-07 | `GET /api/v1/auth-test/public` returns 200 without any `Authorization` header | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-03 | T-04-07 | Non-`@Public()` route returns 401 with no `Authorization` header | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-04 | — | `@GetCurrentUser()` in a handler resolves the correct principal from a stub token — `body.data.user.email === 'user@test.com'` | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | AUTH-05 | T-04-03 | `StubTokenValidator.validate()` returns `CurrentUser { entraId: 'stub-${email}', tenantId: 'stub-tenant' }` when `rawToken` is a valid email string | unit | `npm run test --workspace=packages/backend` | ❌ W0 (04-03-T1 creates spec) | ⬜ pending |
| 04-03-T2 | 04-03 | 3 | AUTH-05 | T-04-03 | `AUTH_MODE=stub` + `X-Dev-User: user@test.com` header returns 200 and resolves `CurrentUser.email === 'user@test.com'` | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | AUTH-05 | T-04-01 | `AUTH_MODE=stub` AND `NODE_ENV=production` causes `envSchema.parse()` to throw `ZodError` at startup | unit | `npm run test --workspace=packages/backend` | ✅ (env.schema.spec.ts exists; Test 14 added in 04-01-T2) | ⬜ pending |
| 04-03-T1 | 04-03 | 3 | AUTH-05 | T-04-01 | env.schema.spec.ts Test 14: `AUTH_MODE=stub` + `NODE_ENV=production` → `ZodError` thrown | unit | `npm run test --workspace=packages/backend` | ✅ (extended in 04-01-T2; re-run in 04-03-T1) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Files that must be CREATED as part of execution (spec file creation is in Plan 04-03 Task 1 and Task 2):

- [x] `packages/backend/src/auth/jwt-auth.guard.spec.ts` — created in 04-03-T1 (guard public/protected routing, AUTH-01, AUTH-03)
- [x] `packages/backend/src/auth/entra-token-validator.spec.ts` — created in 04-03-T1 (local RSA keypair + mocked JwksClient, AUTH-01)
- [x] `packages/backend/src/auth/stub-token-validator.spec.ts` — created in 04-03-T1 (X-Dev-User header processing, AUTH-05)
- [x] `packages/backend/src/config/env.schema.spec.ts` — EXTEND in 04-01-T2 and 04-03-T1: Tests 11-14 covering AUTH_MODE + NODE_ENV=production superRefine fail-fast (AUTH-05)
- [x] `packages/backend/src/app.integration.spec.ts` — EXTEND in 04-03-T2: Phase 4 auth integration cases (AUTH-01, AUTH-03, AUTH-04, AUTH-05)

Note: env.schema.spec.ts already exists from Phase 3. Tests 11-14 are added in Plan 04-01 Task 2
(schema tests must be written when the schema is extended) and re-verified in Plan 04-03 Task 1.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Entra tenant SSO / real JWKS validation (`AUTH_MODE=entra`) | AUTH-01 | No live tenant available; explicitly out of scope this milestone (RT-05) | Deferred to future milestone — verify against a real tenant with a real bearer token |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task runs npm test)
- [x] Wave 0 covers all MISSING references (all spec files created in 04-03; schema spec extended in 04-01)
- [x] No watch-mode flags (`vitest run` not `vitest watch`)
- [x] Feedback latency < 30s (estimated ~15s per RESEARCH.md)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
