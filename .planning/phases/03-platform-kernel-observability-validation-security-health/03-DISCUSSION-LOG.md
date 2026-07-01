# Phase 3: Platform Kernel — Observability, Validation, Security & Health - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 3-Platform Kernel — Observability, Validation, Security & Health
**Areas discussed:** Audit logging strategy, Success response envelope, SEAM-06 API conventions, Logging & correlation, Swagger + security baseline

---

## Audit logging strategy (INFRA-09)

### How complete should INFRA-09 be this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Interceptor + context seam | Build the interceptor AND a pluggable actor/tenant-context provider seam (no-op now); real provider injected in Phase 4/6, no later changes; tested with injected fake. | ✓ |
| Interceptor only, dormant | Build + register interceptor that early-returns without org context; wire context in Phase 6. | |
| Full write path + demo route | Everything + a temporary mutating probe endpoint with a stubbed org id to exercise the insert now. | |

### What triggers an audit record?

| Option | Description | Selected |
|--------|-------------|----------|
| `@Audit()` decorator, opt-in | Handlers explicitly mark auditable ops; action/resource map cleanly to the enum/field; nothing audited by accident. | ✓ |
| Auto by HTTP method | All POST/PUT/PATCH/DELETE audited; action/resource inferred from route. | |
| Hybrid: auto + opt-out | Audit all mutations, allow `@NoAudit()`. | |

### If the AuditLog write fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Never block; log the failure | Write after handler success; on failure return success + log at error level. | ✓ |
| Fail the request | Whole request fails if audit write fails (compensating). | |

**User's choice:** Interceptor + context seam; `@Audit()` opt-in; never block, log failures.
**Notes:** Availability of a successful business operation must not be coupled to the audit store; org context absent this phase, so writes are skipped cleanly until Phase 4/6 inject the real provider.

---

## Success response envelope (INFRA-08)

### Success envelope shape

| Option | Description | Selected |
|--------|-------------|----------|
| `{success,data,meta,traceId}` | Always include a top-level meta block (null for single, populated for lists); symmetric with error envelope. | ✓ |
| `{success,data,traceId}` | Minimal; pagination nests inside data. | |
| `{success,data,traceId}` + meta when needed | Omit meta except on paginated lists. | |

### `@RawResponse()` behavior + traceId on success

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-out + traceId always | Wrap by default; `@RawResponse()` bypasses for health/Swagger/files/redirects; traceId always present. | ✓ |
| Opt-out, no traceId on success | Same opt-out, traceId only on errors. | |

**User's choice:** `{success,data,meta,traceId}`; opt-out wrapping + traceId always.
**Notes:** Mirrors the fixed error envelope; meta gives pagination a stable, collision-free home.

---

## SEAM-06 API conventions

### Pagination style

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-based | Opaque cursor + limit; meta carries nextCursor/hasNextPage; scales, stable under writes. | ✓ |
| Offset/page-based | page + pageSize; totals + jump-to-page; deep-offset cost. | |
| Offset now, cursor-ready | Ship offset, shape meta for later cursor mode. | |

### Idempotency-key scope

| Option | Description | Selected |
|--------|-------------|----------|
| Convention + pluggable seam | Header contract + interceptor + `IdempotencyStore` interface with no-op/in-memory impl now. | ✓ |
| Documented convention only | Just document the header semantics; no code. | |
| Full in-memory implementation | Working interceptor with in-memory storage now. | |

### Error-code catalog structure

| Option | Description | Selected |
|--------|-------------|----------|
| Decentralized per-domain | Each domain owns its prefixed const object on the PLATFORM template; shared format helper + doc; aligns with microservice extraction. | ✓ |
| Centralized registry | One central enum/const of all codes. | |

**User's choice:** Cursor pagination; idempotency convention + seam; decentralized per-domain error catalog.
**Notes:** No shared store this milestone — idempotency store and throttler storage are in-memory/no-op, Redis-ready later.

---

## Logging & correlation (INFRA-04)

### Logging approach

| Option | Description | Selected |
|--------|-------------|----------|
| nestjs-pino + ALS | Structured JSON, built-in redaction, auto request logging, native ALS. | ✓ |
| Nest Logger + custom JSON | Extend built-in LoggerService by hand. | |
| Winston | nest-winston JSON transport. | |

### Correlation-id migration + redaction policy

| Option | Description | Selected |
|--------|-------------|----------|
| ALS store + deny-list redaction | traceId generation → ALS (per D-02); filter reads from ALS; redact known-sensitive keys/headers; no request bodies logged by default. | ✓ |
| ALS store + allow-list logging | Same ALS migration; only allow-listed fields ever logged. | |

**User's choice:** nestjs-pino + ALS; ALS store + deny-list redaction.
**Notes:** Fulfills Phase 2 D-02; existing CorrelationIdMiddleware header logic preserved, only id storage moves to ALS.

---

## Swagger + security baseline (INFRA-11, INFRA-12)

### Swagger exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Non-prod only | Served only when NODE_ENV != production; zero prod attack surface. | ✓ |
| All envs, prod behind auth | Serve everywhere, guard/basic-auth in prod. | |
| Always open | Serve in every env, no gating. | |

### CORS allowlist + rate-limit defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Env allowlist + conservative global throttle | CORS_ORIGINS from validated env; global ~100 req/min/IP, per-route overridable, in-memory (Redis-ready). | ✓ |
| Env allowlist, throttle off by default | Same CORS; throttler wired but disabled/very high limit. | |

**User's choice:** Swagger non-prod only; env CORS allowlist + conservative global throttle.
**Notes:** Adds `CORS_ORIGINS`, `LOG_LEVEL`, throttler thresholds to the fail-fast Zod schema (extends Phase 2 D-07).

---

## Claude's Discretion

- Health checks (Terminus liveness always-200, readiness = Prisma ping; optional memory/disk indicator).
- Graceful shutdown via `enableShutdownHooks`; reuse `@repo/database` `OnModuleDestroy` (no second disconnect).
- Global pipe/interceptor registration mechanism (DI `APP_*` providers matching Phase 2, interceptor ordering).
- Validation-pipe flags and shared DTO base / pagination-query DTO location.
- ALS implementation detail (Node `AsyncLocalStorage` vs `nestjs-cls`).
- Exact `IdempotencyStore` interface shape and no-op/in-memory backing.

## Deferred Ideas

- Real audit actor/tenant-context provider — Phase 4/6.
- Persistent/distributed idempotency store and Redis-backed throttler — when shared infra lands.
- Authenticated production Swagger docs portal — revisit after Phase 4.
- Broader Prisma error-code mappings and additional readiness indicators — when real endpoints/dependencies exercise them.
