---
phase: 01-monorepo-tooling-foundation
plan: 03
subsystem: tooling
tags: [nestjs, swc, vitest, github-actions, workspace-resolution, ci]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [backend-compile-target, vitest-runner, ci-pipeline, workspace-resolution-proof]
  affects: [all-subsequent-phases]
tech_stack:
  added:
    - "@repo/backend workspace member (packages/backend)"
    - "nest build via SWC (packages/backend/nest-cli.json)"
    - "Vitest 4 + unplugin-swc for backend tests (packages/backend/vitest.config.ts)"
    - "GitHub Actions CI pipeline (.github/workflows/ci.yml)"
  patterns:
    - NestJS SWC builder (nest-cli.json compilerOptions.builder.type = swc)
    - SWC decorator metadata (.swcrc decoratorMetadata: true)
    - Vitest globals with unplugin-swc (excludes dist/ to prevent compiled-test re-run)
    - tsconfig inheritance chain (backend extends tsconfig.base.json + NestJS decorator flags)
    - GitHub Actions with npm ci + format:check separate from turbo run
key_files:
  created:
    - packages/backend/package.json (name @repo/backend, @repo/database dep, build/typecheck/lint/test scripts)
    - packages/backend/tsconfig.json (extends tsconfig.base.json, experimentalDecorators, emitDecoratorMetadata)
    - packages/backend/nest-cli.json (SWC builder, entryFile index)
    - packages/backend/.swcrc (decoratorMetadata true, legacyDecorator true)
    - packages/backend/vitest.config.ts (unplugin-swc plugin, globals true, exclude dist/**)
    - packages/backend/src/index.ts (barrel re-export from @repo/database)
    - packages/backend/src/index.spec.ts (dynamic import test proves workspace resolution)
    - .github/workflows/ci.yml (push/PR to main, npm ci + format:check + turbo lint typecheck test build)
  modified:
    - packages/database/package.json (added main: src/index.ts — Rule 2 auto-fix)
decisions:
  - id: D-main-field
    what: Added "main":"src/index.ts" to packages/database/package.json
    why: Vite/Vitest requires a package entry point to resolve @repo/database; without main, import('@repo/database') fails with "Failed to resolve entry" error
  - id: D-vitest-exclude-dist
    what: Added exclude:['dist/**','node_modules/**'] to vitest.config.ts
    why: nest build outputs compiled JS to dist/ including index.spec.js; without exclude, Vitest picks up the compiled test and fails (CommonJS require of ESM Vitest)
metrics:
  duration_minutes: 12
  tasks_completed: 2
  files_created: 8
  completed_date: "2026-06-30"
---

# Phase 01 Plan 03: Backend Compile Target + CI Pipeline Summary

**One-liner:** Minimal @repo/backend compile target (nest build with SWC) + passing Vitest workspace-resolution test + GitHub Actions CI pipeline — all phase gates green.

## What Was Built

### Task 1: packages/backend scaffold (commit 36e6d3e)

Created the minimal `@repo/backend` workspace member as specified by D-08:

- **packages/backend/package.json**: `@repo/backend` v0.0.1, private, with `@repo/database: "*"` workspace dep, `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs` dependencies. Scripts: `build: nest build`, `typecheck: tsc --noEmit`, `lint: eslint src --ext .ts`, `test: vitest run`. No `"type": "module"` (NestJS uses CommonJS).
- **packages/backend/tsconfig.json**: Extends `../../tsconfig.base.json`. Adds `experimentalDecorators: true` and `emitDecoratorMetadata: true` (NestJS DI reflection). `outDir: ./dist`, `rootDir: ./src`.
- **packages/backend/nest-cli.json**: `compilerOptions.builder.type: "swc"`, `entryFile: "index"` (maps to src/index.ts), `deleteOutDir: true`.
- **packages/backend/.swcrc**: `sourceMaps: true`, `jsc.parser` with TypeScript syntax + decorators + dynamicImport, `jsc.transform` with `legacyDecorator: true` + `decoratorMetadata: true`, `minify: false`.

Ran `npm install` at root. Workspace symlink confirmed: `node_modules/@repo/database → ../../packages/database`. Verified `@swc/cli` and `@swc/core` present at root.

### Task 2: Source + test + Vitest config + CI workflow (commit 58ac2cf)

**TDD RED**: Created `packages/backend/src/index.spec.ts` first. Test uses `await import('@repo/database')` + `expect(database).toBeDefined()`. Confirmed failure before implementation (expected — @repo/database had no `main` field).

**Rule 2 auto-fix**: Added `"main": "src/index.ts"` to `packages/database/package.json`. Vite/Vitest requires this entry point to resolve the package. Without it: "Failed to resolve entry for package '@repo/database'".

**Implementation**:
- **packages/backend/vitest.config.ts**: `defineConfig` with `test.globals: true`, `test.root: './'`, `test.exclude: ['dist/**', 'node_modules/**']`, `plugins: [swc.vite({ module: { type: 'es6' } })]`. The exclude is critical — nest build outputs `dist/src/index.spec.js`; without exclude, Vitest picks it up and fails on CommonJS require of ESM Vitest.
- **packages/backend/src/index.ts**: `export * from '@repo/database'` — barrel re-export proves workspace resolution compiles at build time.
- **.github/workflows/ci.yml**: Triggers on `push` and `pull_request` to `main`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node-version 22, cache npm), `npm ci`, `npm run format:check` (separate step — Prettier is not a Turbo task), `npx turbo run lint typecheck test build`.

**TDD GREEN**: `cd packages/backend && npx vitest run` → 1 test passing.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Vitest 1 test passing | `cd packages/backend && npx vitest run` | 1/1 passed |
| nest build (SWC) | `npx turbo run build` | Successfully compiled: 2 files with swc |
| turbo lint | `npx turbo run lint` | 2 packages, all passed |
| turbo typecheck | `npx turbo run typecheck` | 2 packages, all passed |
| turbo test | `npx turbo run test` | 1/1 passed |
| format:check | `npm run format:check` | All matched files use Prettier code style! |
| .nvmrc Node 22 | `cat .nvmrc` | 22.23.1 |
| .env gitignored | `git check-ignore packages/database/.env` | packages/database/.env |
| ci.yml exists | `test -f .github/workflows/ci.yml` | PASSED |
| workspace resolution | `npm ls @repo/database -w @repo/backend` | @repo/database@0.0.1 -> ./packages/database |
| nest build confirms SWC | turbo output | "> SWC Running... Successfully compiled: 2 files" |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added `main` field to packages/database/package.json**
- **Found during:** Task 2 RED step — `await import('@repo/database')` failed with "Failed to resolve entry for package '@repo/database'"
- **Issue:** `packages/database/package.json` had no `main` or `exports` field. Vite/Vitest requires an explicit entry point for module resolution; without it, the dynamic import fails even though the workspace symlink exists.
- **Fix:** Added `"main": "src/index.ts"` to `packages/database/package.json`. TypeScript follows this for type resolution; Vite/unplugin-swc handles the TypeScript transpilation automatically.
- **Files modified:** `packages/database/package.json`
- **Commit:** 58ac2cf

**2. [Rule 1 - Bug] Added `exclude: ['dist/**', 'node_modules/**']` to vitest.config.ts**
- **Found during:** Task 2 full suite run — `npx turbo run lint typecheck test` failed
- **Issue:** `nest build` outputs compiled test to `dist/src/index.spec.js`. Without an exclude pattern, Vitest discovers and runs this compiled CommonJS file, which fails with "Vitest cannot be imported in a CommonJS module using require()"
- **Fix:** Added `test.exclude: ['dist/**', 'node_modules/**']` to `packages/backend/vitest.config.ts`.
- **Files modified:** `packages/backend/vitest.config.ts`
- **Commit:** 58ac2cf

### Fallback Not Needed

RESEARCH.md Open Question 1 anticipated that `nest build` might fail with `export * from '@repo/database'` and provided a fallback: use `export {}`. The fallback was NOT needed — nest build compiled successfully with the barrel re-export.

## Known Stubs

None. All files are complete and functional. The `packages/backend/src/index.ts` barrel re-export is intentionally minimal per D-08 — no AppModule, no bootstrap, no routes. This is not a stub; it is the specified Phase 1 output.

## Threat Flags

None identified. The CI workflow (ci.yml) does not configure any secret environment variables — no `DATABASE_URL` or other secrets in Phase 1 CI, consistent with threat T-03-01 mitigation. Only official GitHub-owned actions used: `actions/checkout@v4` and `actions/setup-node@v4`, consistent with T-03-02 mitigation.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/backend/package.json | FOUND |
| packages/backend/tsconfig.json | FOUND |
| packages/backend/nest-cli.json | FOUND |
| packages/backend/.swcrc | FOUND |
| packages/backend/vitest.config.ts | FOUND |
| packages/backend/src/index.ts | FOUND |
| packages/backend/src/index.spec.ts | FOUND |
| .github/workflows/ci.yml | FOUND |
| commit 36e6d3e (Task 1) | FOUND |
| commit 58ac2cf (Task 2) | FOUND |
