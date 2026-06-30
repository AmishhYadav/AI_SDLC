# Phase 1: Monorepo & Tooling Foundation - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 18 (16 new, 2 modified)
**Analogs found:** 3 / 18 (in-repo matches); remaining 15 have no codebase analog — use RESEARCH.md patterns

---

## Key Finding

This is the repo's first build/lint/format/test tooling pass. The only implemented package is `packages/database`. It is the **sole in-repo analog** for structural patterns. For every tooling config file (turbo.json, tsconfig, eslint, prettier, vitest, nest-cli.json, .swcrc, CI workflow), no codebase analog exists — planner must use the complete patterns from RESEARCH.md `## Code Examples`.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest In-Repo Analog | Match Quality |
|---------------------|------|-----------|------------------------|---------------|
| `package.json` (root, modified) | config | N/A | `packages/database/package.json` | partial — different scope (workspace root vs. member) |
| `turbo.json` | config | N/A | none | no analog |
| `tsconfig.base.json` | config | N/A | none | no analog |
| `eslint.config.mjs` | config | N/A | none | no analog |
| `.prettierrc` | config | N/A | none | no analog |
| `.nvmrc` | config | N/A | none | no analog |
| `.gitignore` (modified) | config | N/A | `.gitignore` (existing, 5 lines) | partial — extend/replace |
| `packages/database/package.json` (modified) | config | N/A | itself | exact — add `name` field only |
| `packages/database/tsconfig.json` | config | N/A | none | no analog |
| `packages/database/.env.example` | config | N/A | `packages/database/.env` (keys only) | partial — strip values, keep keys |
| `packages/backend/package.json` | config | N/A | `packages/database/package.json` | role-match — same workspace-member shape |
| `packages/backend/tsconfig.json` | config | N/A | none | no analog |
| `packages/backend/nest-cli.json` | config | N/A | none | no analog |
| `packages/backend/.swcrc` | config | N/A | none | no analog |
| `packages/backend/vitest.config.ts` | config | N/A | none | no analog |
| `packages/backend/src/index.ts` | utility | transform | `packages/database/src/index.ts` | exact — same barrel-export pattern |
| `packages/backend/src/index.spec.ts` | test | N/A | none | no analog |
| `.github/workflows/ci.yml` | config | event-driven | none | no analog |

---

## Pattern Assignments

### `package.json` (root, modified)

**Analog:** `packages/database/package.json` (partial — structural reference only)
**Analog path:** `/Users/amish/AI_SDLC/packages/database/package.json`

**Current root `package.json`** (lines 1-10) — starting point to rewrite:
```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "nextjs": "^0.0.3",
    "prisma": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^26.0.1"
  }
}
```

**What to change:**
- Remove `"nextjs": "^0.0.3"` (stub, not real Next.js; frontend is out of scope per D-02)
- Remove `"@prisma/client"` and `"prisma"` from root — they belong only in `packages/database`
- Add `"name": "ai-sdlc"`, `"private": true`, `"workspaces": ["packages/*"]`, `"packageManager": "npm@10.9.8"`, `"engines": { "node": ">=22.0.0" }`
- Add all devDependencies per RESEARCH.md Standard Stack
- Add scripts delegating to Turborepo: `build`, `typecheck`, `lint`, `test`, `format:check`, `format`
- Keep `"@types/node": "^26.0.1"` — this is correct for TS 5.9 + Node 22 (Landmine 4)

**Full target shape:** RESEARCH.md `## Code Examples` → "Root `package.json` (post-cleanup)"

---

### `packages/database/package.json` (modified — add `name` field)

**Analog:** itself
**Analog path:** `/Users/amish/AI_SDLC/packages/database/package.json`

**Current content** (lines 1-11):
```json
{
  "dependencies": {
    "@nestjs/common": "^11.1.27",
    "@prisma/client": "^6.0.0",
    "prisma": "^6.0.0"
  },
  "prisma": {
    "schema": "prisma/schema",
    "seed": "node --experimental-strip-types prisma/seed.ts"
  }
}
```

**Minimal change required:** Add `"name": "@repo/database"` and `"version": "0.0.1"` and `"private": true` at the top. This is the blocking fix for npm workspace symlink resolution (Landmine 1 in RESEARCH.md). No other changes to this file.

