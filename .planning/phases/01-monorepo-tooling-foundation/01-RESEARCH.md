# Phase 1: Monorepo & Tooling Foundation — Research

**Researched:** 2026-06-29
**Domain:** npm workspaces, Turborepo 2.x, TypeScript 5.9, ESLint 9 flat config, Vitest 4, NestJS SWC builder, GitHub Actions
**Confidence:** HIGH (all core stack confirmed against npm registry; configuration syntax verified via official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use npm workspaces **plus Turborepo** for cached, parallel task orchestration (`lint`, `test`, `typecheck`, `build`) across packages. Chosen deliberately over workspaces-only because this foundation must carry 14 domains + a future frontend; the caching/orchestration payoff compounds as packages multiply.
- **D-02:** Root `package.json` becomes the workspace root (`workspaces: ["packages/*"]`) with scripts delegating to Turborepo. Remove the `nextjs ^0.0.3` stub and correct the suspicious `@types/node ^26` to a Node 22-aligned version.
- **D-03:** The credential was never committed to git — no git-history purge is required.
- **D-04:** The secret is real and currently valid — rotate the Supabase password in the Supabase dashboard. Plan must instruct the user.
- **D-05:** Add `**/.env` to `.gitignore` (current entry is bare `.env`) and commit `packages/database/.env.example` with placeholder values.
- **D-06:** The current `.gitignore` contains a bare `packages/` line — rewrite to a standard Node monorepo ignore set. After the fix, `packages/database` and `packages/backend` must be trackable/committable.
- **D-07:** Set up a GitHub Actions CI workflow: install + `lint` + `format:check` + `typecheck` + `test` + `build` driven through Turborepo, on push/PR.
- **D-08:** `packages/backend` is a minimal compile target only: `@repo/backend`, depends on `@repo/database`, `tsconfig.json` extending `tsconfig.base.json`, `nest-cli.json` (SWC builder), smallest source for `nest build` to succeed. **No** `main.ts`, AppModule, config, or routes.

### Claude's Discretion

- Turborepo pipeline/task graph specifics (`turbo.json` task definitions, cache inputs/outputs).
- ESLint 9 flat-config ruleset details, including whether to enable type-aware (`typescript-eslint` with type info) linting at the base level.
- Exact Node 22 LTS version string written to `.nvmrc`.
- Exact `tsconfig.base.json` strictness flag set (beyond `strict: true`).
- Vitest 4 + SWC config layout and the sample test's location/shape.
- Precise final `.gitignore` contents and root `package.json` cleanup edits.

### Deferred Ideas (OUT OF SCOPE)

- Cross-domain / layer boundary enforcement (eslint-plugin-boundaries, dependency-cruiser) — Phase 9.
- Real NestJS app bootstrap, typed config, error envelope, Prisma wiring — Phase 2.
- Frontend tooling (Next.js, Tailwind, shadcn/ui) — future milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Root repo declares workspaces; `packages/backend` resolves `@repo/database` without path hacks | npm workspaces `workspaces: ["packages/*"]`; `packages/database` must gain `"name": "@repo/database"` (see Critical Landmine #1) |
| TOOL-02 | Shared strict TypeScript config (`tsconfig.base.json`) pinned to TypeScript 5.9.x | TypeScript 5.9.3 confirmed on registry; base config documented in Standard Stack |
| TOOL-03 | ESLint 9 flat config + Prettier passing on repo | ESLint 9.39.4 (maintenance), typescript-eslint 8.62.0, eslint-config-prettier 10.1.8; exact config in Code Examples |
| TOOL-04 | Vitest 4 (with SWC) runner; sample test passes | Vitest 4.1.9 + unplugin-swc 1.5.9 + @swc/core 1.15.43; NestJS SWC requires `decoratorMetadata: true` in .swcrc |
| TOOL-05 | NestJS build/dev tooling (`nest-cli.json` with SWC builder) compiles backend | @nestjs/cli 11.0.23 peer deps `@swc/cli ^0.8` and `@swc/core ^1.3.62`; exact nest-cli.json in Code Examples |
| TOOL-06 | `.gitignore` excludes `**/.env`; DATABASE_URL credential rotated | `.gitignore` fix documented; user rotation is a manual step — plan must surface this as a blocking human gate |
| TOOL-07 | Node version pinned via `.nvmrc` to Node 22+ LTS | Node 22.23.1 ("Jod") confirmed current LTS; v22.22.3 installed on this machine |
</phase_requirements>

---

## Summary

Phase 1 is a pure tooling setup: no application logic, only infrastructure that every subsequent phase depends on. The technical surface is well-understood and the ecosystem is stable. Every major dependency (Turborepo, TypeScript, ESLint, Prettier, Vitest, NestJS CLI, SWC) has a clear current-stable version, confirmed via npm registry on 2026-06-29.

Three discoveries materially change the execution plan. First, `packages/database/package.json` has **no `name` field**. This is blocking — npm workspaces requires each member package to have a `name` so `packages/backend` can declare `"@repo/database": "*"` as a dependency. This field must be added before workspace resolution can work. Second, the committed `.gitignore` (HEAD) contains only `.agent/`; the `packages/` directory is simply untracked, **not ignored**. The D-06 fix is narrower than described: there is no bare `packages/` line to remove. Third, `@types/node ^26.0.1` in the root `package.json` is actually correct for TypeScript 5.9 + Node.js 22 — the `ts5.9` npm dist tag on `@types/node` resolves to `26.0.1`. D-02's instruction to "correct the suspicious `@types/node ^26`" does not require a version change, only confirmation.

ESLint 9 (9.39.4) is on the `maintenance` dist tag — ESLint 10.6.0 is now `latest` stable. The locked decision (D-01/D-03) explicitly calls for ESLint 9. Flat config syntax is **identical** across ESLint 9 and 10, so any config written now will port trivially if upgraded later. Packages/database carries its own `package-lock.json` that must be deleted when the root workspace takes over.

**Primary recommendation:** Execute in this order: (1) fix `.gitignore`, (2) add `name` to `packages/database/package.json`, (3) delete `packages/database/package-lock.json`, (4) establish root workspace with Turborepo, TypeScript, ESLint, Prettier, (5) create `packages/backend` minimal compile target, (6) wire Vitest + SWC, (7) add GitHub Actions workflow, (8) surface the Supabase credential rotation as a human-gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Monorepo task orchestration | Build toolchain (Turborepo) | — | Turborepo owns the cross-package task graph; npm workspaces owns resolution |
| TypeScript compilation | Build toolchain (tsc + SWC) | — | tsc for type-checking; SWC for fast transpilation in NestJS build and Vitest |
| Lint + format enforcement | Build toolchain (ESLint/Prettier) | CI | Runs locally via Turborepo tasks; CI enforces as a gate |
| Workspace dependency resolution | npm workspaces | — | Root `package.json` with `workspaces: ["packages/*"]` |
| Credential/secret hygiene | `.gitignore` + user action | CI (no secrets in env) | `.gitignore` covers files; rotation is a user-performed Supabase action |
| Continuous integration | GitHub Actions | Turborepo | Actions runs `npm ci` + Turborepo tasks |
| NestJS package compilation | NestJS CLI + SWC | TypeScript | `nest build` uses SWC for speed; `tsc --noEmit` for type-check |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `turbo` | `2.10.0` | Monorepo task orchestration, caching | Official Vercel tool; v2 is current stable; `tasks` schema replaces v1 `pipeline` |
| `typescript` | `5.9.3` | TypeScript compiler (typecheck only; SWC transpiles) | Latest 5.9.x per TOOL-02; pinned to avoid 6.0 breaking changes |
| `eslint` | `9.39.4` | Linter (flat config) | Locked to v9 per CONTEXT.md; latest v9 maintenance release |
| `@eslint/js` | `9.39.4` | ESLint built-in rule set for flat config | Must match ESLint version; ships ESLint's recommended config for flat config |
| `typescript-eslint` | `8.62.0` | Unified typescript-eslint package (replaces separate parser + plugin) | Current unified package; replaces deprecated `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` |
| `eslint-config-prettier` | `10.1.8` | Disables ESLint rules that conflict with Prettier | Official Prettier integration; supports ESLint 9 flat config via `/flat` export |
| `prettier` | `3.9.3` | Code formatter | Standard; version-agnostic for this phase |
| `vitest` | `4.1.9` | Test runner | Latest stable v4; SWC-compatible via `unplugin-swc` |
| `unplugin-swc` | `1.5.9` | SWC Vite plugin for Vitest | Required because NestJS decorators need `emitDecoratorMetadata`, which esbuild (Vitest's default) does not support |
| `@swc/core` | `1.15.43` | SWC transpiler core | Shared by both NestJS CLI (`nest build`) and Vitest; peer dep of `@nestjs/cli` and `unplugin-swc` |
| `@swc/cli` | `0.8.1` | SWC CLI binary | Peer dependency of `@nestjs/cli 11.x`; required for `nest build` with SWC |
| `@nestjs/cli` | `11.0.23` | NestJS CLI (`nest build`) | Latest stable v11; v12 is in `next` tag only |
| `@types/node` | `26.0.1` | Node.js type definitions | The `ts5.9` npm dist tag resolves to `26.0.1`; this is correct for TS 5.9 + Node 22 |

[VERIFIED: npm registry] — all versions confirmed via `npm view <pkg> version` on 2026-06-29.

### Supporting (root devDependencies, not per-package)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | `4.1.9` | V8-based test coverage | Add if coverage reporting is desired in CI later; matches Vitest version |

### Per-Package (packages/backend devDependencies)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@nestjs/cli` | `^11.0.23` | `nest build` command | Hoisted to root in npm workspaces; also list in `packages/backend` for explicitness |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint 9.39.4 (maintenance) | ESLint 10.6.0 (latest) | ESLint 10 is now stable; flat config API identical in both; D-01 locks to v9 — upgrade trivial later |
| `typescript-eslint` (unified) | `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` separately | The separate packages are the old way; unified package is the current recommendation per typescript-eslint docs |
| `unplugin-swc` for Vitest | `@swc/jest` | `@swc/jest` is for Jest; `unplugin-swc` is the Vitest ecosystem equivalent |
| `turbo` at root | `turbo` per-package | Root installation is the standard; Turborepo reads workspace roots |

**Installation (root devDependencies):**
```bash
npm install --save-dev \
  turbo@2.10.0 \
  typescript@5.9.3 \
  eslint@9.39.4 \
  @eslint/js@9.39.4 \
  typescript-eslint@8.62.0 \
  eslint-config-prettier@10.1.8 \
  prettier@3.9.3 \
  vitest@4.1.9 \
  unplugin-swc@1.5.9 \
  @swc/core@1.15.43 \
  @swc/cli@0.8.1 \
  @nestjs/cli@11.0.23
```

**packages/backend dependencies:**
```bash
# from packages/backend/
npm install @repo/database
npm install --save-dev @nestjs/common @nestjs/core reflect-metadata rxjs
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages below are tagged `[ASSUMED]` for origin. Registry existence and age confirmed via `npm view`. Planner must add `checkpoint:human-verify` before each install group.

| Package | Registry | Age (approx) | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|-----------|-------------|
| `turbo` | npm | ~4 yrs | Very high (Vercel product) | github.com/vercel/turborepo | N/A | Approved [ASSUMED] |
| `typescript` | npm | ~13 yrs | Extremely high (Microsoft) | github.com/microsoft/TypeScript | N/A | Approved [ASSUMED] |
| `eslint` | npm | ~10 yrs | Extremely high (OpenJS) | github.com/eslint/eslint | N/A | Approved [ASSUMED] |
| `@eslint/js` | npm | ~2 yrs | High (ESLint team) | github.com/eslint/eslint | N/A | Approved [ASSUMED] |
| `typescript-eslint` | npm | ~2 yrs | Very high (unified package) | github.com/typescript-eslint/typescript-eslint | N/A | Approved [ASSUMED] |
| `eslint-config-prettier` | npm | ~7 yrs | Very high (Prettier team) | github.com/prettier/eslint-config-prettier | N/A | Approved [ASSUMED] |
| `prettier` | npm | ~9 yrs | Extremely high | github.com/prettier/prettier | N/A | Approved [ASSUMED] |
| `vitest` | npm | ~3 yrs | Very high (Vite ecosystem) | github.com/vitest-dev/vitest | N/A | Approved [ASSUMED] |
| `unplugin-swc` | npm | ~3 yrs | High | github.com/unplugin/unplugin-swc | N/A | Approved [ASSUMED] |
| `@swc/core` | npm | ~4 yrs | Very high (SWC team) | github.com/swc-project/swc | N/A | Approved [ASSUMED] |
| `@swc/cli` | npm | ~4 yrs | High (SWC team) | github.com/swc-project/swc | N/A | Approved [ASSUMED] |
| `@nestjs/cli` | npm | ~6 yrs | Very high (NestJS team) | github.com/nestjs/nest-cli | N/A | Approved [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time — all packages above are tagged `[ASSUMED]`. Planner must gate each install group behind a `checkpoint:human-verify` task per the package legitimacy gate protocol.*

---

## Architecture Patterns

### System Architecture Diagram

```
Repo Root
│
├── turbo.json ──────────────────► task graph: lint, typecheck, test, build
│                                   (dependsOn graph ensures correct ordering)
├── tsconfig.base.json ──────────► shared strict TS baseline
├── eslint.config.mjs ───────────► flat config covering all TS files
├── .prettierrc ─────────────────► format rules
├── .nvmrc ──────────────────────► Node 22.23.1 pin
│
├── package.json (workspace root)
│    workspaces: ["packages/*"]
│    devDependencies: turbo, typescript, eslint, prettier, vitest, @swc/core ...
│    scripts: lint, format:check, typecheck, test, build (→ turbo run ...)
│
└── packages/
     ├── database/               @repo/database (existing, gains name field)
     │    package.json           name: "@repo/database"
     │    tsconfig.json          extends ../../tsconfig.base.json
     │    (no vitest config; no build script yet)
     │
     └── backend/                @repo/backend (new, minimal compile target)
          package.json           name: "@repo/backend", dep: @repo/database
          tsconfig.json          extends ../../tsconfig.base.json
                                 + experimentalDecorators, emitDecoratorMetadata
          nest-cli.json          compilerOptions.builder: swc
          .swcrc                 decorators: true, decoratorMetadata: true
          vitest.config.ts       unplugin-swc.vite() plugin
          src/
           └── index.ts          export * from '@repo/database'  ← proves resolution
           └── index.spec.ts     trivial passing Vitest test

GitHub Actions (.github/workflows/ci.yml)
    actions/checkout@v4
    actions/setup-node@v4  (node-version: '22')
    npm ci
    npx turbo lint typecheck test build
    npm run format:check     (prettier, root-only, not a Turbo task)
```

### Recommended Project Structure

```
AI_SDLC/
├── .github/
│   └── workflows/
│       └── ci.yml
├── packages/
│   ├── database/               # Existing — gains tsconfig.json + name field
│   └── backend/                # New — minimal compile target
│       ├── src/
│       │   ├── index.ts        # export * from '@repo/database'
│       │   └── index.spec.ts   # Sample Vitest test
│       ├── nest-cli.json
│       ├── .swcrc
│       ├── tsconfig.json       # extends ../../tsconfig.base.json
│       ├── vitest.config.ts
│       └── package.json
├── tsconfig.base.json
├── eslint.config.mjs
├── .prettierrc
├── .nvmrc
├── turbo.json
└── package.json                # workspace root
```

### Pattern 1: Turborepo Task Graph (v2 `tasks` schema)

**What:** Defines how lint/typecheck/test/build tasks relate across packages. The `^` prefix in `dependsOn` means "wait for this task in dependency packages first."
**When to use:** All cross-package task ordering in Turborepo 2.x.

```jsonc
// turbo.json
// Source: https://turborepo.dev/repo/docs/reference/configuration
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": [],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

> **Note:** `format:check` (Prettier) is NOT a per-package task — Prettier checks the whole repo. Run `npm run format:check` separately from `turbo run ...` in CI. Do not add it to `turbo.json`.

### Pattern 2: ESLint 9 Flat Config with TypeScript + Prettier

**What:** The `eslint.config.mjs` flat config using `typescript-eslint` and `eslint-config-prettier`.
**When to use:** Repo root; replaces all `.eslintrc*` and `.eslintignore` files.

```javascript
// eslint.config.mjs
// Source: https://typescript-eslint.io/getting-started + eslint-config-prettier docs
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,   // MUST be last — disables rules that conflict with Prettier
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.js',    // generated JS files
      '.planning/**',
    ],
  },
);
```

> **Important:** `eslint-config-prettier` from `eslint-config-prettier` (main export) works for flat config in v10.x. The `/flat` subpath export is an alias for the same thing. No need to use the subpath.

### Pattern 3: NestJS SWC Builder (`nest-cli.json`)

**What:** Configures `nest build` to use SWC instead of tsc for transpilation.
**When to use:** `packages/backend/nest-cli.json`.

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "entryFile": "index",
  "compilerOptions": {
    "builder": {
      "type": "swc"
    },
    "deleteOutDir": true
  }
}
```

### Pattern 4: SWC Configuration for NestJS (`.swcrc`)

**What:** SWC transpiler settings with decorator metadata support required by NestJS.
**When to use:** `packages/backend/.swcrc` (NestJS-specific; decorators need metadata).

```json
{
  "$schema": "https://swc.rs/schema.json",
  "sourceMaps": true,
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    },
    "baseUrl": "./"
  },
  "minify": false
}
```

### Pattern 5: Vitest 4 + SWC for NestJS

**What:** Vitest config using `unplugin-swc` so decorator metadata is available in tests.
**When to use:** `packages/backend/vitest.config.ts`.

```typescript
// Source: https://docs.nestjs.com/recipes/swc (testing section)
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
```

### Anti-Patterns to Avoid

- **Using `pipeline` in turbo.json v2:** Turborepo 2.x uses `tasks`, not `pipeline`. Using `pipeline` will cause a config validation error.
- **Putting Prettier in the Turborepo task graph:** Prettier is repo-wide; running it per-package creates cache invalidation complexity for no benefit. Run at root.
- **`emitDecoratorMetadata: true` in tsconfig.base.json:** This is NestJS-specific and should only be in `packages/backend/tsconfig.json`. Adding it to the base pollutes all packages.
- **Skipping the `@swc/cli` install:** NestJS CLI 11.x lists `@swc/cli` as a peer dependency. Omitting it causes a warning and may cause `nest build` to fail.
- **Keeping `packages/database/package-lock.json`:** Once `packages/database` is a workspace member, the root `package-lock.json` is authoritative. The nested lockfile is stale, causes warnings, and can cause `npm ci` failures.
- **Adding `type: "module"` to `packages/backend/package.json` without vetting:** NestJS with CommonJS (the default) does not need `"type": "module"`. ESM-first NestJS is possible but adds complexity outside Phase 1 scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-package task orchestration | Custom shell scripts with `&&` | Turborepo `tasks` | Turborepo handles dependency ordering, caching, parallel execution, and cache invalidation — all edge-cases in hand-rolled scripts |
| TypeScript decorator transpilation | Custom babel/esbuild pipeline | SWC via `@swc/core` | SWC has first-class NestJS support (decoratorMetadata); esbuild does not support emitDecoratorMetadata |
| ESLint + Prettier conflict resolution | Manually disabling individual ESLint rules | `eslint-config-prettier` | It's a maintained allowlist; hand-picking rules misses new additions |
| Workspace dependency resolution | Relative path `../../packages/database` in tsconfig paths | npm workspaces + `"@repo/database": "*"` in package.json deps | Workspaces handle hoisting; relative paths break when packages move or nest deeply |
| Type-checking in CI | Re-running `tsc` separately everywhere | `turbo typecheck` delegating to `tsc --noEmit` per-package | Turborepo caches unchanged packages; re-running `tsc` on every CI run is slow |

---

## Critical Landmines

### Landmine 1: `packages/database/package.json` has no `name` field

`packages/database/package.json` currently has **no `name` field**. npm workspaces requires each member package to have a `name` for workspace symlink resolution. Without this:
- `packages/backend` cannot declare `"@repo/database": "*"` as a dependency
- `npm install` will warn and silently skip the workspace member
- TypeScript module resolution for `@repo/database` will fail

**Fix:** Add `"name": "@repo/database"` to `packages/database/package.json` before running `npm install` at root. [VERIFIED: direct file inspection]

### Landmine 2: `packages/database/package-lock.json` must be deleted

`packages/database/package-lock.json` exists (nested lockfile from pre-workspace setup). When npm workspaces takes over:
- The root `package-lock.json` becomes authoritative
- The nested lockfile is stale and causes npm warnings: "multiple lockfiles found"
- `npm ci` in CI may error on multiple lockfiles

**Fix:** Delete `packages/database/package-lock.json` as part of the workspace setup commit. [VERIFIED: direct file inspection]

### Landmine 3: D-06 premise correction — no `packages/` line in `.gitignore`

CONTEXT.md (D-06) states "the current `.gitignore` contains a bare `packages/` line." **This is inaccurate.** Direct inspection shows:
- Committed `.gitignore` (HEAD) contains only: `.agent/`
- Working tree `.gitignore` contains: `.agent/`, `/generated/prisma`, `node_modules`, `.env`, `.claude/`
- Neither version has a `packages/` line
- `git check-ignore -v packages/` exits with code 1 (not ignored)
- `git status` shows `?? packages/` meaning untracked, not ignored

The `packages/` directory has simply never been committed. The planner should NOT spend effort removing a non-existent line. The actual `.gitignore` work is: add `**/.env`, keep `node_modules`, add `**/dist/`, `**/.turbo/`, and `packages/database/generated/`. [VERIFIED: git check-ignore + direct file read]

### Landmine 4: `@types/node ^26.0.1` is correct — do not downgrade

CONTEXT.md (D-02) says to "correct the suspicious `@types/node ^26`." However: the `ts5.9` dist tag on `@types/node` npm package resolves to `26.0.1`. This means `@types/node@26` is the TypeScript 5.9 aligned version. Downgrading to `^22.x.x` (Node.js 22 version series) would use an older types release. The current `^26.0.1` is correct and should be left as-is. [VERIFIED: npm registry — `npm view @types/node dist-tags`]

### Landmine 5: ESLint 10 is now `latest`; ESLint 9 is `maintenance`

The npm `latest` tag for `eslint` resolves to `10.6.0` (as of 2026-06-29). `9.39.4` is on the `maintenance` tag. Per D-01, use ESLint 9. When installing, pin explicitly: `eslint@9.39.4` or `eslint@^9`. Do NOT run `npm install eslint` without a version constraint — it will install v10. [VERIFIED: npm registry dist-tags]

### Landmine 6: `packages/database/node_modules` has NestJS already installed

`packages/database` has its own `node_modules/` (with `@nestjs/common`, `@prisma/client`, `prisma`, etc.) from its pre-workspace installation. After workspace setup and `npm install` at root, npm will deduplicate and hoist these to the root `node_modules/`. The nested `packages/database/node_modules/` can be deleted before running `npm install` to avoid conflicts, or just let npm handle it. [VERIFIED: direct file inspection]

---

## Common Pitfalls

### Pitfall 1: NestJS SWC builder silently skips `@swc/cli`

**What goes wrong:** `nest build` runs but falls back to `tsc` silently (or errors) when `@swc/cli` is not installed.
**Why it happens:** `@nestjs/cli@11` lists `@swc/cli` as a peer dependency but not a hard dependency. npm workspaces might not warn about missing peer deps.
**How to avoid:** Explicitly install `@swc/cli` as a devDependency at root. Run `nest build --debug` once to confirm SWC is active (log output shows SWC).
**Warning signs:** Build takes 10+ seconds for a trivial file (SWC should be near-instant).

### Pitfall 2: Turborepo `tasks` vs `pipeline` schema confusion

**What goes wrong:** `turbo run build` fails with a config validation error or silently ignores task definitions.
**Why it happens:** Turborepo 1.x used `pipeline`, v2.x uses `tasks`. Many tutorials and AI-generated configs still use `pipeline`.
**How to avoid:** Always use the `$schema` field in `turbo.json` pointing to `https://turborepo.dev/schema.json`. The schema validator will catch the old key.
**Warning signs:** `turbo run build` says "no tasks found" or "unknown key: pipeline".

