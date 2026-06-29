# Project Research Summary

**Project:** Enterprise AI Delivery Platform — Backend Foundation milestone
**Domain:** Production NestJS 11 modular-monolith backend foundation (14 bounded contexts, microservice-ready) on a frozen Prisma 6 / PostgreSQL data layer, Entra ID auth
**Researched:** 2026-06-29
**Confidence:** HIGH

## Executive Summary

This milestone builds the permanent backend skeleton for a 14-domain AI SDLC platform on top of an already-frozen `@repo/database` package (Prisma 6.19.3 / PostgreSQL, NestJS 11.1.27, Node 22+). The four research tracks converge strongly: experts build this kind of system as a **modular monolith that is microservice-ready by construction** — domains packaged as self-contained vertical slices (not technical layers), cross-domain communication only through published port interfaces (sync) and serializable domain events (async), and AI execution mediated exclusively through an AI Platform port. The single most valuable outcome of this milestone is that any domain can later be extracted to a microservice as a mechanical re-deployment rather than a rewrite — and that property is only achievable if the seams are designed now.

The recommended approach is a thin **Platform Kernel** (`core/` registered once + stateless `shared/` helpers) providing every cross-cutting concern — typed/validated config, structured JSON logging with correlation IDs, a single global exception filter emitting `{ success, errorCode, message, traceId }`, a strict global validation pipe, response/audit/timing interceptors, Terminus health checks, Swagger at `/api/v1`, and security baseline (helmet, CORS allowlist, throttler) — followed by auth, RBAC, tenancy, the Identity/Organization/Project foundation domains, an AI Platform port stub, and consistent empty-but-wired scaffolding for the remaining 12 domains. Authentication uses `passport-jwt` + `jwks-rsa` (the maintained Microsoft-recommended path; `passport-azure-ad` is deprecated) behind a swappable `TokenValidator` seam, kept strictly separate from DB-driven RBAC over the seeded 16 permissions / 4 roles.

The dominant risks are structural and cheap to prevent now but require a platform-wide rewrite to fix later: cross-domain Prisma access through the single global client (the top extraction risk), tenant scoping left to per-query discipline (the most catastrophic multi-tenant failure mode), leaking raw Prisma entities as cross-domain/HTTP contracts, and a late/inconsistent error contract. Mitigation is to enforce boundaries **mechanically** (eslint-plugin-boundaries / dependency-cruiser), confine `PrismaService` to each module's `persistence/` ring, establish a request-scoped tenant context early, and land the error/validation/logging contracts in shared infrastructure before any domain is implemented. One urgent carry-over from the codebase audit: `packages/database/.env` contains a live `DATABASE_URL` that is not gitignored — fix the gitignore and rotate the credential in the tooling phase.

## Key Findings

### Recommended Stack

The data layer is frozen and not re-evaluated; everything sits on top of it. NestJS 11.1.27 + Express adapter, with the stack pinned conservatively for a production foundation. All versions were verified against the npm registry on 2026-06-29 (HIGH confidence). See `.planning/research/STACK.md`.

**Core technologies:**
- **NestJS 11.1.27 (Express adapter)** — application framework, fixed by existing `@repo/database` dependency; Express keeps the broadest middleware ecosystem (Helmet/Passport).
- **TypeScript 5.9.x (NOT 6.0)** — TS 6.0 (Jan 2026) is too new for the decorator / `emitDecoratorMetadata` reflection NestJS, `class-validator`, and Prisma rely on; ecosystem not yet hardened.
- **ESLint 9.x (NOT 10)** — `typescript-eslint` 8.62 supports 10, but pin 9.x for plugin-ecosystem stability. Flat config either way.
- **Node 22+ LTS** — already required by the seed; pin via `.nvmrc`; avoid 24 (current, not LTS).
- **`passport-jwt` 4.0.1 + `jwks-rsa` 4.1.0** — Microsoft-recommended replacement for protecting an API with Entra-issued tokens; `passport-azure-ad` is officially deprecated/unmaintained.
- **`@nestjs/config` + `zod`** — fail-fast env validation at boot, inferred typed config object.
- **`class-validator` + `class-transformer`** — global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) + Swagger CLI-plugin schema generation.
- **`nestjs-pino` + `pino` + `nestjs-cls`** — structured JSON logging with per-request correlation context via AsyncLocalStorage (not request-scoped providers).
- **`@nestjs/swagger` / `@nestjs/terminus` / `@nestjs/throttler` / `helmet`** — OpenAPI at `/api/v1`, liveness/readiness (Prisma DB ping), rate limiting (in-memory now), security headers.
- **Vitest 4 + SWC** — ESM-native test runner matching the codebase's mandated `import` style; SWC builder for fast builds, `tsc` for CI type-check.