**Target:**
```json
{
  "name": "@repo/database",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@nestjs/common": "^11.1.27",
    "@prisma/client": "^6.0.0",
    "prisma": "^6.0.0"
  },
  "prisma": {
    "schema": "prisma/schema",
    "seed": "node --experimental-strip-types prisma/seed.ts"
  }
}
```

---

### `packages/backend/package.json` (new)

**Analog:** `packages/database/package.json`
**Analog path:** `/Users/amish/AI_SDLC/packages/database/package.json`

**Pattern to copy from analog** (workspace member shape):
- `"name"`: follow `@repo/<package>` naming convention, giving `@repo/backend`
- `"version"`: `"0.0.1"` (same as database)
- `"private": true` (all workspace members are private)
- Scripts follow workspace-member conventions: `build`, `typecheck`, `lint`, `test`

**Full target shape:** RESEARCH.md `## Code Examples` → "`packages/backend/package.json` (minimal)"

---

### `packages/backend/src/index.ts` (new)

**Analog:** `packages/database/src/index.ts`
**Analog path:** `/Users/amish/AI_SDLC/packages/database/src/index.ts`

**Analog content** (lines 1-4):
```typescript
export * from './prisma.module';
export * from './prisma.service';

export * from '../generated/client';
```

**Pattern:** Barrel export using `export * from`. The backend `index.ts` copies this pattern but exports from `@repo/database` to prove workspace resolution:
```typescript
// Minimal entry — exports @repo/database to prove workspace resolution.
// AppModule and bootstrap belong to Phase 2.
export * from '@repo/database';
```

**Why this is sufficient:** D-08 explicitly says no `main.ts`, AppModule, config, or routes. The barrel re-export is the minimum to prove `@repo/database` resolves and `nest build` can compile the package.

---

### `.gitignore` (modified)

**Analog:** existing `.gitignore`
**Analog path:** `/Users/amish/AI_SDLC/.gitignore`

**Current content** (lines 1-5):
```
.agent/
/generated/prisma
node_modules
.env
.claude/
```

**What to keep from current:**
- `.agent/` — keep
- `.claude/` — keep
- `node_modules` — keep (normalize to `node_modules/`)
- `/generated/prisma` — replace with `**/generated/client/` (covers all packages)

**What to add:**
- `**/.env` and `**/.env.*` with negation `!**/.env.example` (D-05 — upgrade from bare `.env`)
- `**/dist/` (build outputs from all packages)
- `.turbo/` (Turborepo cache)
- `.DS_Store` and `*.DS_Store` (OS artifacts present in working tree)

**Full target shape:** RESEARCH.md `## Code Examples` → "`.gitignore` (standard Node monorepo)"

---

### `packages/database/.env.example` (new)

**Analog:** `packages/database/.env` (keys only — never commit values)
**Analog path:** `/Users/amish/AI_SDLC/packages/database/.env`

**Keys extracted from `.env`** (line 12 — value redacted here):
```
DATABASE_URL=
```

**Target shape:**
```dotenv
# Supabase Postgres connection string.
# Rotate in Supabase dashboard: https://supabase.com/dashboard → Project Settings → Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
```

No other keys present in current `.env`.

---

### `turbo.json` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Code Examples` → "Complete `turbo.json` (v2, Phase 1 tasks)"

Critical notes for planner:
- Turborepo 2.x uses `"tasks"` key, NOT `"pipeline"` (Anti-pattern in RESEARCH.md)
- `globalDependencies` must include `tsconfig.base.json`, `eslint.config.mjs`, `.swcrc`, `.prettierrc` so config changes invalidate cache (Pitfall 6)
- `format:check` (Prettier) is NOT a Turbo task — run at root only (Pattern 1 note in RESEARCH.md)
- `test` task should NOT have `"dependsOn": ["^build"]` for Phase 1 (tests are unit-only, no inter-package build dependency needed at this stage)

---

### `tsconfig.base.json` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Code Examples` → "`tsconfig.base.json` (strict baseline)"

Critical notes for planner:
- Do NOT include `"experimentalDecorators"` or `"emitDecoratorMetadata"` — those go only in `packages/backend/tsconfig.json` (Anti-pattern in RESEARCH.md)
- `"noUncheckedIndexedAccess": true` is stricter than `"strict": true` alone — include it (CLAUDE.md §7 code quality)
- `"module": "CommonJS"` — NestJS default; do not set `"type": "module"` (Anti-pattern in RESEARCH.md)