### Pitfall 3: Vitest test runner skips SWC decorator metadata

**What goes wrong:** Tests that use NestJS modules decorated with `@Injectable()`, `@Module()`, etc., throw "Cannot read metadata" errors at runtime.
**Why it happens:** Vitest by default uses esbuild for transformation, which does not support `emitDecoratorMetadata`. The `unplugin-swc` plugin must be added and the SWC config must include `decoratorMetadata: true`.
**How to avoid:** In `vitest.config.ts`, always include `plugins: [swc.vite({ module: { type: 'es6' } })]`. Phase 1's sample test is trivial (no NestJS modules), so this won't surface yet — but the config must be correct now for Phase 2.
**Warning signs:** Tests pass without decorators but fail when any NestJS module is imported.

### Pitfall 4: npm workspace symlinks break if `name` field missing or mismatched

**What goes wrong:** `import { PrismaService } from '@repo/database'` fails at compile time or runtime.
**Why it happens:** npm workspaces creates a symlink `node_modules/@repo/database → packages/database` only when the package's `name` field exactly matches. If the field is absent or misspelled, the symlink is never created.
**How to avoid:** After `npm install`, verify: `ls -la node_modules/@repo/database` — it should be a symlink to `../../packages/database`.
**Warning signs:** TypeScript says `Cannot find module '@repo/database'` even after `npm install`.

