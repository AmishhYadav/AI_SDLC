---
phase: 03
slug: platform-kernel-observability-validation-security-health
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-01
updated: 2026-07-01
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 (SWC) |
| **Config file** | packages/backend/vitest.config.ts (Phase 2 baseline) |
| **Quick run command** | `pnpm --filter @repo/backend test` |
| **Full suite command** | `pnpm --filter @repo/backend test run` |
| **Typecheck command** | `pnpm --filter @repo/backend typecheck` |
| **Build command** | `pnpm --filter @repo/backend build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @repo/backend test run`
- **After every plan wave:** Run `pnpm --filter @repo/backend test run`
- **Before `/gsd:verify-work`:** Full suite + typecheck + build must all be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | INFRA-04…SEAM-06 | T-03-SC | All 10 packages verified as legitimate before install | Manual checkpoint | — (human gate) | N/A | ⬜ |
| 03-01-T2 | 03-01 | 1 | INFRA-04…SEAM-06 | T-03-SC | Packages install without resolution errors; build passes | Build | `pnpm --filter @repo/backend build` | N/A | ⬜ |
| 03-02-T1 | 03-02 | 2 | INFRA-04 | T-03-02 | extractCorrelationId validates x-request-id to UUID format; env schema parses CORS_ORIGINS/LOG_LEVEL/THROTTLER_* | Unit | `pnpm --filter @repo/backend test run` | ✅ env.schema.spec.ts (extend) | ⬜ |
| 03-02-T2 | 03-02 | 2 | INFRA-04 | T-03-01, T-03-02 | GlobalExceptionFilter reads traceId from cls.getId(), not req.traceId; ClsModule before LoggerModule in imports | Unit | `pnpm --filter @repo/backend test run` | ✅ global-exception.filter.spec.ts (update) | ⬜ |
| 03-03-T1 | 03-03 | 2 | INFRA-09 | T-03-03, T-03-04 | AuditInterceptor skips write when no org context; writes when context present; audit failure does not propagate | Unit | `pnpm --filter @repo/backend test run` | ❌ audit.interceptor.spec.ts (Wave 0 — created in this task) | ⬜ |
| 03-03-T2 | 03-03 | 2 | SEAM-06 | — | createErrorCatalog('AUTH', ['A'] as const) → { A: 'AUTH.A' }; IdempotencyStore abstract class injectable | Unit | `pnpm --filter @repo/backend test run` | ❌ create-error-catalog.spec.ts (Wave 0 — created in this task) | ⬜ |
| 03-04-T1 | 03-04 | 3 | INFRA-07, SEAM-06 | T-03-05 | CursorPaginationDto rejects limit > 100; coerces string '50' to 50; defaults limit to 20 | Unit | `pnpm --filter @repo/backend test run` | ❌ cursor-pagination.dto.spec.ts (Wave 0 — created in this task) | ⬜ |
| 03-04-T2 | 03-04 | 3 | INFRA-08 | T-03-07 | ResponseEnvelopeInterceptor wraps plain value; forwards PaginatedResult meta; bypasses on @RawResponse() | Unit | `pnpm --filter @repo/backend test run` | ❌ response-envelope.interceptor.spec.ts (Wave 0 — created in this task) | ⬜ |
| 03-05-T1 | 03-05 | 3 | INFRA-10 | T-03-06, T-03-09 | PrismaHealthIndicator uses HealthIndicatorService (not deprecated HealthIndicator class) | Build | `pnpm --filter @repo/backend typecheck` | N/A | ⬜ |
| 03-05-T2 | 03-05 | 3 | INFRA-10 | T-03-06 | Liveness 200; readiness 200 healthy; readiness 503 broken DB; liveness has no 'success' key | Integration | `pnpm --filter @repo/backend test run` | ❌ health.controller.spec.ts (Wave 0 — created in this task) | ⬜ |
| 03-06-T1 | 03-06 | 4 | INFRA-07, INFRA-12, INFRA-13 | T-03-05, T-03-07, T-03-10, T-03-12 | APP_PIPE+APP_GUARD+APP_INTERCEPTOR x2 wired; ThrottlerModule uses seconds(); bufferLogs+enableShutdownHooks in main.ts | Build | `pnpm --filter @repo/backend build && pnpm --filter @repo/backend test run` | ✅ (extend app.module.ts + main.ts) | ⬜ |
| 03-06-T2 | 03-06 | 4 | INFRA-11, INFRA-12 | T-03-07, T-03-08, T-03-11 | Helmet headers present; traceId ALS propagation end-to-end; Swagger in dev; CORS allowlist enforced; ValidationPipe rejects unknown fields | Integration | `pnpm --filter @repo/backend test run` | ✅ (extend app.integration.spec.ts) | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All spec files listed as "Wave 0 — created in this task" below are NEW files created within the same plan/task as their implementation. No prior skeleton is needed.

| Spec File | Plan | Creates In Task | Covers |
|-----------|------|-----------------|--------|
| `src/common/interceptors/audit.interceptor.spec.ts` | 03-03 | Task 1 | INFRA-09: skip-on-null, write-on-context, failure-does-not-propagate |
| `src/common/error-catalog/create-error-catalog.spec.ts` | 03-03 | Task 2 | SEAM-06: error catalog format |
| `src/common/pagination/cursor-pagination.dto.spec.ts` | 03-04 | Task 1 | INFRA-07, SEAM-06: DTO validation |
| `src/common/interceptors/response-envelope.interceptor.spec.ts` | 03-04 | Task 2 | INFRA-08: envelope shape, @RawResponse bypass |
| `src/health/health.controller.spec.ts` | 03-05 | Task 2 | INFRA-10: liveness/readiness endpoints |

**Existing files updated in this phase:**

| Spec File | Plan | Task | Change |
|-----------|------|------|--------|
| `src/config/env.schema.spec.ts` | 03-02 | Task 1 | Add 4 tests for CORS_ORIGINS, LOG_LEVEL, THROTTLER coercion |
| `src/common/exceptions/global-exception.filter.spec.ts` | 03-02 | Task 2 | Replace req.traceId mock with ClsService mock; add makeCls() factory |
| `src/app.integration.spec.ts` | 03-06 | Task 2 | Add Phase 3 describe block: Helmet, ALS traceId, Swagger, CORS, ValidationPipe |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 10 npm packages verified as legitimate | INFRA-04 to SEAM-06 | slopcheck unavailable; requires human browser verification | Open npmjs.com/package/<name> for each package; confirm GitHub repo URL matches official org; confirm weekly downloads > 100K; confirm last publish within 24 months |
| pino redaction of auth headers in actual HTTP logs | INFRA-04 | Log output inspection requires runtime with real pino output | Start the server in dev mode; send a request with Authorization: Bearer test-token header; confirm pino log output shows [REDACTED] for the authorization field |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (all spec files created in-task)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task runs the test suite)
- [x] Wave 0 covers all MISSING references (5 new spec files + 3 existing spec updates)
- [x] No watch-mode flags (all commands use `test run`, not `test watch`)
- [x] Feedback latency < 60 seconds (vitest run estimated ~30s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