**Avoid:** `passport-azure-ad` (deprecated), TypeScript 6.0, Winston, request-scoped providers for trace context, raw `Error` throws, local password storage, and wiring Redis/Qdrant/microservice transport now (deferred — define ports only).

### Expected Features

The foundation must ship a complete set of cross-cutting capabilities so the 14 future domains "drop in" without hacking around gaps. See `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Build/lint/format/test toolchain + monorepo workspaces (gates all verifiable work — none exists today)
- Typed config + startup env validation; structured logging + correlation IDs
- Global exception filter → standardized error envelope (incl. Prisma `P2002`→409, `P2025`→404 mapping)
- Global validation pipe; response envelope interceptor (with `@RawResponse()` escape hatch)
- Audit interceptor → `AuditLog`; Terminus liveness/readiness; Swagger/OpenAPI; URI versioning `/api/v1`
- Entra JWT auth guard seam + `@Public()`; RBAC `@RequirePermissions()` + `PermissionsGuard` over seeded perms
- Organization/member + Project/team tenancy foundation with request-scoped tenant context
- Graceful shutdown (typed Prisma hook); security baseline (helmet/CORS/throttler)
- Consistent 5-layer scaffolding for all 14 domains (foundation implemented; rest skeleton)

**Should have (build the seam now, defer the impl):**
- Domain event bus abstraction — the single most important extraction-readiness seam
- Background job/queue port (202-Accepted pattern); OpenTelemetry `traceId` as the correlation primitive
- Soft-delete-aware, org-scoped base repository; idempotency-key convention; pagination convention; error-code catalog

**Defer (v2+ / later milestones):**
- OTel exporter wiring, Redis/BullMQ + cache, Qdrant, `/metrics` endpoint — wire when the consuming capability arrives
- Actual microservice extraction; multi-region data strategy; dynamic remote feature flags

**Explicit anti-features:** custom auth/token issuance, premature microservice split, runtime Redis/Qdrant now, business logic in scaffolded domains, direct LLM SDK calls anywhere, generic `BaseService<T>` god-abstraction, cross-domain Prisma access, GraphQL/gRPC, caching layer, exposing internal cuid IDs, logging full bodies.

### Architecture Approach

Physically structure `packages/backend` so architecture is enforced by construction. The cornerstone is a **1:1:1:1 mapping: module ↔ bounded context ↔ Prisma schema file ↔ future microservice** — already half-done because the schema is pre-split by domain. Each domain is a vertical slice with the documented 5 layers (`api → application → domain → infrastructure → persistence`); `domain/` has zero NestJS/Prisma imports. The only legal cross-module dependency is `contracts/` (port interfaces + serializable event classes + DI tokens). See `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. **Platform Kernel** (`core/` wired once + `shared/` stateless helpers) — config, logging, exception filter, validation pipe, interceptors, health, Swagger, auth/RBAC guards, base repository/DTO classes.
2. **Domain modules (×14)** — one NestJS module per bounded context; owns its 5 layers, data, events, and published port; never reaches into another domain's internals.
3. **`contracts/` layer** — the published surface of each domain (port interface + DI token for sync; event classes for async); zero framework deps.
4. **AI Platform module** — owns all LLM execution; business domains depend on `AiOrchestrationPort` only (lint-enforced ban on LLM SDK imports elsewhere); stubbed this milestone.
5. **Event infrastructure** — in-process domain-event delivery behind a `DomainEventPublisher` port; broker + transactional outbox (existing `WorkflowEvent` table is the natural substrate) deferred but seam present.
6. **`persistence/` ring** — the only layer that imports `PrismaService`; concentrates the `@repo/database` dependency per domain so a future DB split touches only that ring.

