# Phase 3: Platform Kernel — Observability, Validation, Security & Health - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The second half of the cross-cutting Platform Kernel. Every request now flows through structured logging, strict validation, response/audit shaping, health checks, Swagger, and a security baseline — and the shared conventions (SEAM-06) that all 14 domains later import are defined here. Whatever contracts this phase locks (success envelope shape, pagination model, error-code taxonomy, logging fields, audit trigger) become the template every domain inherits, so they are set once and copied everywhere.

**In scope (INFRA-04, 07, 08, 09, 10, 11, 12, 13, SEAM-06):**
- Structured JSON logging with a per-request correlation id propagated via AsyncLocalStorage, with auth headers/secrets redacted (INFRA-04).
- Global validation pipe rejecting unknown/extra fields and transforming typed DTOs (INFRA-07).
- Response interceptor wrapping successful responses in the standard envelope, with a `@RawResponse()` escape hatch (INFRA-08).
- Audit interceptor recording mutating operations to the `AuditLog` model, delivered as a seam (INFRA-09).
- Liveness/readiness health endpoints via Terminus; readiness verifies DB connectivity (INFRA-10).
- Swagger/OpenAPI documentation for the `/api/v1` surface (INFRA-11).
- Security baseline: Helmet headers, CORS allowlist, request rate limiting (INFRA-12).
- Graceful shutdown closing the Prisma connection via a typed lifecycle hook (INFRA-13).
- Shared, importable conventions: pagination, idempotency-key, error-code catalog (SEAM-06).

**Out of scope (defer to later phases):**
- Real authentication principal / `CurrentUser` and the tenant/actor context — Phases 4 & 6. This phase builds the audit **context-provider seam** with a no-op provider; the real provider is injected later.
- Any persistent/shared store (Redis/broker). Throttler storage and the idempotency store are in-memory / no-op now, Redis-ready later.
- Auth guards, RBAC, tenancy enforcement, org/project, AI/event seams, 14-domain scaffolding — Phases 4–9.
- Any change to the frozen `@repo/database` schema (INFRA-14 holds: consume `AuditLog`, `PrismaService` as-is).

</domain>

<decisions>
## Implementation Decisions

### Audit logging (INFRA-09)
- **D-01:** Ship INFRA-09 as a **true seam**: build the audit interceptor **and** a pluggable actor/tenant-context provider interface (returns `organizationId` + optional `userId`). Provide a **no-op provider now**; Phase 4 (principal) / Phase 6 (tenant context) inject the real provider and audit begins writing automatically with **no interceptor changes**. The write path is real and unit-tested against an injected fake context.
- **D-02:** Audit records are **opt-in via an `@Audit(action, resource)` decorator** on handlers — explicit and self-documenting; `action` maps to the `AuditAction` enum and `resource` to the model's `resource` field. Nothing is audited by accident. (Chosen over auto-by-HTTP-method and hybrid opt-out, which both force fuzzy route→action/resource inference.)
- **D-03:** Audit write runs **after the handler succeeds and never blocks the request**. If the `AuditLog` insert fails, the request still returns success and the failure is logged at error level (surfaced to monitoring). Availability of a successful business operation is not coupled to the audit store.
- **D-04:** When the context provider yields no `organizationId` (always true this phase, since tenancy is absent), the interceptor **skips the write cleanly** — it does not fabricate an org id or throw. `AuditLog.organizationId` is non-nullable, so writes only occur once a real org context exists.

### Success response envelope (INFRA-08)
- **D-05:** Success envelope is **`{ success: true, data, meta, traceId }`** — symmetric with the fixed error envelope `{ success, errorCode, message, traceId }`. `meta` is `null` for single-resource responses and populated with pagination info for list responses, giving pagination metadata a stable home that never collides with resource fields.
- **D-06:** `@RawResponse()` is an **opt-out** of wrapping for endpoints that must return non-enveloped bodies: Terminus health JSON, Swagger's OpenAPI document, file/stream downloads, and redirects. Everything else is wrapped by default.
- **D-07:** `traceId` is **always present on success responses** (not just errors), so clients can correlate any call to server logs.