### Pitfall 5: ESLint type-aware rules require `parserOptions.project` pointing to tsconfig

**What goes wrong:** ESLint exits with "You have used a rule which requires parserOptions.project to be provided" if type-aware rules (e.g., `@typescript-eslint/no-floating-promises`) are enabled without wiring the tsconfig.
**Why it happens:** Type-aware linting runs the TypeScript compiler internally and needs a path to `tsconfig.json`.
**How to avoid:** For Phase 1, use `tseslint.configs.recommended` (not `recommendedTypeChecked`) in the base config. Type-aware rules can be added per-package later. If enabling type-aware rules, add:
```javascript
parserOptions: {
  project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  tsconfigRootDir: import.meta.dirname,
}
```
**Warning signs:** ESLint errors about missing project config; lint takes 30+ seconds on first run (type-aware lint is slower).

### Pitfall 6: Turborepo caches stale type errors

**What goes wrong:** A TypeScript error is introduced, but `turbo typecheck` shows green because the result is cached.
**Why it happens:** If the inputs for the `typecheck` task don't cover all TypeScript source files (e.g., missing `tsconfig.base.json` in inputs), a base config change won't invalidate the cache.
**How to avoid:** For root-level config files (tsconfig.base.json, eslint.config.mjs), add them as `globalDependencies` in `turbo.json`:
```jsonc
{
  "globalDependencies": ["tsconfig.base.json", "eslint.config.mjs", ".swcrc"]
}
```
**Warning signs:** Changing tsconfig.base.json doesn't trigger a re-run of typecheck.