Boundaries are enforced **mechanically** (eslint-plugin-boundaries / dependency-cruiser + tsconfig path restrictions), not by reviewer vigilance.

### Critical Pitfalls

Top structural risks from `.planning/research/PITFALLS.md` (filtered for "would this force a foundation rewrite?"):

1. **Cross-domain Prisma access (top extraction risk)** — the global `PrismaService` can touch every table. Confine it to each module's `persistence/` ring, scope each repository to its own domain's models, and enforce with dependency-cruiser/lint (not convention). Consider a per-domain Prisma accessor exposing only that domain's delegates.
2. **Tenant scoping by per-query discipline (most catastrophic multi-tenant failure)** — one forgotten `where: { organizationId }` leaks a customer's data. Establish a request-scoped tenant context early (Org foundation owns it); defer the RLS-vs-Prisma-extension enforcement decision but design so the tenant context is always available. Write two-org isolation tests early.
3. **Auth pitfalls — deprecated library + authN/authZ conflation** — never use `passport-azure-ad`; validate Entra JWTs via `passport-jwt`+`jwks-rsa` behind a swappable `TokenValidator` seam; keep authentication (who you are) strictly separate from DB-driven RBAC (what you may do).
4. **Leaking raw Prisma entities as the contract** — publish explicit DTOs/interfaces per domain; strip internal fields (`deletedAt`, `createdBy`, raw relations) at the boundary via response DTOs + serialization interceptor.
5. **Late/inconsistent error contract** — define one envelope and a single global exception filter up front (maps Prisma codes, no stack traces in prod) before any domain is implemented.
6. **Untyped config & committed secrets (URGENT carry-over)** — `packages/database/.env` has a live `DATABASE_URL` not gitignored. Fix `**/.env` gitignore + rotate the credential in the tooling phase; route all config through a typed, boot-validated config service; lint-ban `process.env` outside it.

## Implications for Roadmap

The three researchers that addressed ordering converged on the same foundation sequence. Suggested phase structure:

### Phase 1: Monorepo & Tooling Foundation
**Rationale:** No tsconfig/ESLint/Prettier/test runner or workspace config exists; this gates all verifiable work (CLAUDE.md Definition of Done). Also the place to remediate the urgent secret exposure.
**Delivers:** npm workspaces wiring `@repo/database`; `tsconfig.base.json` (strict); ESLint 9 flat config + Prettier; Vitest + SWC; `nest-cli.json` (SWC builder); **fix `**/.env` gitignore + rotate the exposed `DATABASE_URL`**.
**Addresses:** Toolchain (P1 table stakes).
**Avoids:** Pitfall 9 (secrets in git / untyped config — the urgent half).

### Phase 2: Platform Kernel (Shared Infrastructure)
**Rationale:** Every controller/service/domain inherits these; landing them once prevents 14 divergent implementations and makes the error/validation/logging contracts impossible to retrofit later.
**Delivers:** NestJS bootstrap (`/api/v1` URI versioning); typed+validated config (Zod); `nestjs-pino` + correlation-ID via `nestjs-cls`; global exception filter + error envelope + Prisma-error mapping; global `ValidationPipe`; response/audit/timing interceptors; Terminus liveness/readiness (DB ping); Swagger; helmet/CORS/throttler; graceful shutdown; `BaseRepository` (soft-delete + org-scope) + shared DTOs.
**Uses:** `@nestjs/config`+zod, nestjs-pino/pino/nestjs-cls, class-validator, @nestjs/swagger/terminus/throttler, helmet (from STACK.md).
**Avoids:** Pitfalls 2 (bloated shared module), 3, 6, 9, 10, 11.

### Phase 3: Authentication (Entra ID) Infrastructure
**Rationale:** RBAC and tenancy both depend on an authenticated principal; auth is a distinct seam from authorization on purpose.
**Delivers:** `passport-jwt`+`jwks-rsa` `EntraJwtStrategy` behind a swappable `TokenValidator` interface; `@Public()` decorator; `CurrentUser` principal type; stub validator for dev/test (no live tenant this milestone, per scope).
**Avoids:** Pitfall 5a (deprecated library; build on a swappable seam).

