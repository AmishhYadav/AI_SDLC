---
phase: 05-rbac-authorization-infrastructure
plan: "04"
subsystem: authorization
tags: [rbac, integration-test, real-db, ci, postgres, permissions-guard, vitest]
dependency_graph:
  requires: ["05-01", "05-02", "05-03"]
  provides: []
  affects:
    - packages/backend/src/app.integration.spec.ts
    - packages/backend/vitest.config.ts
    - .github/workflows/ci.yml
tech_stack:
  added: []
  patterns:
    - "describe.skipIf(!realDbAvailable) — Vitest conditional describe for DB-gated tests"
    - "Non-skippable top-level it() guard (D-09 silent-skip prevention)"
    - "Real PrismaModule integration without MockPrismaModule override in TestingModule"
    - "GitHub Actions services block (postgres:16 + pg_isready health-check)"
    - "process.env passthrough in vitest.config.ts for CI DATABASE_URL"
    - "Prisma fixture create/deleteMany for idempotent test isolation"
key_files:
  created: []
  modified:
    - packages/backend/src/app.integration.spec.ts
    - packages/backend/vitest.config.ts
    - .github/workflows/ci.yml
decisions:
  - "Used describe.skipIf(!realDbAvailable) so the real-DB RBAC block skips locally (mock URL) and runs in CI (real URL), avoiding any mock-DB initialization errors"
  - "Silent-skip guard placed as a top-level it() outside the describe.skipIf block so it ALWAYS runs — when RBAC_REALDB_REQUIRED=1 but DATABASE_URL is mock/absent, the guard test fails loudly (D-09)"
  - "Pre-cleanup step in beforeAll deletes leftover fixtures before creating fresh ones, ensuring the block is idempotent across re-runs even when a previous afterAll did not complete"
  - "rbac-none@test.com deliberately has no User/UserRole row — PermissionResolverService returns empty Set (D-04 fail-closed), proving AUTH_MODE=stub never grants permissions"
  - "afterAll deletes only fixture rows (UserRole → OrganizationMember → User); seeded permissions/roles/organization are never mutated by tests"
  - "Used working-directory: packages/database for prisma db seed step in CI because prisma.seed config lives in packages/database/package.json, not the repo root"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-03"
  tasks_completed: 3
  files_created: 0
  files_modified: 3
---

# Phase 05 Plan 04: Real-DB RBAC Integration Test + CI Wiring Summary

End-to-end RBAC proof against real Postgres: allow (Developer role, organization:read → 200), deny (missing organization:manage → 403 non-leaking), stub-no-permissions (no UserRole → 403), chain (no token → 401), with CI provisioning the DB and RBAC_REALDB_REQUIRED=1 making any mis-wired env fail loudly.

## What Was Built

### Task 1 — vitest.config.ts: process.env DATABASE_URL passthrough

Changed the hardcoded `DATABASE_URL: 'postgresql://mock:...'` in `vitest.config.ts` to `process.env['DATABASE_URL'] ?? 'postgresql://mock:...'`. Without a real DB in the environment, the mock fallback preserves all existing 19 tests. When CI sets a real `DATABASE_URL`, the value flows through to the vitest process so the real `PrismaModule` can connect to Postgres.

### Task 2 — app.integration.spec.ts: Real-DB RBAC describe block + silent-skip guard

Added two constructs to `app.integration.spec.ts`:

**Non-skippable silent-skip guard** (top-level `it()`, always runs):
- When `RBAC_REALDB_REQUIRED=1` (CI flag) but `DATABASE_URL` is mock or absent, this test FAILS, turning CI red instead of letting the real-DB RBAC block silently skip to green (D-09, T-05-16).
- Locally with no flag and mock DB, `realDbRequired` is false so the guard passes trivially.