---

### `packages/database/tsconfig.json` (new)

**Analog:** none in codebase (closest shape is `packages/backend/tsconfig.json` from RESEARCH.md, but without NestJS decorator flags)
**Use:** RESEARCH.md `## Code Examples` → "`packages/backend/tsconfig.json`" as structural template, then remove `experimentalDecorators` and `emitDecoratorMetadata`

**Target shape:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "generated"]
}
```

No decorator flags — `packages/database` uses NestJS decorators (`@Injectable`, `@Global`, `@Module`) but those flags are transpilation-only and handled by SWC. `tsc --noEmit` (typecheck) for the database package does not need `emitDecoratorMetadata` to type-check decorator usage.

---

### `packages/backend/tsconfig.json` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Code Examples` → "`packages/backend/tsconfig.json`"

Critical note: This IS where `"experimentalDecorators": true` and `"emitDecoratorMetadata": true` live — backend-only, not in base.

---

### `eslint.config.mjs` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Architecture Patterns` → "Pattern 2: ESLint 9 Flat Config with TypeScript + Prettier"

Critical notes for planner:
- `eslint-config-prettier` MUST be last in the config array (disables conflicting rules)
- Use `tseslint.configs.recommended` (not `recommendedTypeChecked`) to avoid requiring `parserOptions.project` wiring (Pitfall 5 in RESEARCH.md)
- `ignores` must cover `**/dist/**`, `**/node_modules/**`, `**/generated/**`, `.planning/**`
- Lint command in `packages/backend/package.json`: `eslint src --ext .ts`

---

### `.prettierrc` (new)

**Analog:** none in codebase
**Use:** Standard Prettier defaults. No unusual project requirements. Minimal config:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

These defaults align with NestJS community conventions and will not conflict with ESLint (covered by `eslint-config-prettier`).

---

### `.nvmrc` (new)

**Analog:** none in codebase
**Content:** Single line: `22.23.1` (latest Node 22 LTS "Jod" as of 2026-06-29; machine has 22.22.3 — either works)

---

### `packages/backend/nest-cli.json` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Architecture Patterns` → "Pattern 3: NestJS SWC Builder (`nest-cli.json`)"

Note: `"entryFile": "index"` maps to `src/index.ts` (the minimal barrel export). RESEARCH.md Open Question 1 flags that `nest build` may require NestJS imports at entry — if `export * from '@repo/database'` causes a build error, fall back to `export {}`.

---

### `packages/backend/.swcrc` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Architecture Patterns` → "Pattern 4: SWC Configuration for NestJS (`.swcrc`)"

Critical: `"decoratorMetadata": true` must be set — required for NestJS DI to work in tests (Pitfall 3).

---

### `packages/backend/vitest.config.ts` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Architecture Patterns` → "Pattern 5: Vitest 4 + SWC for NestJS"

Critical: `plugins: [swc.vite({ module: { type: 'es6' } })]` must be present — even though Phase 1 sample test is trivial (no decorators), the config must be correct for Phase 2 to work without changes (Pitfall 3).

---

### `packages/backend/src/index.spec.ts` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Code Examples` → "`packages/backend/src/index.spec.ts` (sample passing test)"

The sample test uses a dynamic import of `@repo/database` to prove workspace resolution (covers TOOL-01 and TOOL-04 simultaneously).

---

### `.github/workflows/ci.yml` (new)

**Analog:** none in codebase
**Use:** RESEARCH.md `## Code Examples` → "GitHub Actions CI Workflow"

Critical notes for planner:
- `format:check` runs as a separate step (`npm run format:check`) before the Turborepo tasks — Prettier is not a Turbo task
- `npx turbo run lint typecheck test build` drives all other gates through Turborepo
- `actions/setup-node@v4` with `cache: 'npm'` for dependency caching
- Trigger on `push` and `pull_request` targeting `main`

---

## Shared Patterns

### Workspace Package Naming Convention
**Source:** `packages/database/package.json` (anticipated `name` field)
**Apply to:** `packages/database/package.json`, `packages/backend/package.json`

All workspace members use the `@repo/<package-name>` naming scheme:
- `@repo/database` — the database package
- `@repo/backend` — the backend package
- Future: `@repo/frontend`, `@repo/shared`, etc.