### Phase 4: RBAC Authorization Infrastructure
**Rationale:** Separate phase from auth; enforces the seeded 16 permissions / 4 roles independently of token presence.
**Delivers:** `@RequirePermissions()` decorator + `PermissionsGuard` reading DB-driven permission codes; guard chain order Auth → RBAC → Tenancy.
**Avoids:** Pitfall 5b (authN/authZ conflation), coarse RBAC.

### Phase 5: Tenancy & Organization Foundation
**Rationale:** Highest-risk, must-design-early item — the multi-tenant boundary must exist before any domain persists data. Org foundation owns the request-scoped tenant context.
**Delivers:** request-scoped tenant/actor context (ALS) sourced from the principal; Organization + member CRUD; two-org isolation tests; a logged decision on RLS vs Prisma client extension (enforcement deferred, context available now).
**Avoids:** Pitfall 4 (tenant scoping by discipline).

### Phase 6: Project Foundation
**Rationale:** Project/team ownership underpins all downstream domains; builds directly on Organization tenancy.
**Delivers:** Project + team CRUD, org-scoped; `OrganizationPort`/project-summary contract for downstream consumers.

### Phase 7: AI Platform Port (stub) + Event/Extraction Seams
**Rationale:** Lets business domains compile against AI mediation and async communication now; encodes the extraction seams without building implementations.
**Delivers:** `AiOrchestrationPort` defined + provided (impl stubbed); `DomainEventPublisher` port + serializable `DomainEvent` base + in-process bus; lint ban on LLM SDK imports outside `modules/ai-platform/`. **Open decision to settle here/in plan: `@nestjs/cqrs` EventBus (Sagas for the long-running SDLC pipeline, per ARCHITECTURE.md) vs `@nestjs/event-emitter` behind the port (simplicity, per STACK.md).**
**Avoids:** Pitfall 8 (premature vs under-abstraction — seams, not implementations).

### Phase 8: 14-Domain Scaffolding + Boundary Enforcement
**Rationale:** Locks the permanent module shape so future milestones fill rings without restructuring; bakes boundaries into the scaffold template mechanically.
**Delivers:** identical 5-layer skeleton for the remaining 12 domains, each wired into `app.module.ts` with a `contracts/<domain>/` port stub; eslint-plugin-boundaries / dependency-cruiser rules (no cross-domain repo/service imports; only `persistence/` imports `PrismaService`; `contracts/`-only cross-module imports).
**Avoids:** Pitfalls 1, 3, 7 (cross-domain Prisma, leaking entities, structure that blocks extraction).

### Phase Ordering Rationale

- **Dependency-driven:** toolchain → kernel → auth → RBAC → tenancy → project follows the discovered chain (RBAC needs auth; tenancy needs RBAC+auth+ALS; project needs org). The FEATURES dependency graph and ARCHITECTURE build order both produce this sequence.
- **Architecture-driven grouping:** cross-cutting kernel lands before any domain so all 14 inherit it uniformly; the AI/event seams precede mass scaffolding so the template embeds them; boundary enforcement lands with scaffolding so violations fail CI from day one.
- **Pitfall-avoidance:** the most expensive structural mistakes (cross-domain DB, tenant leakage, error/auth contracts) are each pinned to the earliest phase that can prevent them, before domain code exists to repeat them.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 5 (Tenancy):** highest-risk; the RLS-vs-Prisma-client-extension enforcement mechanism and ALS-based tenant-context propagation across async boundaries warrant a focused decision (community-tier sources, MEDIUM confidence).
- **Phase 7 (Event/AI seams):** the **CQRS EventBus vs event-emitter** open decision needs settling (the two researchers disagree); also the serializable-event + future-outbox contract (`WorkflowEvent` substrate) is MEDIUM-confidence community guidance.
- **Phase 3 (Auth):** Entra JWKS validation specifics (`iss`/`aud`/v2.0 issuer formats, key caching) — library landscape is actively shifting; verify against current Microsoft docs at plan time.

