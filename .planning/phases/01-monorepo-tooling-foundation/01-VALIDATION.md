---
phase: 1
slug: monorepo-tooling-foundation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-29
updated: 2026-06-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `packages/backend/vitest.config.ts` (created in Plan 03 — Wave 0 gap) |
| **Quick run command** | `cd packages/backend && npx vitest run --reporter=verbose` |
| **Full suite command** | `npx turbo run lint typecheck test build && npm run format:check` |
| **Estimated runtime** | ~15 seconds (trivial SWC-compiled test + nest build) |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/backend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx turbo run lint typecheck test build && npm run format:check`
- **Before `/gsd:verify-work`:** Full suite must be green + manual TOOL-06 and TOOL-07 checks
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | TOOL-06 | T-01-01, T-01-03 | .env gitignored; .env.example has placeholders only | git + filesystem | `git check-ignore packages/database/.env && test -f packages/database/.env.example` | N/A | ⬜ pending |
| 01-01-T2 | 01 | 1 | TOOL-06 | T-01-02 | Live credential rotated; old password invalid | manual (Supabase dashboard) | N/A — human checkpoint | N/A | ⬜ pending |
| 01-02-T1 | 02 | 2 | TOOL-01, TOOL-07 | T-02-SC | Package legitimacy approved before install | manual (package review) | N/A — human checkpoint | N/A | ⬜ pending |
| 01-02-T2 | 02 | 2 | TOOL-01 | T-02-SC | Workspace symlink created; nextjs stub removed | npm workspace verify | `npm ls @repo/database && ls node_modules/@repo/database` | N/A | ⬜ pending |
| 01-02-T3 | 02 | 2 | TOOL-02, TOOL-03, TOOL-07 | T-02-02 | Strict TS; no experimentalDecorators in base; ESLint 9 passes | lint + typecheck | `npx turbo run lint typecheck && npm run format:check` | ❌ Wave 0 | ⬜ pending |
| 01-03-T1 | 03 | 3 | TOOL-04, TOOL-05 | T-03-03 | packages/backend workspace member; @repo/database resolves; SWC peer deps present | npm workspace verify | `npm ls @repo/database -w @repo/backend && ls node_modules/@swc/cli` | ❌ Wave 0 | ⬜ pending |
| 01-03-T2 | 03 | 3 | TOOL-04, TOOL-05 | T-03-01, T-03-02 | Sample test passes; nest build exits 0; CI workflow exists with no secrets | vitest + turbo build | `cd packages/backend && npx vitest run && cd /Users/amish/AI_SDLC && npx turbo run build` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following files do not exist yet and must be created during execution before their corresponding automated verify commands can run:

- [ ] `packages/backend/vitest.config.ts` — Vitest + SWC config (required for `vitest run`; covers TOOL-04)
- [ ] `packages/backend/src/index.spec.ts` — Sample test dynamic import of @repo/database (covers TOOL-01, TOOL-04)
- [ ] `packages/backend/src/index.ts` — Barrel re-export (covers TOOL-05 proof of compilation)
- [ ] `tsconfig.base.json` — Shared strict TypeScript base (required for `tsc --noEmit`; covers TOOL-02)
- [ ] `eslint.config.mjs` — ESLint 9 flat config (required for `eslint`; covers TOOL-03)
- [ ] `.nvmrc` — Node version pin (covers TOOL-07)
- [ ] `turbo.json` — Task orchestration graph (required for `turbo run`; covers all tasks)
- [ ] `packages/backend/nest-cli.json` — SWC builder (required for `nest build`; covers TOOL-05)
- [ ] `packages/backend/.swcrc` — SWC decorator config (required for Vitest + NestJS; covers TOOL-04)
- [ ] `packages/backend/package.json` — @repo/backend workspace member (covers TOOL-01, TOOL-05)
- [ ] `packages/database/tsconfig.json` — TS config for @repo/database (required for turbo typecheck across all packages)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Supabase credential rotated | TOOL-06 | Requires Supabase dashboard access — no CLI can rotate another project's password | See Plan 01 Task 2 checkpoint instructions — open Supabase dashboard, reset password, update packages/database/.env |
| Old DATABASE_URL credential no longer authenticates | TOOL-06 | Requires attempting a connection with the old credential | After rotation, attempt `psql $OLD_DATABASE_URL` — should fail with authentication error |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies documented
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `vitest run` not `vitest watch`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready 2026-06-29
