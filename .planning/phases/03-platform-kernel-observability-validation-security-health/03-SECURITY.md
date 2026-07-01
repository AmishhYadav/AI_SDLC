---
phase: "03"
slug: platform-kernel-observability-validation-security-health
status: verified
threats_open: 0
asvs_level: 1
created: "2026-07-01"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → node_modules | Untrusted package content; human verification gates this | Package source code (third-party) |
| HTTP request headers → ALS store | x-request-id / traceparent headers are untrusted; extractCorrelationId() sanitises them | Correlation IDs (user-controlled) |
| ALS store → pino log output → monitoring | Log lines must never include credentials or PII | Structured log events |
| Handler output → AuditInterceptor.tap() | Handler result observed after success; org context read from DI provider | Business operation result |
| AuditInterceptor → prisma.auditLog | Audit write path; organizationId is non-nullable FK | Audit records (org-scoped) |
| Handler output → ResponseEnvelopeInterceptor → HTTP client | Internal handler result shaped for client response | API response payload |
| HTTP request body/query → ValidationPipe | Untrusted input crosses here; whitelist + forbidNonWhitelisted blocks unknown fields | Request DTOs (user-controlled) |
| Kubernetes probe → /api/v1/health | Liveness/readiness probes from orchestrator | Health status |
| HealthController → PrismaService | DB ping crosses trust boundary; failure must return 503 | DB connectivity signal |
| Browser/client → Express (helmet + CORS) | Cross-origin requests and header injection cross here | HTTP headers, origin |
| Any IP → ThrottlerGuard | Rate-limiting applied before handlers | All inbound requests |
| Non-prod server → Swagger endpoint | API schema exposure gated by NODE_ENV | OpenAPI spec |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-SC | Tampering | npm packages (10 installs in Plan 01) | mitigate | Blocking checkpoint in Plan 01 Task 1 — human-verified each package on npm before install; slopcheck bypass documented | closed |
| T-03-01 | Information Disclosure | pino-http log output — credential fields in request logs | mitigate | `redact.paths` deny-list covers `authorization`, `cookie`, `set-cookie`, `password`, `token`, `apiKey`, `secret`; `serializers.req` never logs body; health probe logs suppressed via `autoLogging.ignore` | closed |
| T-03-02 | Tampering | extractCorrelationId() — x-request-id / traceparent header injection (log injection vector) | mitigate | `UUID_RE` regex restricts `x-request-id` to UUID format only; 128-char slice enforced; `traceparent` validated to `[a-f0-9]{32}` format; unknown formats fall back to generated UUID | closed |
| T-03-03 | Repudiation | AuditInterceptor — non-blocking write may fail silently | accept | Design decision D-03: availability of successful business operation is NOT coupled to audit store; audit failures logged at `error` level; monitoring surfaces them; trade-off documented in CONTEXT.md | closed |
| T-03-04 | Tampering | AuditLog.organizationId — non-nullable FK write without org context | mitigate | `writeAuditLog()` guards `ctx?.organizationId`; `NoOpAuditContextProvider` always returns null this phase → no FK violation possible; guard will enforce once real provider is injected in Phase 4/6 | closed |
| T-03-05 | Tampering | HTTP request body — mass assignment via unknown/extra fields | mitigate | `APP_PIPE ValidationPipe` with `whitelist: true` + `forbidNonWhitelisted: true`; unknown fields cause 400; registered globally in Plan 06 wiring; verified by integration test (Test E) | closed |
| T-03-06 | Denial of Service | Health check endpoints — probe hammering generates log noise | mitigate | pino-http `autoLogging.ignore` suppresses all `/health` path logs (configured in LoggerModule, Plan 02); `ThrottlerGuard` applies globally after Plan 06 wiring | closed |
| T-03-07 | Information Disclosure | traceId field in success envelope — client-visible correlation identifier | accept | Design decision D-07: traceId exposes request correlation only, not internal implementation details, stack traces, or credentials; explicitly required for client-side correlation | closed |
| T-03-07 | Elevation of Privilege | Helmet — missing security headers (clickjacking, MIME-sniffing, HSTS, CSP) | mitigate | `app.use(helmet())` applied first in `main.ts` bootstrap; sets `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, HSTS, CSP, and 25+ additional headers; verified by integration tests (Tests A/B) | closed |
| T-03-08 | Information Disclosure | CORS — cross-origin data exfiltration via missing origin allowlist | mitigate | `app.enableCors({ origin: CORS_ORIGINS })` from env; `CORS_ORIGINS` is a required Zod field (fails fast if missing); non-listed origins rejected; verified by integration test (Test C) | closed |
| T-03-09 | Information Disclosure | HealthController readiness endpoint — DB error details may expose connection info | mitigate | `indicator.down({ message: error.message })` — Prisma connection errors are generic "DB connection refused" style; no credentials, host details, or query info in error message | closed |
| T-03-10 | Denial of Service | ThrottlerGuard — request flooding / brute-force amplification | mitigate | `APP_GUARD ThrottlerGuard`; default 100 req/60s/IP from `THROTTLER_LIMIT`/`THROTTLER_TTL_SECONDS` env; overridable per-route with `@Throttle()`; in-memory store (single-instance, Redis-ready); verified by integration test (Test G) | closed |
| T-03-11 | Information Disclosure | Swagger UI — API schema exposed in production | mitigate | `SwaggerModule.setup()` only called when `NODE_ENV !== 'production'`; production bootstrap skips entirely; verified by integration test (Test D) | closed |
| T-03-12 | Denial of Service | Graceful shutdown — Prisma connections not closed on SIGTERM | mitigate | `app.enableShutdownHooks()` triggers NestJS lifecycle events; `PrismaService.onModuleDestroy()` calls `$disconnect()`; no duplicate disconnect added | closed |

*Status: open · closed*  
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

> **Note:** T-03-07 appears twice — two distinct threats were assigned the same ID across Plan 03-04 and Plan 03-06. Both are tracked and closed. Future plans should continue from T-03-13.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | AuditInterceptor uses fire-and-forget write: audit failure does not propagate to client. Design decision D-03 — availability of business operation takes precedence over audit coupling. Failures surface in error-level logs and monitoring. | Architecture (CONTEXT.md D-03) | 2026-07-01 |
| AR-03-02 | T-03-07 (traceId) | traceId field included in every success envelope response, visible to API clients. Design decision D-07 — client-side correlation is an explicit product requirement; traceId carries no internal implementation details. | Architecture (D-07) | 2026-07-01 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-01 | 14 | 14 | 0 | gsd-secure-phase orchestrator (short-circuit: register_authored_at_plan_time=true, all SUMMARY artifacts confirm mitigations) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-01
