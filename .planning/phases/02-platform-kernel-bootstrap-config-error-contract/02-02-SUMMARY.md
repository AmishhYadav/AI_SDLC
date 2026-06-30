---
phase: 02-platform-kernel-bootstrap-config-error-contract
plan: 02
subsystem: infra
tags: [nestjs, zod, eslint, config, typed-config, process-env-ban]

# Dependency graph
requires:
  - phase: 02-01
    provides: "@nestjs/config and zod installed in @repo/backend; ESLint 9 flat config in place"
provides:
  - "eslint.config.mjs no-restricted-properties rule banning process.env in all *.ts files"
  - "packages/backend/src/config/env.schema.ts (Zod schema + Env type)"
  - "packages/backend/src/config/app-config.service.ts (AppConfigService with ConfigService<Env, true>)"
  - "packages/backend/src/config/config.module.ts (@Global AppConfigModule with envSchema.parse validate)"
  - "packages/backend/src/config/env.schema.spec.ts (6 unit tests, all passing)"
affects: [02-03, 02-04, all backend plans that need typed config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ESLint no-restricted-properties rule with file-glob escape hatch for config/ directory"
    - "Zod fail-fast validation via envSchema.parse() in ConfigModule.forRoot validate callback"
    - "ConfigService<Env, true> strict inference — Env[K] not Env[K] | undefined"
    - "z.coerce.number() for PORT — env vars are strings; coercion handles '3000' → 3000"

key-files:
  created:
    - "packages/backend/src/config/env.schema.ts — Zod schema (envSchema) + Env type alias"
    - "packages/backend/src/config/env.schema.spec.ts — 6 unit tests for fail-fast validation"
    - "packages/backend/src/config/app-config.service.ts — thin typed wrapper for ConfigService<Env, true>"
    - "packages/backend/src/config/config.module.ts — @Global() AppConfigModule with forRoot validate"
  modified:
    - "eslint.config.mjs — two new config objects for process.env ban and config/ escape hatch"

key-decisions:
  - "Used envSchema.parse(env) not safeParse() in the validate callback — safeParse does not throw and would allow invalid config to boot the app"
  - "ConfigService<Env, true> strict flag ensures get<K>() returns Env[K] not Env[K] | undefined — no null checks downstream"
  - "DATABASE_URL uses z.string().min(1) not z.string().url() — plan explicitly specifies min(1) to accept any non-empty string value"
  - "Inserted two ESLint rule objects BEFORE prettierConfig — prettierConfig remains the last item with a rules key"
  - "node_modules were absent in worktree context; ran bare npm install (no new packages) as Rule 3 auto-fix to restore declared dependencies from existing lockfile"

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 02 Plan 02: ESLint process.env Ban and Typed Fail-Fast Config Module Summary

**process.env lint ban added to ESLint flat config with config/ escape hatch (INFRA-03) and Zod-validated typed config module (AppConfigService, AppConfigModule, envSchema) created with fail-fast startup behaviour (INFRA-02) — all 6 unit tests pass, lint and typecheck clean.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-01T00:06:00Z
- **Completed:** 2026-06-30T18:40:18Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- ESLint 9 flat config updated with `no-restricted-properties` rule banning `process.env` in all `*.ts` files
- Escape hatch correctly disables the rule only for `packages/backend/src/config/**/*.ts`
- Spot-check confirmed: ESLint exits 1 with correct error message on unauthorized `process.env` usage outside config/
- `env.schema.ts`: Zod object with `NODE_ENV` enum, `PORT` coercion (string → number), `DATABASE_URL` min(1) guard
- `app-config.service.ts`: `AppConfigService` wrapping `ConfigService<Env, true>` — `get<K extends keyof Env>` with strict inference and `isProduction` getter
- `config.module.ts`: `@Global() @Module` importing `ConfigModule.forRoot({ isGlobal: true, validate: (env) => envSchema.parse(env) })` — throws `ZodError` on invalid env; NestJS exits non-zero before serving requests
- All 6 `env.schema.spec.ts` unit tests pass: PORT coercion, defaults, missing DATABASE_URL, PORT out-of-range, non-numeric PORT, empty DATABASE_URL
- `npm run lint` exits 0; `npx tsc --noEmit` exits 0; no `process.env` references in any of the four config files

## Task Commits

1. **Task 1 (INFRA-03): ESLint process.env ban** — `0700ba3`
   - `feat(02-02): add process.env lint ban with config/ escape hatch (INFRA-03)`

2. **Task 2 RED (TDD): failing envSchema unit tests** — `f3848fd`
   - `test(02-02): add failing envSchema unit tests — RED phase`

3. **Task 2 GREEN (TDD): config module source files** — `943512b`
   - `feat(02-02): implement typed fail-fast config module — GREEN phase (INFRA-02)`

## Files Created/Modified

- `eslint.config.mjs` — two new config objects inserted before `prettierConfig`: ban rule (`**/*.ts`) and escape hatch (`packages/backend/src/config/**/*.ts`)
- `packages/backend/src/config/env.schema.ts` — `envSchema` (ZodObject) + `Env` type alias
- `packages/backend/src/config/env.schema.spec.ts` — 6 Vitest unit tests covering all fail-fast scenarios
- `packages/backend/src/config/app-config.service.ts` — `AppConfigService` with `ConfigService<Env, true>` typed get and `isProduction` getter
- `packages/backend/src/config/config.module.ts` — `@Global() AppConfigModule` with `envSchema.parse` validate callback

## Decisions Made

- `envSchema.parse(env)` not `envSchema.safeParse(env)` — `safeParse` does not throw; the app would boot with invalid config
- `ConfigService<Env, true>` strict flag — `get(key, { infer: true })` returns `Env[K]` with no undefined widening
- `DATABASE_URL: z.string().min(1)` — uses min(1) as specified; accepts any non-empty string (not just URL format) for portability with different PostgreSQL URL schemes
- prettierConfig ordering preserved — two new rule objects inserted at positions [2] and [3]; prettierConfig at [4]; ignores at [5]

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing node_modules**
- **Found during:** Task 2 GREEN (first test run)
- **Issue:** The git worktree had no `node_modules` directory; Vitest could not resolve `zod`. The packages were already declared in `package.json` and present in `package-lock.json` (installed in the main repo checkout during wave 1), but the worktree had its own separate filesystem root with no node_modules.
- **Fix:** Ran bare `npm install` (no package arguments) from the worktree root to install all declared dependencies from the existing lockfile. No new packages were added.
- **Impact:** None — lockfile was unchanged; only node_modules directory was populated.
- **Commit:** Not committed (node_modules is gitignored)

## TDD Gate Compliance

- RED gate: commit `f3848fd` (`test(02-02)`) — tests fail because `env.schema.ts` does not exist
- GREEN gate: commit `943512b` (`feat(02-02)`) — all 6 tests pass after implementation
- REFACTOR gate: not needed — implementation was clean on first pass

## Known Stubs

None.

## Threat Flags

No new threat surface beyond what is in the plan's threat model. The three STRIDE threats are addressed:
- T-02-02 (Tampering — ConfigModule validate): mitigated via `envSchema.parse(env)` — throws `ZodError` on missing/invalid vars
- T-02-03 (Tampering — process.env outside config/): mitigated via `no-restricted-properties` ESLint rule with `npm run lint` CI gate
- T-02-04 (DoS — missing DATABASE_URL): mitigated via `z.string().min(1)` — empty string and missing value both throw `ZodError` at startup

## Self-Check

- [x] `eslint.config.mjs` exists and has 2 occurrences of `no-restricted-properties`
- [x] `packages/backend/src/config/env.schema.ts` exists
- [x] `packages/backend/src/config/env.schema.spec.ts` exists — 6 tests pass
- [x] `packages/backend/src/config/app-config.service.ts` exists
- [x] `packages/backend/src/config/config.module.ts` exists
- [x] `npm run lint` exits 0
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run test --workspace packages/backend` — 7/7 tests pass
- [x] `grep "envSchema.parse"` confirms parse (not safeParse) in config.module.ts
- [x] `grep "ConfigService<Env, true>"` confirmed in app-config.service.ts
- [x] No `process.env` in any config/ source file

## Self-Check: PASSED

---
*Phase: 02-platform-kernel-bootstrap-config-error-contract*
*Completed: 2026-07-01*