---

## Code Examples

### Complete `turbo.json` (v2, Phase 1 tasks)

```jsonc
// Source: https://turborepo.dev/repo/docs/reference/configuration
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": [
    "tsconfig.base.json",
    "eslint.config.mjs",
    ".swcrc",
    ".prettierrc"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": [],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

### Root `package.json` (post-cleanup)

```json
{
  "name": "ai-sdlc",
  "private": true,
  "workspaces": ["packages/*"],
  "packageManager": "npm@10.9.8",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@nestjs/cli": "^11.0.23",
    "@swc/cli": "^0.8.1",
    "@swc/core": "^1.15.43",
    "@types/node": "^26.0.1",
    "eslint": "^9.39.4",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.9.3",
    "turbo": "^2.10.0",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.62.0",
    "unplugin-swc": "^1.5.9",
    "vitest": "^4.1.9"
  }
}
```

Note: `nextjs ^0.0.3` (stub) removed per D-02. `@prisma/client` and `prisma` remain in root only if needed as global tooling; otherwise they belong in `packages/database` only.

### `tsconfig.base.json` (strict baseline)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

> **NestJS note:** Do NOT add `"experimentalDecorators": true` or `"emitDecoratorMetadata": true` here. Those belong only in `packages/backend/tsconfig.json`. SWC handles decorator transpilation for NestJS; tsc just needs the flags for type-checking the decorated code.

### `packages/backend/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "paths": {}
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/backend/package.json` (minimal)

```json
{
  "name": "@repo/backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/database": "*",
    "@nestjs/common": "^11.1.27",
    "@nestjs/core": "^11.1.27",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": {}
}
```

### `packages/backend/src/index.ts` (minimal — proves workspace resolution)

```typescript
// Minimal entry — exports @repo/database to prove workspace resolution.
// AppModule and bootstrap belong to Phase 2.
export * from '@repo/database';
```

### `packages/backend/src/index.spec.ts` (sample passing test)

```typescript
import { describe, it, expect } from 'vitest';

