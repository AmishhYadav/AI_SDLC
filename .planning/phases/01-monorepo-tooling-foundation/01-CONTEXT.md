# Phase 1: Monorepo & Tooling Foundation - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a verifiable build/lint/format/test toolchain so every later phase can meet the Definition of Done, and remediate the exposed database credential.

**In scope (TOOL-01…TOOL-07):**
- npm workspaces at the repo root so `packages/backend` resolves `@repo/database` with no path hacks.
- Shared strict TypeScript base config (`tsconfig.base.json`), TypeScript pinned to 5.9.x (not 6.0).
- ESLint 9 flat config + Prettier, passing across the repo.
- Vitest 4 (with SWC) runner with a passing sample test.
- NestJS build/dev tooling (`nest-cli.json` with SWC builder) compiling `packages/backend`.
- `.gitignore` excludes all `**/.env`; the live DB credential is rotated.
- Node pinned via `.nvmrc` to a Node 22+ LTS.
- A minimal `packages/backend` package that exists only to satisfy workspace resolution and `nest build`.

**Out of scope (defer to later phases):**
- Real NestJS application bootstrap, config, error contract, Prisma wiring → Phase 2.
- Cross-domain boundary lint rules (eslint-plugin-boundaries / dependency-cruiser) → Phase 9.
- Any change to the frozen `@repo/database` schema.
- Frontend tooling (no Next.js this milestone).

</domain>

<decisions>
## Implementation Decisions

### Monorepo Tooling
- **D-01:** Use npm workspaces **plus Turborepo** for cached, parallel task orchestration (`lint`, `test`, `typecheck`, `build`) across packages. Chosen deliberately over workspaces-only because this foundation must carry 14 domains + a future frontend; the caching/orchestration payoff compounds as packages multiply. This is a small, intentional expansion beyond the literal TOOL-01 wording (which only requires workspaces).
- **D-02:** Root `package.json` becomes the workspace root (`workspaces: ["packages/*"]`) with scripts delegating to Turborepo. Clean up the existing junk root deps while here: remove the `nextjs ^0.0.3` stub (not real Next.js, and frontend is out of scope) and correct the suspicious `@types/node ^26` to a Node 22-aligned version.

### Credential Remediation (TOOL-06)
- **D-03:** **Premise correction — the credential was never committed to git.** `git log`/`git ls-files` show no `.env` and no `packages/` content has ever been tracked, and no secret value appears anywhere in history. The "previously-committed DATABASE_URL" framing in REQUIREMENTS.md (TOOL-06) and STATE.md is inaccurate. **No git-history purge is required.**
- **D-04:** The secret is nonetheless **real and currently valid** — a remote Supabase Postgres credential (`db.begukmntfkygqjpndbxt.supabase.co`), not a non-sensitive local Prisma-dev key. **Rotate it:** the plan must instruct the user to rotate the Supabase password in the Supabase dashboard and update local `packages/database/.env`.
- **D-05:** Add `**/.env` to `.gitignore` (current entry is a bare `.env`) and commit a `packages/database/.env.example` documenting required vars with placeholder values (no secrets).

### `.gitignore` (blocking structural fix)
- **D-06:** **The current `.gitignore` contains a bare `packages/` line, which ignores the entire `packages/` tree — neither `packages/database` nor the new `packages/backend` is tracked by git (`git ls-files packages` → 0).** This directly blocks TOOL-01. Rewrite `.gitignore` to a standard Node monorepo ignore set: remove the `packages/` ignore, keep `node_modules`, ignored build/`generated` output, `.env`/`**/.env`, `.DS_Store`, and `.agent/`/`.claude/` as appropriate. After the fix, `packages/database` and `packages/backend` must be trackable/committable.

### CI Pipeline
- **D-07:** **Set up CI now** — a GitHub Actions workflow that runs install + `lint` + `format:check` + `typecheck` + `test` + `build` (driven through Turborepo) on push/PR. Wiring the real Definition-of-Done gate now is required because later phases (e.g. Phase 9 boundary rules) already assume a "fail CI" mechanism exists.

### Backend Package Scope (Claude's discretion → decided)
- **D-08:** `packages/backend` is a **minimal compile target only** this phase: package name `@repo/backend`, dependency on `@repo/database`, `tsconfig.json` extending `tsconfig.base.json`, `nest-cli.json` (SWC builder), and the smallest source needed for `nest build` to succeed and to prove workspace resolution of `@repo/database`. **No** `main.ts` bootstrap, AppModule, config, or routes — that is Phase 2's scope. Avoid blurring into Phase 2.

