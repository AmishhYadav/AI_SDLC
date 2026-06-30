---
phase: 01
status: has-findings
depth: standard
reviewed_at: 2026-06-30T00:00:00Z
critical_count: 2
warning_count: 7
info_count: 5
---

# Code Review — Phase 01: Monorepo & Tooling Foundation

## Summary

Phase 01 establishes the monorepo scaffolding: npm workspaces, Turborepo, TypeScript/ESLint/Prettier configs, a NestJS backend skeleton, and a Prisma database package. Two blockers exist that will prevent CI from passing: the `eslint --ext` flag was removed in ESLint v9, and GitHub Actions are not pinned to immutable SHAs (supply-chain vulnerability). Seven additional warnings cover a dead Turbo cache dependency, a misleading `PrismaService.enableShutdownHooks` implementation, missing Prisma client generation automation, and several structural package issues.

---

## Findings

### Critical

---

#### CR-01: `eslint --ext .ts` flag removed in ESLint v9 — CI lint always fails

**Files:**
- `packages/backend/package.json:8`
- `packages/database/package.json:7`

**Issue:** Both packages define their `lint` script as `eslint src --ext .ts`. The `--ext` option was removed in ESLint v9 flat config. The root workspace requires `eslint ^9.39.4` and uses flat config (`eslint.config.mjs`). Running `turbo run lint` will fail immediately for both packages with `Unknown option '--ext'`. The CI lint gate is permanently broken as written.

**Fix:** Replace the `--ext` flag with a glob pattern, which is how ESLint v9 specifies file extensions:

```json
// packages/backend/package.json
"lint": "eslint 'src/**/*.ts'"

// packages/database/package.json
"lint": "eslint 'src/**/*.ts'"
```

---

#### CR-02: GitHub Actions pinned to mutable semver tags — supply-chain vulnerability

**File:** `.github/workflows/ci.yml:15,18`

**Issue:** Both `actions/checkout@v4` and `actions/setup-node@v4` use mutable floating tags. If either upstream action repository is compromised and the `v4` tag is force-pushed to malicious code, CI will execute that code with full access to the runner environment, secrets, and the `GITHUB_TOKEN`. For an enterprise platform, this is a direct supply-chain attack vector.

**Fix:** Pin to immutable commit SHAs. Fetch current SHAs and lock them:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
```

Maintain pins via Dependabot or Renovate with `actions` ecosystem support.

---

### Warning

---

#### WR-01: No `permissions:` block — GITHUB_TOKEN has excessive default scopes

**File:** `.github/workflows/ci.yml`

**Issue:** No `permissions:` key is declared at the workflow or job level. For private repositories, GitHub's default `GITHUB_TOKEN` permissions include write access to `contents`, `packages`, `pull-requests`, and other scopes. The CI workflow only reads code and runs checks — it needs no write permissions. Violates the principle of least privilege.

**Fix:** Add a top-level permissions block that grants only what is required:

```yaml
permissions:
  contents: read
```

---

#### WR-02: `turbo.json` globalDependency `.swcrc` does not exist at the workspace root

**File:** `turbo.json:3`

**Issue:** `"globalDependencies": ["tsconfig.base.json", "eslint.config.mjs", ".swcrc", ".prettierrc"]` — Turbo resolves `globalDependencies` relative to the workspace root. The only `.swcrc` file is at `packages/backend/.swcrc`. No `.swcrc` exists at the root. Turbo silently ignores the missing file, meaning changes to `packages/backend/.swcrc` do not invalidate the cache. A developer updating SWC transform options (e.g., decorator settings) may see stale cached build or test results.

**Fix:** Either move `.swcrc` to the workspace root (if it applies globally) or remove it from `globalDependencies` and rely on the package-level cache key. If it should remain package-scoped, reference it correctly:

```json
// Option A: move .swcrc to root and keep globalDependencies as-is
// Option B: remove ".swcrc" from globalDependencies; the backend package
//           will pick up changes through its own file hash
```

---

#### WR-03: `PrismaService.enableShutdownHooks` uses `beforeExit` — silent no-op on signal-based shutdown

**File:** `packages/database/src/prisma.service.ts:14-18`

**Issue:** `process.on('beforeExit', async () => { await app.close(); })` fires only when the Node.js event loop drains naturally. It does **not** fire when the process receives `SIGTERM` or `SIGINT` — the signals sent by Docker, Kubernetes, and most process supervisors for graceful shutdown. Any call site that uses this method for graceful termination gets false assurance: `app.close()` will never be called during a container restart or `kubectl rollout`. This is a latent data-safety issue for a production platform.

Additionally, each call to `enableShutdownHooks` adds a new `beforeExit` listener without removing the previous one. Repeated calls (e.g., across test suites) will accumulate listeners and trigger `MaxListenersExceededWarning`.

**Fix:** Remove the method entirely. `OnModuleInit` / `OnModuleDestroy` are sufficient — NestJS calls `onModuleDestroy` (and therefore `$disconnect`) automatically when `app.enableShutdownHooks()` is enabled in the bootstrap and a SIGTERM/SIGINT is received:

```typescript
// prisma.service.ts — remove enableShutdownHooks entirely

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

