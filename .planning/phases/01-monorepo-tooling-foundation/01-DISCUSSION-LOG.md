# Phase 1: Monorepo & Tooling Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 1-Monorepo & Tooling Foundation
**Areas discussed:** Monorepo tooling, Credential remediation, CI pipeline, Backend package scope

---

## Monorepo Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| npm workspaces only | Plain npm workspaces, root scripts delegate; simplest, matches TOOL-01 exactly | |
| Workspaces + Turborepo | Add Turborepo for cached, parallel lint/test/build across packages | ✓ |
| You decide | Let Claude weigh it and default to simplest | |

**User's choice:** Workspaces + Turborepo
**Notes:** Chosen with awareness it's a small expansion beyond TOOL-01's literal wording; justified by the 14-domain + future-frontend scale of the foundation.

---

## Credential Remediation

| Option | Description | Selected |
|--------|-------------|----------|
| Rotate + gitignore + .env.example | Rotate Supabase password, ignore **/.env, add committed .env.example | ✓ (after reconsideration) |
| Gitignore + .env.example only | Skip rotation since never in git; live secret stays valid | (initially chosen) |
| Rotate + also scrub artifacts | Above + remove stray artifacts (prisma.zip, .DS_Store) | |

**User's choice:** Initially "Gitignore + .env.example only"; after Claude flagged that the secret is a real, currently-valid remote Supabase credential (not a non-sensitive local Prisma-dev key), user changed to "OK, rotate too."
**Notes:** Key finding surfaced during discussion — the credential was NEVER committed to git (only in the working-tree `.env`), so TOOL-06's "previously-committed" premise is inaccurate and no history purge is needed. Rotation retained because the secret is live.

---

## CI Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Set up CI now | GitHub Actions running lint/format/typecheck/test/build as the DoD gate | ✓ |
| Defer CI to later | Local tooling only; CI/CD is a future deployment milestone | |
| You decide | Pick based on later-phase dependence on a real CI gate | |

**User's choice:** Set up CI now
**Notes:** Later phases (esp. Phase 9 boundary enforcement) already assume a "fail CI" mechanism, so the runner should exist from Phase 1.

---

## Backend Package Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal compile target | Just enough for `nest build` + workspace resolution of @repo/database | ✓ (via "You decide") |
| Bootstrap stub too | Include a minimal main.ts/app.module that boots (blurs into Phase 2) | |
| You decide | Keep to the minimum satisfying TOOL-01/TOOL-05 | ✓ |

**User's choice:** You decide → Claude decided "Minimal compile target" (no bootstrap; that's Phase 2).
**Notes:** Explicitly avoids overlap with Phase 2's real application bootstrap.

---

## Claude's Discretion

- Turborepo `turbo.json` task graph and cache config.
- ESLint 9 flat-config ruleset, including whether to enable type-aware linting at the base level.
- Exact Node 22 LTS string in `.nvmrc`.
- `tsconfig.base.json` strictness flags beyond `strict: true`.
- Vitest 4 + SWC config layout and sample test shape.
- Final `.gitignore` contents and root `package.json` cleanup (remove `nextjs ^0.0.3` stub, fix `@types/node ^26`).
- Minimal `packages/backend` contents.

## Deferred Ideas

- Boundary enforcement lint rules → Phase 9.
- Real NestJS bootstrap/config/error contract → Phase 2.
- Frontend tooling → future milestone.
- Amend TOOL-06 wording in REQUIREMENTS.md/STATE.md ("previously-committed" → working-tree-only secret; rotation yes, history purge no).