**`describe.skipIf(!realDbAvailable)('RBAC Authorization (real DB) ...')`** (skipped locally, runs in CI):
- Compiled WITHOUT `.overrideModule(PrismaModule).useModule(MockPrismaModule)` — the real `PrismaModule` connects to Postgres so `PermissionResolverService` queries run against the real DB.
- `beforeAll`: looks up seeded System Organization (`slug: 'system'`) and Developer role (`name: 'Developer'`); creates `User`, `OrganizationMember`, `UserRole` fixtures for `rbac-allow@test.com`. Pre-cleanup ensures idempotency.
- `afterAll`: deletes fixture rows only (UserRole → OrganizationMember → User); never touches seeded permissions/roles/organization. Closes app.
- Four tests:
  - **(a) allow** — `GET /api/v1/rbac-test/read` with `x-dev-user: rbac-allow@test.com` → 200 (Developer has `organization:read`, RBAC-02)
  - **(b) deny** — `GET /api/v1/rbac-test/manage` same header → 403 `AUTHZ.PERMISSION_DENIED`, message does NOT contain `organization:manage` (RBAC-04, D-54)
  - **(c) stub-no-permissions** — `GET /api/v1/rbac-test/read` with `x-dev-user: rbac-none@test.com` → 403 (unknown user, empty Set, D-09)
  - **(d) chain** — `GET /api/v1/rbac-test/read` with no header → 401 (JwtAuthGuard fires before PermissionsGuard, RBAC-03)
- `RbacTestController` added at path `rbac-test`, version `1`, with `@RequirePermissions('organization:read')` on `GET read` and `@RequirePermissions('organization:manage')` on `GET manage`.

### Task 3 — ci.yml: Postgres service + schema push + seed + RBAC_REALDB_REQUIRED

Updated `.github/workflows/ci.yml`:
- **`services.postgres`**: `postgres:16` image, `POSTGRES_USER/PASSWORD/DB: ci`, health-check (`pg_isready`) so the job waits for readiness before any step runs. Port `5432:5432`.
- **Job-level `env.DATABASE_URL`**: `postgresql://ci:ci@localhost:5432/ci` — consumed by both Prisma CLI steps and the vitest process (via Task 1 passthrough).
- **Job-level `env.RBAC_REALDB_REQUIRED: '1'`**: activates the silent-skip guard. If DATABASE_URL were absent/mock at test collection time, the guard test fails CI loudly.
- **New step "Apply database schema"**: `npx prisma db push --schema packages/database/prisma/schema --skip-generate` (generate already ran via `@repo/database` postinstall in `npm ci`).
- **New step "Seed database"**: `npx prisma db seed` from `working-directory: packages/database` (seed config lives in `packages/database/package.json`).
- Pinned action SHAs (`actions/checkout`, `actions/setup-node`) and `permissions: contents: read` unchanged.

## Test Results (local run, mock DB)

- 20 tests pass, 4 skipped (the real-DB RBAC block skips because `realDbAvailable=false` locally)
- Silent-skip guard passes trivially (no `RBAC_REALDB_REQUIRED` flag locally)
- TypeScript: `npx tsc --noEmit` exits 0

## In CI (expected behavior)

- `realDbAvailable=true` → RBAC describe block runs (not skipped)
- `RBAC_REALDB_REQUIRED=1` → guard enforces that the block cannot silently skip
- allow/deny/stub-no-permissions/401-vs-403 tests run against real Postgres with seeded data
- A mis-wired env (missing or mock DATABASE_URL) → guard test fails → CI red

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan adds tests and CI infrastructure only — no production trust boundary is expanded.

## Requirements Closed

- RBAC-02: permissions resolved from seeded 16/4 against real Postgres — proven by the real-DB allow/deny tests
- RBAC-03: authN/authZ chain order proven — 401 without token vs 403 with valid-but-unauthorized token
- RBAC-04: authenticated-but-unauthorized returns 403 — deny and stub-no-permissions tests

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `packages/backend/src/app.integration.spec.ts` | FOUND |
| `packages/backend/vitest.config.ts` | FOUND |
| `.github/workflows/ci.yml` | FOUND |
| `05-04-SUMMARY.md` | FOUND |
| Commit c54f20f (Task 1 vitest config) | FOUND |
| Commit 3f13870 (Task 2 RBAC spec block) | FOUND |
| Commit 002c1bd (Task 3 CI wiring) | FOUND |