In the bootstrap (Phase 2), call `app.enableShutdownHooks()` before `app.listen()`.

---

#### WR-04: `prisma` CLI listed under `dependencies` instead of `devDependencies`

**File:** `packages/database/package.json:12`

**Issue:** The `prisma` package (the Prisma CLI for running migrations and `prisma generate`) is a development tool. Listing it under `dependencies` means it is installed in the production `node_modules`, adding unnecessary weight (~50 MB). Only `@prisma/client` belongs in `dependencies`.

**Fix:**

```json
"dependencies": {
  "@nestjs/common": "^11.1.27",
  "@prisma/client": "^6.0.0"
},
"devDependencies": {
  "prisma": "^6.0.0"
}
```

---

#### WR-05: Generated Prisma client is gitignored but no automation exists to generate it

**File:** `packages/database/src/index.ts:3`

**Issue:** `export * from '../generated/client'` references `packages/database/generated/client`, which is gitignored and only exists after `prisma generate` is run. There is no `postinstall` script, `prepare` hook, or CI step to generate the client automatically. On a fresh clone, `npm ci` followed by `turbo run typecheck` or `turbo run test` will fail immediately with `Cannot find module '../generated/client'`. The seed file at `prisma/seed.ts:1` has the same dependency and will also fail.

**Fix:** Add a `postinstall` (or `prepare`) script to the database package so the client is regenerated automatically after `npm ci`:

```json
// packages/database/package.json
"scripts": {
  "generate": "prisma generate",
  "postinstall": "prisma generate",
  "typecheck": "tsc --noEmit",
  "lint": "eslint 'src/**/*.ts'"
}
```

Alternatively, add `prisma generate` as an explicit step in the CI workflow before the Turbo tasks run.

---

#### WR-06: Database package has no `build` script — silently skipped by Turbo

**File:** `packages/database/package.json`

**Issue:** `turbo run build` only executes `build` scripts that exist. `@repo/database` has no `build` script, so it is silently skipped. The backend's `nest build` bundles the database source directly via SWC, so the production build works today, but this is an implicit coupling. Any tooling that expects `@repo/database` to have a `dist/` output (e.g., a future service that imports it outside NestJS) will find nothing. The `"main": "src/index.ts"` field also points to a TypeScript source file, which is only resolvable by a TypeScript-aware toolchain.

**Fix:** Add a build script and update `main` to reflect the compiled output:

```json
// packages/database/package.json
"main": "dist/index.js",
"scripts": {
  "build": "tsc --project tsconfig.json",
  "postinstall": "prisma generate",
  "typecheck": "tsc --noEmit",
  "lint": "eslint 'src/**/*.ts'"
}
```

---

#### WR-07: `seed.ts` uses `require()` — all Prisma types silently become `any`

**File:** `packages/database/prisma/seed.ts:1`

**Issue:** `const { PrismaClient } = require('../generated/client')` is a CommonJS `require()` call inside a TypeScript file. The `require()` return type is `any`, which means `prisma` and every result of every Prisma query is `any`. Type errors in seed data (wrong field names, mistyped values, missing required fields) are invisible to TypeScript. The upsert helper `upsertConfiguration` at line 274 also lacks parameter types for the same reason.