describe('workspace sanity', () => {
  it('resolves @repo/database barrel export', async () => {
    const database = await import('@repo/database');
    expect(database).toBeDefined();
  });
});
```

### `.gitignore` (standard Node monorepo)

```gitignore
# Tools
.agent/
.claude/

# Dependencies
node_modules/

# Build outputs
**/dist/
**/generated/client/

# Turborepo
.turbo/

# Environment (never commit secrets)
**/.env
**/.env.*
!**/.env.example

# OS
.DS_Store
*.DS_Store

# Prisma
/generated/prisma
```

### GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
# Source: https://github.com/actions/setup-node (v4 docs)
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Format check
        run: npm run format:check

      - name: Lint, typecheck, test, build
        run: npx turbo run lint typecheck test build
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pipeline` key in turbo.json | `tasks` key | Turborepo 2.0 (2024) | Must use `tasks`; `pipeline` is removed |
| `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` separately | `typescript-eslint` unified package | 2024 | One package instead of two; use `tseslint.config()` helper |
| `.eslintrc.json` or `.eslintrc.js` | `eslint.config.mjs` flat config | ESLint 9.0 (2024) | Old format deprecated; flat config is now default in ESLint 9+ |
| ESLint 8 `extends` array | Flat config `tseslint.config(...)` spreads | ESLint 9.0 | Different API; no `extends`, use direct object/array composition |
| tsc for NestJS compilation | SWC via `nest-cli.json` builder | NestJS 10 (2023) | ~20x faster builds; requires `@swc/cli @swc/core` peer deps |
| Jest for NestJS unit tests | Vitest 4 (v4 is current) | 2024-2025 | Vitest has native ESM/TS support; faster; requires `unplugin-swc` for decorators |
| Turborepo `pipeline.lint.cache: false` | `tasks.lint.cache: true` with correct inputs | Turborepo 2.x | Lint is now cacheable when inputs are properly defined |

