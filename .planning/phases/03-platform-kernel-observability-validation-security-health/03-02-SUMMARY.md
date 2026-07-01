---
phase: 03
plan: 02
subsystem: backend-observability
tags: [nestjs-cls, nestjs-pino, correlation-id, als, env-schema, structured-logging, redaction]
dependency_graph:
  requires: [03-01]
  provides: [ClsService, extractCorrelationId, pino-structured-logging, extended-env-schema]
  affects:
    - packages/backend/src/config/env.schema.ts
    - packages/backend/src/config/env.schema.spec.ts
    - packages/backend/src/common/middleware/extract-correlation-id.ts
    - packages/backend/src/common/middleware/correlation-id.middleware.ts
    - packages/backend/src/app.module.ts
    - packages/backend/src/common/exceptions/global-exception.filter.ts
    - packages/backend/src/common/exceptions/global-exception.filter.spec.ts
    - packages/backend/vitest.config.ts
    - packages/backend/src/app.integration.spec.ts
tech_stack:
  added: []
  patterns:
    - nestjs-cls ALS per-request correlation ID (idGenerator via extractCorrelationId)
    - nestjs-pino structured JSON logging with genReqId from ClsService
    - pino redact deny-list for auth headers and body secrets
    - Zod env schema extension with required CORS_ORIGINS + 3 defaults
key_files:
  created:
    - packages/backend/src/common/middleware/extract-correlation-id.ts
  modified:
    - packages/backend/src/config/env.schema.ts
    - packages/backend/src/config/env.schema.spec.ts
    - packages/backend/src/common/middleware/correlation-id.middleware.ts
    - packages/backend/src/app.module.ts
    - packages/backend/src/common/exceptions/global-exception.filter.ts
    - packages/backend/src/common/exceptions/global-exception.filter.spec.ts
    - packages/backend/vitest.config.ts
    - packages/backend/src/app.integration.spec.ts
decisions:
  - "CorrelationIdMiddleware takes an intermediate state in Task 1 GREEN (uses extractCorrelationId directly) then finalizes to cls.getId() in Task 2 after ClsModule is registered"
  - "vitest.config.ts env section used for CORS_ORIGINS because ConfigModule.forRoot() calls validate(process.env) synchronously at module import time, before ESM top-level code runs"
  - "LoggerModule.forRootAsync injects ClsService without re-importing ClsModule because ClsModule.forRoot global: true makes ClsService injectable globally"
metrics:
  duration: "~45 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_modified: 9
---

# Phase 03 Plan 02: ALS Correlation ID Migration + Structured Logging Summary

**One-liner:** Migrated per-request correlation ID into nestjs-cls AsyncLocalStorage with pino structured JSON logging (genReqId=cls.getId()), auth header redaction, health-probe log suppression, and extended Zod env schema for CORS_ORIGINS/LOG_LEVEL/THROTTLER fields.

## Tasks Completed

| Task | Type | Description | Commit |
|------|------|-------------|--------|
| 1 (RED) | test | Add 4 failing env schema tests (CORS_ORIGINS, LOG_LEVEL, THROTTLER) | ae28b5d |
| 1 (GREEN) | feat | Extend env schema, create extract-correlation-id.ts, refactor middleware | e0f88dd |
| 2 | feat | Wire ClsModule+LoggerModule in AppModule, GlobalExceptionFilter uses cls.getId() | 4a7a832 |

## Verification Results

- `npm test --workspace=packages/backend`: 28 tests passed (5 files) — all Phase 2 tests green + 4 new env schema tests
- `npm run build --workspace=packages/backend`: 0 TypeScript errors
- `grep -n "ClsModule\|LoggerModule" app.module.ts`: ClsModule at line 20, LoggerModule at line 29 (ClsModule BEFORE LoggerModule)
- `grep -c "cls\.getId()" global-exception.filter.ts`: 1 match
- `grep -c "request\.traceId" global-exception.filter.ts`: 0 matches
- Pino JSON logs visible in integration test output with `id` field matching UUID (ALS traceId propagation confirmed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] CorrelationIdMiddleware ClsService injection broke integration test during Task 1**
- **Found during:** Task 1 GREEN
- **Issue:** Plan's Task 1 Step C injects ClsService into CorrelationIdMiddleware, but ClsModule isn't in AppModule until Task 2. The integration test exercises the full AppModule and failed with "Nest can't resolve dependencies of CorrelationIdMiddleware."
- **Fix:** Task 1 GREEN uses an intermediate middleware state (calls `extractCorrelationId(req)` directly). Task 2 finalizes to `cls.getId()` after ClsModule is registered.
- **Files modified:** correlation-id.middleware.ts
- **Commit:** e0f88dd (intermediate), 4a7a832 (final)

**2. [Rule 3 - Blocking Issue] CORS_ORIGINS missing from process.env at ConfigModule.forRoot() module import time**
- **Found during:** Task 1 GREEN (integration test failure)
- **Issue:** `@nestjs/config`'s `ConfigModule.forRoot()` with `validate` calls `envSchema.parse(process.env)` synchronously at module import time. In ESM, `import` statements are hoisted before top-level code, so `process.env['CORS_ORIGINS'] = '...'` in the test file runs AFTER the module is already loaded and validated. DATABASE_URL was never actually set by the test file assignment either — it was loaded from `process.env` at module cache time.
- **Fix:** Added `env: { DATABASE_URL, CORS_ORIGINS }` to `vitest.config.ts`. These are guaranteed to be set before any module is loaded by Vitest. The test-file `process.env` assignments are kept for clarity but serve as documentation.
- **Files modified:** packages/backend/vitest.config.ts, packages/backend/src/app.integration.spec.ts
- **Commit:** e0f88dd

## Known Stubs

None — all implemented features are fully wired. ALS correlation ID propagation is live (confirmed by pino log `id` field in integration test output).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: log-injection via headers | extract-correlation-id.ts | Mitigated: UUID_RE regex validates x-request-id to UUID format only; max 128-char slice; traceparent validated to 32-hex format (T-03-02) |
| threat_flag: credentials in logs | app.module.ts (LoggerModule) | Mitigated: pino redact deny-list covers authorization, cookie, set-cookie, password, token, apiKey, secret (T-03-01) |

## Self-Check: PASSED

- packages/backend/src/common/middleware/extract-correlation-id.ts: FOUND
- packages/backend/src/config/env.schema.ts: FOUND (7 keys confirmed)
- packages/backend/src/app.module.ts: FOUND (ClsModule line 20, LoggerModule line 29)
- packages/backend/src/common/exceptions/global-exception.filter.ts: FOUND (cls.getId() 1 match, request.traceId 0 matches)
- Commit ae28b5d (RED): FOUND
- Commit e0f88dd (GREEN): FOUND
- Commit 4a7a832 (Task 2): FOUND
- Tests: 28 passed
- Build: 0 errors