### Claude's Discretion
- Turborepo pipeline/task graph specifics (`turbo.json` task definitions, cache inputs/outputs).
- ESLint 9 flat-config ruleset details, including whether to enable type-aware (`typescript-eslint` with type info) linting at the base level.
- Exact Node 22 LTS version string written to `.nvmrc`.
- Exact `tsconfig.base.json` strictness flag set (beyond `strict: true`).
- Vitest 4 + SWC config layout and the sample test's location/shape.
- Precise final `.gitignore` contents and root `package.json` cleanup edits.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Tooling & Monorepo" — TOOL-01…TOOL-07, the authoritative requirement text for this phase.
- `.planning/ROADMAP.md` § "Phase 1: Monorepo & Tooling Foundation" — goal and 5 success criteria (the verification gate).
- `.planning/PROJECT.md` § Constraints / Context — fixed stack (NestJS 11.1.x, Prisma 6.19.x, TS, Node 22+, npm), layering constraint, "Tooling gap" note.

### Codebase state (current reality)
- `.planning/codebase/STACK.md` — confirms no build/lint/format/test tooling exists; documents the `nextjs ^0.0.3` stub, missing `.nvmrc`, and the `packages/database` layout.
- `.planning/codebase/STRUCTURE.md` — current package layout and planned `packages/backend` / `packages/frontend` shape.
- `packages/database/package.json` — existing package to be referenced as `@repo/database` (note: it currently has no `name` field; confirm/set the workspace package name during planning).

### Authoritative design source (for tooling conventions, if any)
- `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/` — check for any prescribed CI/CD, Node version, or toolchain conventions before finalizing CI and `.nvmrc` choices.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/database` — the only implemented package. Exposes a global NestJS `PrismaModule`/`PrismaService` (Prisma 6.19.3, split-schema at `prisma/schema`). Will become the `@repo/database` workspace dependency of `packages/backend`. **Do not modify the schema.**

### Established Patterns
- Seed/tooling already relies on Node 22+ native TS (`node --experimental-strip-types`), reinforcing the Node 22+ `.nvmrc` pin.
- Conventions (from PROJECT.md): kebab-case module dirs; files `[domain].service.ts` / `.controller.ts` / `.repository.ts` / `.module.ts`. Relevant later, but ESLint/Prettier defaults should not fight these.

### Integration Points
- Root `package.json` + `package-lock.json` become the workspace manifest; `packages/database` and `packages/backend` are the workspace members.
- `packages/database/package.json` may need a `name` (`@repo/database`) for workspace resolution — verify at plan time.

### Landmines
- `.gitignore` ignores `packages/` (see D-06) — nothing under `packages/` is tracked today; fixing this is prerequisite to committing any new package.
- Stray artifacts present: `packages/database/prisma.zip`, multiple `.DS_Store` files — make sure `.gitignore` covers `.DS_Store` and that artifacts aren't accidentally committed.
- `packages/database` currently has its own `package-lock.json` — once it's a workspace member, the root lockfile is authoritative; reconcile to avoid dual lockfiles.

</code_context>

<specifics>
## Specific Ideas

- Library versions are pinned by requirement: TypeScript 5.9.x (explicitly not 6.0), ESLint 9 (flat config), Vitest 4, Turborepo for orchestration, SWC as the builder for both Nest and Vitest.

</specifics>

<deferred>
## Deferred Ideas

- Cross-domain / layer boundary enforcement (eslint-plugin-boundaries, dependency-cruiser) — Phase 9 (SCAF-05).
- Real NestJS app bootstrap, typed config, error envelope, Prisma wiring — Phase 2.
- Frontend tooling (Next.js, Tailwind, shadcn/ui) — future milestone.
- **Suggested REQUIREMENTS.md/STATE.md correction:** TOOL-06's "previously-committed DATABASE_URL" wording should be amended to reflect that the secret was never in git (working-tree only) — rotation still warranted, history purge not needed. Note for the next `/gsd-transition` or a doc fix.

</deferred>

---

*Phase: 1-Monorepo & Tooling Foundation*
*Context gathered: 2026-06-29*