### Barrel Export Pattern
**Source:** `packages/database/src/index.ts` (lines 1-4)
**Apply to:** `packages/backend/src/index.ts`

```typescript
export * from '<module>';
```

Single `src/index.ts` as the public API surface. All consumers import from the package name (`@repo/database`), not from internal paths.

### tsconfig Inheritance
**Source:** RESEARCH.md (no in-repo analog)
**Apply to:** `packages/database/tsconfig.json`, `packages/backend/tsconfig.json`

All per-package tsconfigs extend `../../tsconfig.base.json`. Per-package overrides are additive (e.g., NestJS decorator flags only in backend). The base is not modified per-package concerns.

### NestJS Decorator Imports
**Source:** `packages/database/src/prisma.module.ts` (lines 1-9), `packages/database/src/prisma.service.ts` (lines 1-2)
**Apply to:** Any Phase 2+ NestJS modules in `packages/backend`

```typescript
// Module pattern
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// Service pattern
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class SomeService implements OnModuleInit { ... }
```

This pattern is established in `packages/database`; Phase 2 backend modules must follow the same structure (CLAUDE.md §6 Architecture Rules: controllers orchestrate, services contain logic).

---

## No Analog Found

These files have no close match in the codebase. Planner must use RESEARCH.md `## Code Examples` and `## Architecture Patterns` as the authoritative source:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `turbo.json` | config | N/A | No Turborepo config exists; use RESEARCH.md Pattern 1 + Code Examples |
| `tsconfig.base.json` | config | N/A | No TypeScript config exists; use RESEARCH.md Code Examples |
| `eslint.config.mjs` | config | N/A | No ESLint config exists; use RESEARCH.md Pattern 2 |
| `.prettierrc` | config | N/A | No Prettier config exists; use standard defaults (see above) |
| `.nvmrc` | config | N/A | No Node version pin exists; single line: `22.23.1` |
| `packages/database/tsconfig.json` | config | N/A | No tsconfig exists for database package; derive from backend shape, remove decorator flags |
| `packages/backend/tsconfig.json` | config | N/A | No backend package exists; use RESEARCH.md Code Examples |
| `packages/backend/nest-cli.json` | config | N/A | No NestJS CLI config exists; use RESEARCH.md Pattern 3 |
| `packages/backend/.swcrc` | config | N/A | No SWC config exists; use RESEARCH.md Pattern 4 |
| `packages/backend/vitest.config.ts` | config | N/A | No Vitest config exists; use RESEARCH.md Pattern 5 |
| `packages/backend/src/index.spec.ts` | test | N/A | No test files exist; use RESEARCH.md Code Examples |
| `.github/workflows/ci.yml` | config | event-driven | No CI workflow exists; use RESEARCH.md Code Examples |

---

## Critical Blockers (Prerequisite Order for Planner)

These must be done before other tasks can proceed:

1. **Fix `.gitignore`** — Add `**/.env`, `**/dist/`, `.turbo/`, `.DS_Store`. Without this, `packages/database` and `packages/backend` could have `.env` accidentally committed, and build artifacts would clutter git status.

2. **Add `name` to `packages/database/package.json`** — Without `"name": "@repo/database"`, `npm install` silently skips the workspace symlink. `packages/backend` cannot resolve `@repo/database`. This is a hard blocker for TOOL-01 (Landmine 1 in RESEARCH.md).

3. **Delete `packages/database/package-lock.json`** — Once the root workspace takes over, the nested lockfile causes `npm ci` warnings and potential failures (Landmine 2 in RESEARCH.md).

4. **Surface credential rotation as human gate** — `packages/database/.env` contains a live Supabase credential. Plan must include a blocking human task: rotate the Supabase password in the dashboard, update local `.env`, before any `npm install` or CI run (D-04).

---

## Metadata

**Analog search scope:** `/Users/amish/AI_SDLC/packages/`, repo root config files
**Files scanned:** 8 (package.json root, packages/database/{package.json, src/index.ts, src/prisma.module.ts, src/prisma.service.ts}, .gitignore, packages/database/.env, .planning/phases/01-*/01-{CONTEXT,RESEARCH}.md)
**In-repo analogs found:** 3 exact/role-match (`packages/database/src/index.ts`, `packages/database/package.json`, `.gitignore`)
**Pattern extraction date:** 2026-06-29
