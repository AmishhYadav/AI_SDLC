---
plan: 03-06
phase: 03
status: complete
completed_at: "2026-07-01"
key-files:
  created:
    - packages/backend/src/main.ts
    - packages/backend/src/app.integration.spec.ts
  modified:
    - packages/backend/src/app.module.ts
deviations: []
---

# Plan 03-06 Summary: AppModule Wiring + main.ts Bootstrap

## What Was Built

### Task 1: Wire all Phase 3 providers in AppModule + main.ts security baseline

**AppModule** (`packages/backend/src/app.module.ts`) now registers all Phase 3 providers:
- `ThrottlerModule.forRootAsync` — reads `THROTTLER_TTL_SECONDS` + `THROTTLER_LIMIT` from env via AppConfigService; uses `seconds()` helper for ms conversion
- `HealthModule` — imported alongside ClsModule, LoggerModule, PrismaModule
- `APP_GUARD: ThrottlerGuard` — global rate-limit guard (~100 req/60s/IP default, overridable per-route)
- `APP_PIPE: ValidationPipe` — whitelist + forbidNonWhitelisted + transform (mass-assignment protection)
- `APP_INTERCEPTOR: ResponseEnvelopeInterceptor` — registered first (outermost, LIFO response-side)
- `APP_INTERCEPTOR: AuditInterceptor` — registered second (inner, sees raw handler output before wrapping)
- `IAuditContextProvider: NoOpAuditContextProvider` — seam for Phase 4/6 injection
- `IdempotencyStore: NoOpIdempotencyStore` — in-memory no-op until Redis lands

**main.ts** (`packages/backend/src/main.ts`) bootstrap order:
1. `NestFactory.create(AppModule, { bufferLogs: true })` — pino captures bootstrap logs
2. `app.use(helmet())` — security headers first (T-03-07)
3. `app.enableCors(...)` — CORS_ORIGINS split + trimmed from env (T-03-08 / D-15)
4. `app.setGlobalPrefix('api')` + `app.enableVersioning({ type: VersioningType.URI })`
5. Swagger served at `/api/docs` only when `NODE_ENV !== 'production'` (D-14 / INFRA-11)
6. `app.enableShutdownHooks()` — graceful shutdown via PrismaService.onModuleDestroy (INFRA-13)
7. `app.useLogger(app.get(Logger))` — swap NestJS logger for pino after bufferLogs flush

### Task 2: Integration tests — RED then GREEN

`packages/backend/src/app.integration.spec.ts` — 7 new integration tests covering:
- **Test A** (INFRA-12): Helmet sets `x-content-type-options`
- **Test B** (INFRA-12): Helmet sets `x-frame-options: SAMEORIGIN`
- **Test C** (INFRA-12): CORS allows configured origin
- **Test D** (INFRA-11): Swagger UI at `/api/docs` returns 200 in non-production
- **Test E** (INFRA-07): ValidationPipe rejects unknown fields with 400
- **Test F** (INFRA-07): ValidationPipe passes valid requests through
- **Test G** (INFRA-12): ThrottlerGuard returns 429 after limit exceeded

**Deviations auto-fixed during GREEN pass:**
1. `SwaggerModule.setup()` must be called BEFORE `await app.init()` in tests — calling after init does not register Express routes in time. Moved setup before init.
2. `overrideProvider(AppConfigService)` used for throttler test instead of `process.env` manipulation — dynamic-module caching in Vitest's ESM environment makes env-var override unreliable for `ThrottlerModule.forRootAsync`. Direct provider override is deterministic.

## Test Results

**56 tests passing** across 10 test files. All Phase 3 must-haves verified.

## Self-Check: PASSED

- [x] All must_haves implemented and verifiable
- [x] TypeScript build exits 0 (36 files compiled)
- [x] All 56 tests pass
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator writes)
- [x] SUMMARY.md committed before narration
