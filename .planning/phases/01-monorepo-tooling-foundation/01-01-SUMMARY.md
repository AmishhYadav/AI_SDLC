---
phase: 01-monorepo-tooling-foundation
plan: "01"
subsystem: infra
tags: [gitignore, npm-workspaces, supabase, prisma, secrets]

requires: []

provides:
  - ".gitignore with **/.env glob and !**/.env.example negation — blocks secrets across all monorepo packages"
  - "packages/database/package.json with name @repo/database — unblocks npm workspace symlink creation"
  - "packages/database/.env.example with DATABASE_URL placeholder — documents required env var safely"
  - "packages/database/package-lock.json removed — root workspace lockfile becomes authoritative"
  - "Live Supabase credential rotated — old password invalidated before any CI run"

affects:
  - 01-02-workspace-setup
  - 01-03-backend-scaffold
  - all future packages that depend on @repo/database workspace resolution

tech-stack:
  added: []
  patterns:
    - "**/.env glob in .gitignore with !**/.env.example negation — covers all packages"
    - "@repo/<package> naming convention established for workspace members"
    - ".env.example with placeholder values as the committed credential template"

key-files:
  created:
    - packages/database/.env.example
  modified:
    - .gitignore
    - packages/database/package.json

key-decisions:
  - "Used **/.env glob (not bare .env) so all current and future packages under packages/ have .env excluded — additive fix, no bare packages/ line added (D-06 correction: no such line ever existed)"
  - "Added name/version/private as the first three keys in packages/database/package.json — only change to that file; all existing dependency and prisma config keys preserved untouched"
  - "Credential rotation handled as a blocking human gate (not automated) — Supabase dashboard reset is non-automatable; old credential invalidated before any npm install or CI run"

patterns-established:
  - "Pattern: monorepo .gitignore uses **/.env + **/.env.* with !**/.env.example — applied at repo root, covers all packages"
  - "Pattern: .env.example as the committed placeholder file — keys documented, values never real"

requirements-completed:
  - TOOL-06

duration: 15min
completed: 2026-06-30
---

# Phase 01 Plan 01: Repo Prerequisites Summary

**Gitignored `**/.env` across all packages, established `@repo/database` npm workspace identity, deleted stale nested lockfile, and rotated the live Supabase credential before any CI run**

## Performance

- **Duration:** ~15 min (including human credential rotation gate)
- **Started:** 2026-06-30T00:00:00Z
- **Completed:** 2026-06-30
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- `.gitignore` rewritten from a 5-line stub to a complete Node monorepo ignore set: `**/.env` glob with `!**/.env.example` negation, `**/dist/`, `.turbo/`, `**/generated/client/`, `.DS_Store` — satisfies TOOL-06 and decisions D-05 and D-06
- `packages/database/package.json` gained `"name": "@repo/database"`, `"version": "0.0.1"`, `"private": true` — the blocking prerequisite for npm workspace symlink creation (Landmine 1 from RESEARCH.md)
- `packages/database/package-lock.json` deleted — removes the stale nested lockfile that would cause `npm ci` failures once the root workspace takes over
- `packages/database/.env.example` committed with a safe `postgresql://USER:PASSWORD@HOST:5432/postgres` placeholder — documents the required key without exposing any real credential
- Live Supabase credential rotated by user via dashboard — old password invalidated, new `DATABASE_URL` in `packages/database/.env` (gitignored, never tracked)

## Task Commits

1. **Task 1: Fix .gitignore + @repo/database identity + remove lockfile + .env.example** — `a7c4e76` (chore)
2. **Task 2: Rotate live Supabase credential** — human-verify checkpoint; no commit (credential update is in gitignored `.env` only)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `.gitignore` — rewritten to standard Node monorepo shape; bare `.env` replaced with `**/.env` + negation pattern
- `packages/database/package.json` — added `name`, `version`, `private` as first three keys; all existing content preserved
- `packages/database/.env.example` — new file; DATABASE_URL with placeholder value only; committed to git

## Decisions Made

- Used `**/.env` glob (not per-package `.env` entries) so every package added in future phases is covered automatically
- D-06 premise correction honored: RESEARCH.md confirmed there was never a bare `packages/` line in `.gitignore` — no such line was removed; the fix was purely additive
- Credential rotation surfaced as a blocking human gate with a specific resume signal rather than being embedded in automated steps — non-automatable Supabase dashboard action

## Deviations from Plan

None — plan executed exactly as written. The D-06 correction (no bare `packages/` line to remove) was already documented in RESEARCH.md Landmine 3 and the plan action accounted for it.

## Issues Encountered

None.

## Known Stubs

None — `packages/database/.env.example` contains an intentional placeholder (`postgresql://USER:PASSWORD@HOST:5432/postgres`). This is the designed output of this plan, not a stub to be resolved. The actual connection string lives in the gitignored `packages/database/.env`.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All STRIDE threats from the plan's threat model were mitigated:

| Threat | Status |
|--------|--------|
| T-01-01: .env information disclosure via git | Mitigated — `**/.env` gitignored; `git check-ignore` confirmed |
| T-01-02: live Supabase credential exposure | Mitigated — user rotated password; old credential invalidated |
| T-01-03: .env.example with real values | Mitigated — only placeholder value committed |
| T-01-04: stale nested lockfile tampering | Mitigated — `packages/database/package-lock.json` deleted |

## Next Phase Readiness

Plan 01-02 (workspace setup) can now proceed safely:
- `packages/database` has a valid `name` field → npm workspace symlink will resolve
- `.gitignore` covers all `.env` files → `npm install` won't accidentally track credentials
- No stale nested lockfile → `npm ci` in CI will use only the root lockfile
- Live credential is the new rotated one → CI can run against Supabase without using an invalidated credential

No blockers. Phase 01 Plan 02 is unblocked.

---
*Phase: 01-monorepo-tooling-foundation*
*Completed: 2026-06-30*
