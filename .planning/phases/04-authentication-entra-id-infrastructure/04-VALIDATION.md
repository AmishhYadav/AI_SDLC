---
phase: 04
slug: authentication-entra-id-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
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

> Planner fills task IDs (wave/plan) against these requirement-level behaviors during planning.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | AUTH-01 | T-04 (missing token → 401) | Protected route rejects missing/invalid JWT with 401 | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-01 | T-04 | `EntraTokenValidator.validate()` returns `CurrentUser` for a valid RS256 JWT | unit | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-01 | T-04 (alg confusion / tamper) | `EntraTokenValidator.validate()` throws `UnauthorizedException` for tampered/expired token | unit | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-02 | — | No `passport-azure-ad` import anywhere in `src/auth/` | static | `grep -r "passport-azure-ad" packages/backend/src && exit 1 \|\| exit 0` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-03 | — | `@Public()` route returns 200 with no `Authorization` header | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-03 | T-04 | Non-`@Public()` route returns 401 with no `Authorization` header | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-04 | — | `@CurrentUser()` resolves the correct principal from a stub token | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-05 | T-04 (stub exposure) | `AUTH_MODE=stub` + `X-Dev-User` header returns 200 and resolves `CurrentUser.email` | integration | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-05 | T-04 (stub in prod) | `AUTH_MODE=stub` AND `NODE_ENV=production` causes Zod to throw at startup | unit | `npm run test --workspace=packages/backend` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/auth/jwt-auth.guard.spec.ts` — guard public/protected routing (AUTH-01, AUTH-03)
- [ ] `packages/backend/src/auth/entra-token-validator.spec.ts` — local RSA keypair + mocked `JwksClient` (AUTH-01)
- [ ] `packages/backend/src/auth/stub-token-validator.spec.ts` — `X-Dev-User` header processing (AUTH-05)
- [ ] `packages/backend/src/config/env.schema.spec.ts` — EXTEND: `AUTH_MODE` + `NODE_ENV=production` superRefine fail-fast (AUTH-05)
- [ ] `packages/backend/src/app.integration.spec.ts` — EXTEND: Phase 4 auth integration cases (AUTH-03, AUTH-04, AUTH-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Entra tenant SSO / real JWKS validation (`AUTH_MODE=entra`) | AUTH-01 | No live tenant available; explicitly out of scope this milestone (RT-05) | Deferred to future milestone — verify against a real tenant with a real bearer token |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