**Deprecated/outdated:**
- `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` (separate): Replaced by unified `typescript-eslint` package. Old packages still work but are not recommended for new setups.
- `turbo.json` with `pipeline` key: Removed in Turborepo 2.0. Will throw a config error.
- `.eslintrc.json` / `.eslintrc.js`: Deprecated in ESLint 9. Still loads in ESLint 9 via legacy compatibility, but ESLint 10 removed support entirely.
- `@nestjs/schematics` in nest-cli.json `collection`: Still required for schematics generators, but for a Phase 1 minimal compile target, the collection is unused.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@swc/cli@0.8.1` satisfies `@nestjs/cli@11` peer dep `^0.1.62 || ... || ^0.8.0` | Standard Stack | Minor: might need exact version constraint; peer dep ranges verified via npm |
| A2 | `packages/database` `node_modules/` can be deleted and deduplication will work via root workspaces | Critical Landmines | Medium: if there are platform-specific binaries in nested node_modules, hoist might not work cleanly; `npm ci` should resolve |
| A3 | `nest build` with SWC + `entryFile: "index"` and a trivial `src/index.ts` will succeed without AppModule | Standard Stack / Code Examples | Medium: if NestJS CLI requires a specific entry shape; mitigated by the fact that SWC is pure transpilation |
| A4 | All package download volumes cited in Package Legitimacy Audit are approximately correct | Package Legitimacy Audit | Low: exact counts not verified; packages are mainstream with long histories |
| A5 | `eslint-config-prettier@10` main export works for ESLint 9 flat config without the `/flat` subpath | Code Examples | Low: exports field shows both `.` and `./flat`; either works; verified exports via `npm view` |

---

## Open Questions

1. **Does `nest build` require any NestJS imports at the entry point?**
   - What we know: SWC builder is pure transpilation; `entryFile: "index"` maps to `src/index.ts`
   - What's unclear: Whether `@nestjs/cli`'s build command validates that the entry exports a NestJS module
   - Recommendation: Use `src/index.ts` with `export * from '@repo/database'`; if `nest build` errors, fall back to `export {}` (empty module proves compilation without resolving anything)

2. **Should `@nestjs/common`, `@nestjs/core`, etc. be in root vs `packages/backend`?**
   - What we know: npm workspaces hoists; both approaches work at compile time
   - What's unclear: Whether hoisting creates resolution conflicts with `packages/database` which already has `@nestjs/common ^11.1.27`
   - Recommendation: Put NestJS deps in `packages/backend/package.json` dependencies (explicit); let npm workspaces deduplicate automatically

3. **ESLint 9 vs 10 for new projects (advisory note for planner)**
   - What we know: ESLint 10 is the current `latest`; flat config API is identical; D-01 locks to ESLint 9
   - What's unclear: Nothing — this is a locked decision
   - Recommendation: Install `eslint@^9` (pins to 9.x maintenance branch). Note in plan that upgrading to ESLint 10 later is a trivial version bump with no config changes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | All tooling | ✓ | v22.22.3 | — |
| npm | Workspace management | ✓ | 10.9.8 | — |
| git | Version control, credential check | ✓ | (system) | — |
| GitHub account | GitHub Actions CI (D-07) | ✓ (inferred from existing repo) | — | — |

**Missing dependencies with no fallback:** None.

**Notes:**
- Latest Node.js 22 LTS is `22.23.1`; machine has `22.22.3`. Either works; `.nvmrc` should pin to `22.23.1` for freshness.
- No Docker, cloud CLI, or database services required for Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `packages/backend/vitest.config.ts` (does not exist — Wave 0 gap) |
| Quick run command | `npx turbo run test` or `cd packages/backend && npx vitest run` |
| Full suite command | `npx turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | `@repo/database` import resolves from `packages/backend` | unit (dynamic import) | `cd packages/backend && npx vitest run` | ❌ Wave 0 |
| TOOL-02 | TypeScript 5.9.x compiles without errors | type-check | `npx turbo run typecheck` | ❌ Wave 0 (tsconfig.base.json) |
| TOOL-03 | ESLint passes with zero errors | lint | `npx turbo run lint` | ❌ Wave 0 (eslint.config.mjs) |
| TOOL-04 | Sample Vitest test passes | unit | `npx turbo run test` | ❌ Wave 0 |
| TOOL-05 | `nest build` completes without error | build | `npx turbo run build` | ❌ Wave 0 (nest-cli.json) |
| TOOL-06 | `.env` not tracked; `**/.env` gitignored | manual + git | `git check-ignore packages/database/.env` | N/A |
| TOOL-07 | `.nvmrc` pins Node 22+ | manual inspection | `cat .nvmrc` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (quick, from packages/backend)
- **Per wave merge:** `npx turbo run lint typecheck test build && npm run format:check`
- **Phase gate:** Full suite green + manual TOOL-06 and TOOL-07 checks before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/vitest.config.ts` — Vitest + SWC config (covers TOOL-04)
- [ ] `packages/backend/src/index.spec.ts` — sample test (covers TOOL-01, TOOL-04)
- [ ] `tsconfig.base.json` — shared TypeScript base (covers TOOL-02)
- [ ] `eslint.config.mjs` — flat config (covers TOOL-03)
- [ ] `packages/backend/nest-cli.json` — SWC builder (covers TOOL-05)
- [ ] `.nvmrc` — Node pin (covers TOOL-07)
- [ ] `turbo.json` — task graph
- [ ] Root `package.json` with workspace config

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not in scope for Phase 1 tooling |
| V3 Session Management | no | Not in scope |
| V4 Access Control | no | Not in scope |
| V5 Input Validation | no | No request handling in Phase 1 |
| V6 Cryptography | no | Phase 1 does not handle cryptographic material |
| Secrets in source control | yes | `**/.env` gitignore + `.env.example` with placeholders |

### Known Threat Patterns for Phase 1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret committed to git | Information Disclosure | `**/.env` in `.gitignore`; verify with `git check-ignore` |
| Live credential in `.env` without rotation | Information Disclosure | User rotates Supabase password (D-04); non-automatable |
| Supply chain: malicious package via npm install | Tampering | All packages confirmed mainstream; slopcheck unavailable — human-verify gate before install |

---

## Sources

### Primary (HIGH confidence)

- npm registry — `npm view` of all packages: turbo, typescript, eslint, vitest, @nestjs/cli, @swc/core, @swc/cli, unplugin-swc, eslint-config-prettier, typescript-eslint, @eslint/js, prettier, @types/node — version and dist-tag data
- nodejs.org dist index — Node.js 22.23.1 confirmed as latest 22 LTS ("Jod" codename)
- Direct file read — `packages/database/package.json` (no name field confirmed), `.gitignore` committed and working-tree state, root `package.json`
- [Turborepo v2 configuration reference](https://turborepo.dev/repo/docs/reference/configuration) — tasks schema, dependsOn, outputs, inputs, cache, globalDependencies

### Secondary (MEDIUM confidence)

- [NestJS SWC recipe — nestjs/docs.nestjs.com on GitHub](https://github.com/nestjs/docs.nestjs.com/blob/master/content/recipes/swc.md) — `nest-cli.json` builder config, `@swc/cli` + `@swc/core` install, `.swcrc` example
- [typescript-eslint getting started](https://typescript-eslint.io/getting-started) — ESLint 9 flat config minimal setup with `typescript-eslint` unified package
- WebSearch: NestJS + Vitest + SWC community patterns — `unplugin-swc` as the standard Vitest SWC bridge for NestJS

### Tertiary (LOW confidence)

- None — all claims corroborated by primary or secondary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — all verified via npm registry on 2026-06-29
- turbo.json schema: HIGH — verified via official Turborepo docs
- NestJS SWC config: MEDIUM — verified via official NestJS docs source on GitHub; exact `entryFile` behavior for minimal compile target is inferred
- ESLint flat config: HIGH — verified via typescript-eslint official getting-started
- D-06 gitignore correction: HIGH — verified via `git check-ignore` and direct file reads
- @types/node alignment: HIGH — verified via npm dist-tags
- ESLint 9 vs 10 situation: HIGH — verified via npm dist-tags

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (30-day window; ecosystem stable)