### SEAM-06 conventions (pagination, idempotency, error catalog)
- **D-08:** Pagination is **cursor-based**: opaque cursor + limit; `meta` carries `nextCursor` / `hasNextPage`. Scales to large, frequently-mutated datasets, stable under concurrent inserts, avoids deep-offset cost. (Chosen over offset/page; no random page-jump or free total-count, accepted trade-off.)
- **D-09:** Idempotency ships as **convention + pluggable seam**: define the `Idempotency-Key` header contract, a decorator/interceptor, and an `IdempotencyStore` interface with a **no-op / in-memory implementation now**. A real persistent store is wired when infra lands. Reserves and documents the contract without over-building a misleading single-instance implementation.
- **D-10:** Error-code catalog is **decentralized per-domain**: keep the existing `PLATFORM_ERROR_CODES` const as the template; each domain owns its own prefixed const object (`AUTH.*`, `ORGANIZATION.*`, …) co-located with the domain. A **shared type/format helper** enforces the dotted UPPER_SNAKE `PREFIX.CODE` shape; a maintained doc lists them. Aligns with the microservice-extraction goal (each domain carries its own codes). (Chosen over a central registry that would couple all domains to one file.)

### Logging & correlation (INFRA-04)
- **D-11:** Use **`nestjs-pino`** for structured JSON logging: fast, built-in redaction, automatic request logging, native ALS support so the correlation id auto-attaches to every log line. Replaces the `console.error` in `main.ts`. (Chosen over hand-rolled Nest Logger JSON and Winston.)
- **D-12:** The correlation id **migrates into an ALS-backed layer** (fulfilling Phase 2 **D-02**): the existing `CorrelationIdMiddleware` header logic (`x-request-id` → `traceparent` → generated UUID) is **preserved but now seeds the ALS store**, and the `GlobalExceptionFilter` reads `traceId` from ALS instead of `req.traceId`. The error/success envelope contract does not change.
- **D-13:** Redaction is **deny-list based**: redact known-sensitive keys/headers (`authorization`, `cookie`, `set-cookie`, `password`, `token`, `apiKey`, `secret`, and near-variants). Log `method` / `path` / `status` / `duration` / `traceId`; **do not log request bodies by default** (may carry PII).

