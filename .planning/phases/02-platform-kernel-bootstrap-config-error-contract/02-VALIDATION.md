---
phase: 02
slug: platform-kernel-bootstrap-config-error-contract
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-30
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 with SWC (via `unplugin-swc`) |
| **Config file** | `packages/backend/vitest.config.ts` (already present from Phase 1) |
| **Quick run command** | `npm run test --workspace packages/backend` |
| **Full suite command** | `npx turbo run lint typecheck test build` |
| **Estimated runtime** | ~10 seconds (quick), ~60 seconds (full pipeline) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace packages/backend`
- **After every plan wave:** Run `npx turbo run lint typecheck test build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | — | T-02-SC | Six packages verified as legitimate before any install runs | manual | — (checkpoint:human-verify; gate=blocking-human) | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | INFRA-01, INFRA-02, INFRA-14 | T-02-01 | entryFile "main" set; runtime + dev deps installed; nest build succeeds | build | `grep '"entryFile": "main"' packages/backend/nest-cli.json && npm run build --workspace packages/backend` | N/A | ⬜ pending |
| 02-02-01 | 02 | 2 | INFRA-03 | T-02-03 | ESLint bans process.env in all *.ts files outside config/ and outside *.spec.ts; config/ and *.spec.ts escape hatches allow it | lint | `grep -v '^#' eslint.config.mjs \| grep -c "no-restricted-properties" && npm run lint` | N/A | ⬜ pending |
| 02-02-02 | 02 | 2 | INFRA-02 | T-02-02, T-02-04 | envSchema.parse throws ZodError on missing/invalid env vars; PORT coerces "3000" → 3000 | unit | `npm run test --workspace packages/backend` | ❌ W0 (TDD inline) | ⬜ pending |
| 02-03-01 | 03 | 3 | INFRA-05 | T-02-05, T-02-08 | GlobalExceptionFilter returns { success, errorCode, message, traceId }; suppresses stack in production | unit | `npm run test --workspace packages/backend` | ❌ W0 (TDD inline) | ⬜ pending |
| 02-03-02 | 03 | 3 | INFRA-06, INFRA-14 | T-02-06, T-02-07 | P2002→409, P2025→404, unknown→500; exception.meta never forwarded; Prisma imported via @repo/database | unit | `npm run test --workspace packages/backend` | ❌ W0 (TDD inline) | ⬜ pending |
| 02-04-01 | 04 | 4 | INFRA-01, INFRA-14 | T-02-11 | setGlobalPrefix before enableVersioning in main.ts; no new PrismaClient instantiation in backend | build + typecheck | `npm run build --workspace packages/backend && npx tsc --noEmit --project packages/backend/tsconfig.json` | N/A | ⬜ pending |
| 02-04-02 | 04 | 4 | INFRA-01, INFRA-05 | T-02-09, T-02-10 | GET /api/v1/nonexistent → 404 envelope; body.traceId is v4 UUID (not 'unknown') — proves CorrelationIdMiddleware ran before GlobalExceptionFilter | integration | `npm run test --workspace packages/backend` | ❌ W0 (created in plan 02-04) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 test files are created inline via TDD tasks within the plan that implements each feature — no separate Wave 0 plan is required.

- [x] `packages/backend/src/config/env.schema.spec.ts` — covers INFRA-02 (created in Plan 02-02, Task 2 via TDD red-green cycle)
- [x] `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` — covers INFRA-05 (created in Plan 02-03, Task 1 via TDD red-green cycle)
- [x] `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` — covers INFRA-06 (created in Plan 02-03, Task 2 via TDD red-green cycle)
- [x] `packages/backend/src/app.integration.spec.ts` — covers INFRA-01 + INFRA-05 integration proof (created in Plan 02-04, Task 2)
- [x] `eslint.config.mjs` no-restricted-properties rule — covers INFRA-03 (added in Plan 02-02, Task 1; verified by `npm run lint`)

Existing infrastructure (Vitest 4 + SWC in `packages/backend/vitest.config.ts`) covers all phase requirements — no new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Six npm packages verified as legitimate before install | T-02-SC | slopcheck unavailable at research time; all packages tagged [ASSUMED]; supply-chain risk requires human sign-off | Visit each package URL on npmjs.com (listed in Plan 02-01, Task 1). Confirm publisher, download history (>100k/wk), and no suspicious postinstall scripts for all six packages before typing "verified" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are covered by Wave 0 TDD tasks (Nyquist compliant)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (tasks 02-01-01 is manual; 02-01-02 has build; 02-02-01 has lint — no gap of 3)
- [x] Wave 0 covers all MISSING references (all test files created inline via TDD tasks during execution)
- [x] No watch-mode flags in any automated command
- [x] Feedback latency: ~10s (quick run), ~60s (full pipeline) — within acceptable bounds
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