**Fix:** Use a typed ESM import consistent with the rest of the codebase:

```typescript
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();
```

Also add parameter types to `upsertConfiguration`:

```typescript
async function upsertConfiguration(
  organizationId: string,
  key: string,
  value: unknown,
  description: string,
) { ... }
```

---

### Info

---

#### IN-01: `.nvmrc` pins patch version; CI uses major-only version — potential drift

**Files:** `.nvmrc:1`, `.github/workflows/ci.yml:20`

**Issue:** `.nvmrc` pins `22.23.1` for local development. CI uses `node-version: '22'`, which resolves to the latest Node.js 22.x at the time the runner image is provisioned. If a regression is introduced in a future patch release, CI and local development could diverge in behavior without an obvious cause.

**Fix:** Align CI to the exact version from `.nvmrc`:

```yaml
node-version-file: '.nvmrc'
```

This is the `actions/setup-node` recommended approach for pinning from `.nvmrc`.

---

#### IN-02: `vitest.config.ts` enables `globals: true` but test file imports explicitly from `vitest`

**Files:** `packages/backend/vitest.config.ts:7`, `packages/backend/src/index.spec.ts:1`

**Issue:** `globals: true` injects `describe`, `it`, `expect`, etc. as globals. The test file still imports them explicitly with `import { describe, it, expect } from 'vitest'`. This is redundant. It also means if `globals` is ever disabled, the test file continues to work (imports are explicit), but developers may write new tests relying on globals and get an inconsistent experience.

**Fix:** Either remove `globals: true` from `vitest.config.ts` (prefer explicit imports) or remove the imports from the test file. The project convention for future tests should be documented consistently.

---

#### IN-03: Sanity test assertion always passes regardless of export shape

**File:** `packages/backend/src/index.spec.ts:6`

**Issue:** `expect(database).toBeDefined()` passes as long as the dynamic import resolves to any value — including an empty object `{}`. It does not verify that the expected exports (`PrismaService`, `PrismaModule`) are actually present and correctly shaped. If the barrel export in `index.ts` is broken in a way that produces an empty module, this test will still pass.

**Fix:** Assert the specific exports that the workspace resolution is meant to prove:

```typescript
it('resolves @repo/database barrel export', async () => {
  const { PrismaService, PrismaModule } = await import('@repo/database');
  expect(PrismaService).toBeDefined();
  expect(PrismaModule).toBeDefined();
});
```

---

#### IN-04: `packages/database/tsconfig.json` missing `emitDecoratorMetadata: true`

**File:** `packages/database/tsconfig.json`

**Issue:** `PrismaService` and `PrismaModule` use NestJS decorators (`@Injectable`, `@Global`, `@Module`) that rely on TypeScript's decorator metadata emission for dependency injection. The database `tsconfig.json` has `experimentalDecorators: true` but omits `emitDecoratorMetadata: true`. At runtime this is covered by SWC's `decoratorMetadata: true` in `.swcrc`. However, the TypeScript config is inconsistent with the backend's `tsconfig.json` and may confuse developers who expect both settings to be present wherever decorators are used.

**Fix:** Add the setting for consistency:

```json
"compilerOptions": {
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true,
  ...
}
```

---

#### IN-05: `moduleResolution: "Node"` is the deprecated legacy resolver

**File:** `tsconfig.base.json:7`

**Issue:** `"moduleResolution": "Node"` uses the legacy Node.js CommonJS resolution algorithm, which predates `exports` field support in `package.json`. It is deprecated in TypeScript 5.x. Prisma v6, NestJS 11, and other modern packages may ship `exports` maps that the legacy resolver does not fully honour, leading to subtle resolution mismatches.

**Fix:** For a CJS NestJS project on Node.js 22, the correct setting is `"moduleResolution": "Node16"` (or `"Bundler"` if using a bundler for all output). Update alongside `"module"`:

```json
"module": "Node16",
"moduleResolution": "Node16"
```

Verify that existing imports resolve correctly after the change, as `Node16` enforces explicit extensions in relative imports.

---

_Reviewed: 2026-06-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