### Swagger & security baseline (INFRA-11, INFRA-12)
- **D-14:** Swagger UI + OpenAPI JSON are served **only when `NODE_ENV !== production`** — zero API-shape exposure in prod, no auth dependency needed now. Revisit if an authenticated prod docs portal is required later.
- **D-15:** CORS origins come from a **required, Zod-validated env var (`CORS_ORIGINS`, comma-separated)** — fail-fast via the Phase 2 config module. A global `@nestjs/throttler` applies a **conservative default (~100 req/min/IP), overridable per-route via `@Throttle`**, with **in-memory storage (Redis-ready)**. Threshold values are themselves env-tunable. (Chosen over shipping the throttler disabled, which would contradict INFRA-12's intent.)
- **D-16:** This phase **extends the fail-fast Zod env schema** (Phase 2 D-07's set was `DATABASE_URL`, `PORT`, `NODE_ENV`) with the vars these features need: `CORS_ORIGINS`, `LOG_LEVEL`, and throttler thresholds. Phase 2 explicitly anticipated `CORS_ORIGINS` / `LOG_LEVEL` arriving here.

### Claude's Discretion
- Health checks (INFRA-10): Terminus with liveness always-200 and readiness = Prisma DB ping; whether readiness adds a memory/disk indicator is Claude's call, but keep it minimal.
- Graceful shutdown (INFRA-13): `app.enableShutdownHooks()`; Prisma disconnect already handled by `@repo/database`'s `OnModuleDestroy` — wire the lifecycle, do not add a second disconnect path.
- Registration mechanism for the global pipe/interceptors (`APP_PIPE` / `APP_INTERCEPTOR` DI providers vs `main.ts` `useGlobal*`) — prefer the DI-friendly approach matching the Phase 2 `APP_FILTER` pattern, mind the interceptor execution order.
- Exact validation-pipe flags (`whitelist`, `forbidNonWhitelisted`, `transform`, `transformOptions`) and where the shared DTO base / pagination-query DTO lives.
- ALS implementation detail (Node `AsyncLocalStorage` directly vs `nestjs-cls`) — as long as it satisfies D-11/D-12 and the filter reads from it.
- Exact `IdempotencyStore` interface shape and the no-op/in-memory backing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Shared Infrastructure (Platform Kernel)" — INFRA-04, INFRA-07, INFRA-08, INFRA-09, INFRA-10, INFRA-11, INFRA-12, INFRA-13 (authoritative requirement text); SEAM-06 under the seam requirements.
- `.planning/ROADMAP.md` § "Phase 3: Platform Kernel — Observability, Validation, Security & Health" — goal and 5 success criteria (the verification gate). Also § "Phase 2" to confirm the seams this phase extends and § "Phase 6" for where the audit context provider / tenancy is filled in.
- `.planning/PROJECT.md` § Constraints / Context — fixed stack (NestJS 11.1.x, Prisma 6.19.x, Node 22+), 5-layer layering constraint, microservice-extraction constraint that motivates the decentralized error catalog (D-10) and the audit/idempotency seams.

### Authoritative design source (API standards, security, health)
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — §6 API Design Standards (§256 "Support pagination where applicable", §258 "Produce OpenAPI documentation"), §12 Error Handling (envelope shape, unchanged), §13 API Security (§440 Rate Limiting, §441 Audit Logging — this phase builds the baseline; JWT/RBAC/org-membership land in later phases), §7 Health (§247), §14 API Versioning (`/api/v1`).
- `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md` — check for prescribed shared-infrastructure / observability conventions before finalizing logging and health layout.
- `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md` — confirm expected liveness/readiness probe semantics and graceful-shutdown expectations against the deployment target.

### Codebase state (current reality — Phase 2 output this phase builds on)
- `packages/backend/src/main.ts` — current bootstrap: global prefix `api` + URI versioning, `console.error` fatal handler (to be replaced by pino logger, `enableShutdownHooks` added).
- `packages/backend/src/app.module.ts` — `APP_FILTER` DI registration pattern (order-sensitive; new global pipe/interceptors follow this style) and the `CorrelationIdMiddleware` wiring under `configure()`.
- `packages/backend/src/common/middleware/correlation-id.middleware.ts` — the header-extraction logic (`x-request-id` → `traceparent` → UUID) to preserve while migrating id storage into ALS (D-12).
- `packages/backend/src/common/exceptions/global-exception.filter.ts` — currently reads `request.traceId`; must switch to reading from ALS. Also branches on `config.isProduction` for stack exposure.
- `packages/backend/src/common/exceptions/error-codes.ts` — `PLATFORM_ERROR_CODES` const + `PlatformErrorCode` type — the template the decentralized catalog (D-10) formalizes.
- `packages/backend/src/config/env.schema.ts` / `app-config.service.ts` / `config.module.ts` — the Zod fail-fast config module to extend with `CORS_ORIGINS`, `LOG_LEVEL`, throttler thresholds (D-16).
- `packages/database/generated/client/schema.prisma` (`model AuditLog`, `enum AuditAction`) — the audit target: `organizationId` non-nullable, `userId` nullable, `action AuditAction`, `resource` required, `resourceId`/`details`/`ipAddress`/`userAgent` optional. Consume via `@repo/database` `PrismaService`; no schema changes.
- `.planning/phases/02-platform-kernel-bootstrap-config-error-contract/02-CONTEXT.md` — Phase 2 decisions that bound this phase, especially **D-02** (traceId → ALS migration deferred here) and **D-07** (env set to extend).
- `.planning/codebase/STACK.md`, `STRUCTURE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md` — current conventions and implemented-vs-planned split.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@repo/database` `PrismaModule`/`PrismaService` — global, already implements `OnModuleInit`/`OnModuleDestroy`. Readiness health check pings through it; graceful shutdown (INFRA-13) relies on its existing `$disconnect` — do not add a second disconnect path.
- `CorrelationIdMiddleware` — header-extraction + UUID minting already correct; reuse the logic, change only where the id is stored (ALS).
- `PLATFORM_ERROR_CODES` / `PlatformErrorCode` — the shape and naming convention (dotted UPPER_SNAKE, `PLATFORM` prefix) the SEAM-06 catalog generalizes across domains.
- Phase 2 `APP_FILTER` DI registration + `config.isProduction` branch — the pattern for registering the new global pipe/interceptors and for env-gating Swagger.

### Established Patterns
- Conventions: kebab-case module dirs; files `[name].service.ts` / `.controller.ts` / `.interceptor.ts` / `.filter.ts` / `.module.ts`. Kernel additions (logging, validation, response, audit, health, security, conventions) follow the same `src/common/*` + `src/config/*` shape.
- Node 22+ / TypeScript 5.9.x, SWC builder (`nest build`), Vitest 4 (SWC). Filter/interceptor/pipe/config get Vitest unit tests; the audit write path is tested with an injected fake context provider.
- Global cross-cutting concerns register via DI providers (`APP_FILTER`, and now `APP_PIPE`/`APP_INTERCEPTOR`) — mind interceptor execution order (response wrapping vs audit).

### Integration Points
- `AppModule` gains: the pino logger module, global `ValidationPipe`, response + audit interceptors, health module (Terminus), Swagger setup (in `main.ts`, non-prod), Helmet + CORS + throttler, and `enableShutdownHooks`.
- New runtime deps to add to `@repo/backend`: `nestjs-pino` + `pino` (+ `pino-http`), `@nestjs/terminus`, `@nestjs/swagger`, `@nestjs/throttler`, `helmet`, `class-validator` + `class-transformer` (for the validation pipe/DTOs). ALS via Node built-in `AsyncLocalStorage` or `nestjs-cls` (discretion).
- Env schema extended with `CORS_ORIGINS`, `LOG_LEVEL`, throttler thresholds — must fail-fast like the Phase 2 set.

### Landmines
- Audit: `AuditLog.organizationId` is **non-nullable** and there is no tenant context yet — the interceptor must skip the write when no org context is resolvable (D-04); never fabricate an org id.
- "No stack traces in production" and "Swagger only non-prod" both hinge on `NODE_ENV` — already in the fail-fast set; reuse `config.isProduction`.
- Do not instantiate a second `PrismaClient` or a second disconnect (INFRA-14 / INFRA-13) — one Prisma seam via `@repo/database`.
- Interceptor ordering matters: the response-wrapping interceptor and audit interceptor must not fight; audit reads the outcome after a successful handler, wrapping shapes the payload.
- In-memory throttler + no-op/in-memory idempotency store are **single-instance only** — document that clearly so they are not mistaken for production-complete.
- Stray untracked artifact `packages/database/prisma.zip` present in the tree — ensure it is not committed.

</code_context>

<specifics>
## Specific Ideas

- Success envelope verbatim: `{ success: true, data, meta, traceId }`; `meta` null for single, `{ nextCursor, hasNextPage, ... }` for lists. Error envelope stays `{ success: false, errorCode, message, traceId }`.
- Audit decorator shape: `@Audit(action: AuditAction, resource: string)`; write is post-success, non-blocking, skipped without org context.
- Pagination contract: opaque cursor + limit → `meta.nextCursor` / `meta.hasNextPage`.
- Idempotency contract: `Idempotency-Key` request header → `IdempotencyStore` interface (no-op/in-memory now).
- Error codes: `PREFIX.CODE` dotted UPPER_SNAKE, per-domain const objects, `PLATFORM.*` for kernel codes.
- Redaction deny-list seed: `authorization`, `cookie`, `set-cookie`, `password`, `token`, `apiKey`, `secret`.
- Throttler default ~100 req/min/IP, per-route overridable, env-tunable.

</specifics>

<deferred>
## Deferred Ideas

- Real audit actor/tenant-context provider (populated `organizationId` + `userId`) — Phase 4 (principal) / Phase 6 (tenant context); injected into the seam built here (D-01).
- Persistent/distributed idempotency store and Redis-backed throttler storage — when shared infra (Redis/broker) is introduced; the interfaces/seams exist now (D-09, D-15).
- Authenticated production Swagger docs portal — revisit after Phase 4 if external consumers need live prod docs (D-14).
- Broader Prisma error-code mappings and additional readiness indicators (memory/disk, downstream services) — add when real endpoints/dependencies exercise them.

None of the above came from scope-creep during discussion — all are roadmap-defined later phases or explicitly-reserved seams.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 3-Platform Kernel — Observability, Validation, Security & Health*
*Context gathered: 2026-07-01*
