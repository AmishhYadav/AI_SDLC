---
phase: 02-platform-kernel-bootstrap-config-error-contract
plan: 01
subsystem: infra
tags: [nestjs, express, zod, supertest, npm, swc, nest-cli]

# Dependency graph
requires:
  - phase: 01-database-layer
    provides: "@repo/database package with PrismaModule/PrismaService already installed"
provides:
  - "@nestjs/platform-express HTTP adapter installed and resolvable in @repo/backend"
  - "@nestjs/config configuration module installed in @repo/backend"
  - "zod schema validation library installed in @repo/backend"
  - "@nestjs/testing, supertest, @types/supertest dev dependencies installed in @repo/backend"
  - "nest-cli.json entryFile corrected to 'main', SWC builder preserved"
  - "npm run build --workspace packages/backend compiles without errors"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, all backend plans]

# Tech tracking
tech-stack:
  added:
    - "@nestjs/platform-express@11.1.27 — Express HTTP adapter for NestJS"
    - "@nestjs/config@4.0.4 — NestJS configuration module (registerAs, ConfigService)"
    - "zod@4.4.3 — schema validation for fail-fast env validation"
    - "@nestjs/testing@11.1.27 — TestingModule for integration tests"
    - "supertest@7.2.2 — HTTP assertion library for integration tests"
    - "@types/supertest@7.2.0 — TypeScript types for supertest"
  patterns:
    - "npm workspaces --workspace flag for scoped package installs into packages/backend"
    - "nest-cli.json entryFile: 'main' wires SWC output to src/main.ts"

key-files:
  created: []
  modified:
    - "packages/backend/package.json — added 3 runtime + 3 dev dependencies"
    - "packages/backend/nest-cli.json — entryFile changed from 'index' to 'main'"
    - "package-lock.json — lock file updated for new packages"

key-decisions:
  - "Used exact --workspace packages/backend flag to scope installs to backend only, not root"
  - "Only changed entryFile in nest-cli.json; SWC builder config and deleteOutDir preserved unchanged"
  - "npm audit warnings (4 high severity) left unfixed — not introduced by this plan, addressed in a separate security pass"

patterns-established:
  - "Workspace-scoped installs: always use --workspace packages/<pkg> for package-specific dependencies"
  - "nest-cli.json: entryFile must be 'main' to match src/main.ts bootstrap convention"

requirements-completed: [INFRA-01, INFRA-02, INFRA-14]

# Metrics
duration: 8min
completed: 2026-06-30
---

# Phase 02 Plan 01: NestJS Dependency Install and nest-cli Entry Fix Summary

**Six packages installed into @repo/backend (platform-express, config, zod, testing, supertest, @types/supertest) with nest-cli.json corrected from entryFile 'index' to 'main' — SWC build passes, Phase 2 now has a compilable foundation.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-30T00:00:00Z
- **Completed:** 2026-06-30T00:08:00Z
- **Tasks:** 2 (Task 1: human checkpoint already completed; Task 2: install + config)
- **Files modified:** 3

## Accomplishments

- All 6 packages verified by human checkpoint and installed into `@repo/backend` workspace
- `@nestjs/platform-express`, `@nestjs/config`, `zod` added to production dependencies
- `@nestjs/testing`, `supertest`, `@types/supertest` added to devDependencies
- `nest-cli.json` `entryFile` corrected from `"index"` to `"main"` with SWC builder preserved
- `npm run build --workspace packages/backend` exits 0 (SWC compiled 2 files successfully)

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify package legitimacy** - (human checkpoint, no commit — pre-completed by human)
2. **Task 2: Install packages + update nest-cli.json entryFile** - `d408af8` (feat)

**Plan metadata:** (committed with SUMMARY below)

## Files Created/Modified

- `packages/backend/package.json` — added `@nestjs/platform-express`, `@nestjs/config`, `zod` to dependencies; added `@nestjs/testing`, `supertest`, `@types/supertest` to devDependencies
- `packages/backend/nest-cli.json` — `entryFile` changed from `"index"` to `"main"`; all other keys unchanged
- `package-lock.json` — updated with 173 new package entries from workspace install

## Decisions Made

- Installed packages at latest compatible minor versions per npm defaults (platform-express@11.1.27 aligns with existing @nestjs/common@11.1.27 major)
- Did not run `npm audit fix --force` — 4 pre-existing high-severity vulnerabilities surfaced by audit were present before this plan; force-fixing would introduce breaking changes outside this plan's scope
- Scoped all installs strictly to `packages/backend` workspace to avoid polluting the root or `packages/database`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree branch (worktree-agent-a5211e02504d34af2) was initially at commit 7f09813 (before packages/ was added to the repo). The `<worktree_branch_check>` merge-base assertion correctly detected the drift and ran `git reset --hard 99da812` to bring the worktree in sync with the current main baseline before any file operations. This is expected behavior for a fresh worktree spawned from an old branch root.

## User Setup Required

None - no external service configuration required. All packages install from the public npm registry.

## Known Stubs

None.

## Threat Flags

No new threat surface introduced. The six packages were verified by human checkpoint (Task 1, `gate="blocking-human"`). T-02-SC disposition is `mitigate` — human verified all six on npmjs.com before install. T-02-01 (nest-cli.json entryFile) disposition is `accept` — config-only change with no runtime data flow.

## Next Phase Readiness

- `packages/backend` now has all required runtime dependencies for Phase 2 plans
- SWC build is green; plans 02-02 through 02-08 can proceed to implement AppModule, ConfigModule, error contracts, and domain scaffolding
- No blockers

---
*Phase: 02-platform-kernel-bootstrap-config-error-contract*
*Completed: 2026-06-30*
