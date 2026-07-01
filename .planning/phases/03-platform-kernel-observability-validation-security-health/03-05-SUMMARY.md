---
phase: 03
plan: 05
subsystem: health
tags: [health, terminus, liveness, readiness, prisma, nestjs]
dependency_graph:
  requires:
    - 03-01  # env schema extension (CORS_ORIGINS — needed for test env setup)
    - 03-03  # @RawResponse() decorator
  provides:
    - HealthModule
    - HealthController (GET /api/v1/health/liveness, GET /api/v1/health/readiness)
    - PrismaHealthIndicator
  affects:
    - 03-06  # AppModule imports HealthModule in Plan 06
tech_stack:
  added:
    - "@nestjs/terminus: HealthCheckService, HealthIndicatorService (v11 API)"
  patterns:
    - "HealthIndicatorService.check(key).up()/.down() — terminus v11 new API (not deprecated HealthIndicator class)"
    - "@Controller({ path, version }) — controller-level versioning via options object"
    - "@RawResponse() at class level — bypasses ResponseEnvelopeInterceptor for all health methods"
    - "PrismaModule imported in test module to provide global PrismaService for overrideProvider"
key_files:
  created:
    - packages/backend/src/health/prisma-health.indicator.ts
    - packages/backend/src/health/health.controller.ts
    - packages/backend/src/health/health.module.ts
    - packages/backend/src/health/health.controller.spec.ts
  modified: []
decisions:
  - "@Version('1') decorator is MethodDecorator only — used @Controller({ path: 'health', version: '1' }) instead"
  - "PrismaModule imported in test (not HealthModule) because PrismaModule is @Global() and only available via AppModule in production; test must simulate this"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 03 Plan 05: Health Module Summary

**One-liner:** Liveness/readiness health endpoints via @nestjs/terminus v11 HealthIndicatorService with @RawResponse() class decorator bypassing the success envelope.

## What Was Built

Created the complete health module (4 files, 0 AppModule changes — Plan 06 wires HealthModule into AppModule):

- **PrismaHealthIndicator** — uses `HealthIndicatorService.check(key).up()/.down()` (terminus v11 new API). Performs `$queryRaw SELECT 1` ping. No deprecated `HealthIndicator` class or `HealthCheckError`.
- **HealthController** — `GET /api/v1/health/liveness` (always 200, no DB call) and `GET /api/v1/health/readiness` (Prisma ping, 200/503). Decorated with `@Controller({ path: 'health', version: '1' })` and `@RawResponse()` at class level.
- **HealthModule** — imports `TerminusModule`, declares `HealthController`, provides `PrismaHealthIndicator`. No `@Global()`.
- **health.controller.spec.ts** — 4 integration tests covering all success criteria.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PrismaHealthIndicator + HealthController + HealthModule | cef9bcb | prisma-health.indicator.ts, health.controller.ts, health.module.ts |
| 2 | health.controller.spec.ts integration test | 73d7531 | health.controller.spec.ts |

## Test Results

4 new health tests pass; all 39 tests in the suite pass:
- GET /api/v1/health/liveness returns 200 with `{ status: 'ok' }`
- GET /api/v1/health/liveness response has no `success` key (@RawResponse bypasses envelope)
- GET /api/v1/health/readiness returns 200 when DB is healthy
- GET /api/v1/health/readiness returns 503 when DB is down

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @Version() typed as MethodDecorator only — used @Controller options object**
- **Found during:** Task 1 (typecheck)
- **Issue:** `@Version('1')` in NestJS 11 is typed as `MethodDecorator`, not `ClassDecorator`. Applying it to a class causes `TS1238` and `TS1270` errors.
- **Fix:** Used `@Controller({ path: 'health', version: '1' })` instead — the `ControllerOptions` object supports a `version` field and is the canonical controller-level versioning API.
- **Files modified:** `health.controller.ts`
- **Commit:** cef9bcb

**2. [Rule 1 - Bug] PrismaService not in module graph for isolated HealthModule test**
- **Found during:** Task 2 (test run)
- **Issue:** `overrideProvider(PrismaService)` fails when `PrismaModule` is not in the module graph. `HealthModule` correctly relies on `PrismaService` being globally provided by `AppModule → PrismaModule`, but isolated tests have no such global.
- **Fix:** Test imports `PrismaModule` directly alongside `HealthModule` to make `PrismaService` available in the dependency graph, then `overrideProvider` replaces it with the mock. This faithfully simulates production behavior where `PrismaModule` is `@Global()`.
- **Files modified:** `health.controller.spec.ts`
- **Commit:** 73d7531

## Threat Surface Scan

No new threat surface beyond what was planned in the threat model:
- T-03-06 (DoS via probe hammering): pino-http `autoLogging.ignore` suppresses `/health` log noise (configured in Plan 02 LoggerModule).
- T-03-09 (Information Disclosure in readiness error): `indicator.down({ message: error.message })` — Prisma connection errors are generic "DB connection refused" style; no credentials exposed.

## Self-Check

Files created:
- packages/backend/src/health/prisma-health.indicator.ts — FOUND
- packages/backend/src/health/health.controller.ts — FOUND
- packages/backend/src/health/health.module.ts — FOUND
- packages/backend/src/health/health.controller.spec.ts — FOUND

Commits:
- cef9bcb — FOUND (feat: health module)
- 73d7531 — FOUND (test: health controller spec)

TypeScript: exits 0
Tests: 39/39 pass

## Self-Check: PASSED
