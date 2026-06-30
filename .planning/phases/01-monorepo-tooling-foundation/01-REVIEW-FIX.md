---
phase: 01
fixed_at: 2026-06-30T12:06:00Z
review_path: .planning/phases/01-monorepo-tooling-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-30T12:06:00Z
**Source review:** .planning/phases/01-monorepo-tooling-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 Critical + 7 Warning)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: `eslint --ext .ts` flag removed in ESLint v9 — CI lint always fails

**Files modified:** `packages/backend/package.json`, `packages/database/package.json`
**Commit:** 8c4d801
**Applied fix:** Changed both `"lint": "eslint src --ext .ts"` scripts to `"lint": "eslint 'src/**/*.ts'"`. The glob pattern is the ESLint v9 equivalent of the removed `--ext` flag.

---

### CR-02: GitHub Actions pinned to mutable semver tags — supply-chain vulnerability

**Files modified:** `.github/workflows/ci.yml`
**Commit:** 0843d8d
**Applied fix:** Replaced `actions/checkout@v4` with `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2` and `actions/setup-node@v4` with `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0`.

---

### WR-01: No `permissions:` block — GITHUB_TOKEN has excessive default scopes

**Files modified:** `.github/workflows/ci.yml`
**Commit:** a6b8398
**Applied fix:** Added top-level `permissions: contents: read` block between the `on:` and `jobs:` sections, restricting GITHUB_TOKEN to read-only.

---

### WR-02: `turbo.json` globalDependency `.swcrc` does not exist at the workspace root

**Files modified:** `turbo.json`
**Commit:** 9a09dda
**Applied fix:** Removed `".swcrc"` from the `globalDependencies` array. The file only exists at `packages/backend/.swcrc`, so the root-level entry was a no-op that silently prevented SWC config changes from invalidating the Turbo cache.

---

### WR-03: `PrismaService.enableShutdownHooks` uses `beforeExit` — silent no-op on signal-based shutdown

**Files modified:** `packages/database/src/prisma.service.ts`
**Commit:** 81867c9
**Applied fix:** Removed the `enableShutdownHooks` method entirely. The file already had correct `OnModuleInit`/`OnModuleDestroy` implementations — only the dead `enableShutdownHooks` method (which used `beforeExit`, ineffective for SIGTERM/SIGINT) needed removal.

---

### WR-04: `prisma` CLI listed under `dependencies` instead of `devDependencies`

**Files modified:** `packages/database/package.json`, `package-lock.json`
**Commits:** df5b425 (package.json), 94492e4 (package-lock.json)
**Applied fix:** Moved `"prisma": "^6.0.0"` from `dependencies` to `devDependencies`. Kept `"@prisma/client": "^6.0.0"` in `dependencies`. Ran `npm install` to update the lockfile.

---

### WR-05: Generated Prisma client is gitignored but no automation exists to generate it

**Files modified:** `packages/database/package.json`
**Commit:** 1b8a1dc
**Applied fix:** Added `"generate": "prisma generate"` and `"postinstall": "prisma generate"` to the scripts block. On fresh clone, `npm ci` will automatically trigger Prisma client generation.

---

### WR-06: Database package has no `build` script — silently skipped by Turbo

**Files modified:** `packages/database/package.json`
**Commit:** 9d7bdf7
**Applied fix:** Added `"build": "tsc --project tsconfig.json --outDir dist"` to scripts. The `"main"` field was intentionally left as `"src/index.ts"` to preserve Vitest's dynamic import resolution (changing it to `dist/index.js` would break the passing integration test in `packages/backend`). Verified `packages/database/tsconfig.json` already has `outDir: "./dist"`, `rootDir: "./src"`, and `include: ["src/**/*"]` — correct for compilation.

---

### WR-07: `seed.ts` uses `require()` — all Prisma types silently become `any`

**Files modified:** `packages/database/prisma/seed.ts`
**Commit:** d1e5010
**Applied fix:** Replaced `const { PrismaClient } = require('../generated/client')` with `import { PrismaClient } from '../generated/client'`. Added explicit parameter types to `upsertConfiguration` (`organizationId: string`, `key: string`, `value: unknown`, `description: string`).

---

## Verification

All tasks passed after fixes:

```
Tasks:    7 successful, 7 total
Cached:    0 cached, 7 total
  Time:    2.088s
```

- `@repo/database:lint` — passed (ESLint glob pattern fix)
- `@repo/database:typecheck` — passed
- `@repo/database:build` — passed (new build script)
- `@repo/backend:lint` — passed (ESLint glob pattern fix)
- `@repo/backend:typecheck` — passed
- `@repo/backend:test` — passed (1 test, 317ms)
- `@repo/backend:build` — passed (nest build + SWC)

Format check (`npm run format:check`) also passed.

---

_Fixed: 2026-06-30T12:06:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