Phases with standard, well-documented patterns (can skip research-phase):
- **Phase 1 (Tooling):** established NestJS/monorepo setup.
- **Phase 2 (Kernel):** HIGH-confidence, well-trodden NestJS infrastructure patterns.
- **Phase 4 (RBAC) / Phase 6 (Project) / Phase 8 (Scaffolding):** standard guard/CRUD/templating patterns once the kernel and tenancy decisions exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions + peer deps verified against npm registry 2026-06-29; `passport-azure-ad` deprecation confirmed against official Microsoft/AzureAD sources. |
| Features | HIGH | Foundational NestJS patterns well-established; auth approach verified against Microsoft deprecation; mapped to authoritative API/service docs (§6/§12/§13/§14). |
| Architecture | HIGH (patterns) / MEDIUM (event-bus choice) | Module=context, contracts-only imports, port seams verified against NestJS/CQRS docs and authoritative platform design; the CQRS-vs-event-emitter recommendation differs from STACK.md and is community-corroborated (MEDIUM). |
| Pitfalls | HIGH (architecture/Prisma/NestJS) / MEDIUM (Entra landscape, tenancy enforcement) | Structural pitfalls verified against docs/community consensus; Entra library landscape and RLS-vs-extension are actively shifting / community-tier. |

**Overall confidence:** HIGH

### Gaps to Address

- **Event transport (CQRS EventBus vs event-emitter):** STACK.md recommends `@nestjs/event-emitter` behind a `DomainEventBus` interface (simplicity); ARCHITECTURE.md argues for `@nestjs/cqrs` EventBus to get Sagas for the long-running SDLC pipeline. Both agree the transport sits behind a `DomainEventPublisher` port, so call sites are safe either way. **Settle in Phase 7 planning** — likely CQRS if the saga/human-approval orchestration is in near-term scope, event-emitter if maximal simplicity wins now.
- **Tenant enforcement mechanism (RLS vs Prisma client extension):** defer the enforcement choice, but design Phase 5 so a trusted request-scoped tenant context is always available (it can feed either an RLS session variable or a Prisma extension). Decide at Phase 5 planning with isolation tests as the acceptance gate.
- **Live Entra tenant wiring:** explicitly out of scope this milestone; the seam + config must be real (not stubbed away). Verified in its own future milestone.
- **HTTP DTO validation library:** `class-validator` is the chosen default; `nestjs-zod` is a viable single-schema-language alternative — only revisit if a schema-first DX is later preferred.
- **Connection-pool sizing / PgBouncer:** a known EKS-scale trap; not a foundation blocker but flag for the deployment milestone.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`), queried 2026-06-29 — exact versions + peer deps for the full stack; `passport-azure-ad` deprecation flag.
- Microsoft Support security bulletin + AzureAD/passport-azure-ad GitHub/npm — confirms deprecation, points to MSAL.js / JWKS validation replacement.
- `@nestjs/cqrs` docs (Context7 `/nestjs/cqrs`) and NestJS 11 core/migration docs — EventBus/Saga patterns, shutdown-hook ordering, ConsoleLogger/CacheModule changes.
- `nestjs-pino` (Context7 `/iamolegga/nestjs-pino`) — structured logging with request context.
- Authoritative platform design: `Enterprise-AI-Delivery-Platform-Documentation/` (High-Level-Design §20/§22, Service-API-Architecture §6/§12/§13/§14, DAS Volumes I–IV) and `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, CONCERNS, TESTING) — conformed to, not redesigned.

### Secondary (MEDIUM confidence)
- AzureAD/microsoft-identity-web Discussion #2405 and Entra-token-validation blog (Voitanos) — `passport-jwt`+`jwks-rsa` as the Bearer-token replacement path.
- Modular-monolith / microservice-extraction practice (Synapse Studios standards, Milan Jovanović, dev.to/Medium DDD-in-Nest) — dependency-cruiser enforcement, domain events, no shared DB, outbox/dual-write analysis.
- Prisma multi-tenant isolation (ZenStack, RLS-with-Prisma, "making `where` required") — forgotten-filter risk, RLS vs Prisma extension.

### Tertiary (LOW confidence)
- None load-bearing; all key recommendations rest on HIGH or corroborated-MEDIUM sources.

---
*Research completed: 2026-06-29*
*Ready for roadmap: yes*
