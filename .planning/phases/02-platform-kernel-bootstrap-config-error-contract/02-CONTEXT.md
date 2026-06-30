# Phase 2: Platform Kernel — Bootstrap, Config & Error Contract - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring the real NestJS 11 application online: it boots, serves all routes under `/api/v1` (URI versioning), loads configuration through a typed, fail-fast (Zod) config service, returns every error through a single consistent envelope, and reaches Prisma only through the frozen `@repo/database` package. This is the cross-cutting kernel that all 14 domains later inherit — the conventions set here propagate platform-wide.

**In scope (INFRA-01, 02, 03, 05, 06, 14):**
- `main.ts` + `AppModule` bootstrap; global URI versioning so all routes live under `/api/v1`.
- Typed configuration with fail-fast Zod validation at startup; all config read through the config service.
- `process.env` access lint-banned outside the config module (plugs into the existing ESLint 9 flat config + CI gate from Phase 1).
- A single global exception filter producing `{ success, errorCode, message, traceId }`, with no stack traces leaked in production.
- Prisma error → HTTP status mapping (`P2002`→409, `P2025`→404) without leaking schema details.
- Prisma integrated solely through `@repo/database` (consume the existing global `PrismaModule`/`PrismaService`), zero schema changes.

**Out of scope (defer to later phases):**
- Structured logging, AsyncLocalStorage correlation ID, validation pipe, response/audit interceptors, health checks, Swagger, Helmet/CORS/rate-limit security baseline, graceful shutdown → **Phase 3** (INFRA-04, 07–13).
- The full error-code catalog, pagination, and idempotency-key conventions (SEAM-06) → **Phase 3**.
- Auth, RBAC, tenancy, org/project, AI/event seams, 14-domain scaffolding → Phases 4–9.
- Any change to the frozen `@repo/database` schema.

</domain>

<decisions>
## Implementation Decisions

### Error Envelope — traceId origin (INFRA-05)
- **D-01:** A request middleware **generates a v4 UUID per request, but adopts an inbound correlation header if present** (`x-request-id`, falling back to W3C `traceparent`). The id is stored on the request and surfaced as `traceId` in the error envelope (and available to any success path).
- **D-02:** This is a deliberate **seam for Phase 3**: when INFRA-04 lands the AsyncLocalStorage correlation-ID infrastructure, generation moves into the ALS correlation middleware and the exception filter simply reads the id from ALS — the envelope contract does not change. Do **not** ship a null/placeholder traceId; the contract must be whole at the end of this phase.

### Error Envelope — errorCode taxonomy (INFRA-05)
- **D-03:** errorCodes are **namespaced, single-level, dotted UPPER_SNAKE**: `PREFIX.CODE` (e.g. `PLATFORM.RESOURCE_CONFLICT`, `PLATFORM.NOT_FOUND`, `PLATFORM.VALIDATION_ERROR`, `PLATFORM.INTERNAL_ERROR`). This convention is the template every one of the 14 domains copies; domains will later use their own prefixes (`AUTH.*`, `ORGANIZATION.*`, …).
- **D-04:** The kernel's own cross-cutting codes use the **`PLATFORM`** prefix (chosen over `KERNEL`/`COMMON` — reads naturally for platform-wide errors and is clearly distinct from domain prefixes).
- **D-05:** This phase only mints the handful of generic codes the global filter and Prisma mapper need. The **formal error-code catalog (a TS enum/const) is Phase 3 / SEAM-06**; define the codes used here in a way that catalog can absorb without renaming.

### Configuration (INFRA-02, INFRA-03)
- **D-06:** Use **`@nestjs/config` with a Zod `validate()` for fail-fast startup validation**, env namespaced via `registerAs`, wrapped by a **thin typed `AppConfigService`** so callers get full type safety and `process.env` never leaks past the config module. (Chosen over a fully hand-rolled module and over untyped `ConfigService.get<T>()` — idiomatic Nest *and* fully typed, which is the bar for a foundation every domain inherits.)
- **D-07:** **Required env set that must fail-fast this phase:** `DATABASE_URL`, `PORT` (default `3000`), `NODE_ENV`. (User accepted the proposed minimal set; additional vars like `CORS_ORIGINS` / `LOG_LEVEL` arrive with the Phase 3 features that need them.)
- **D-08:** INFRA-03 enforcement (lint-ban `process.env` outside the config module) is wired into the **existing ESLint 9 flat config** so a violation fails the existing CI gate. The precise rule mechanism (`no-restricted-properties` / `no-process-env` / an `overrides` exception for the config dir) is Claude's discretion.

### Prisma Error Mapping (INFRA-06, INFRA-14)
- **D-09:** A **dedicated Prisma exception mapper/filter** (not inline in the general filter) maps `P2002`→409 and `P2025`→404, with **any other `PrismaClientKnownRequestError`→500, sanitized** (no schema/field details leaked). Scope is exactly the success criteria; broader codes (P2003/P2000/P2014…) are added per-domain when a real endpoint exercises them — no speculative mapping now.
- **D-10:** Prisma is reached **solely through the existing `@repo/database` `PrismaService`** (already global, already has `onModuleInit`/`onModuleDestroy`). No new PrismaClient instantiation, no schema changes. (Note: graceful-shutdown lifecycle wiring is Phase 3 / INFRA-13.)

### Claude's Discretion
- Global filter registration pattern (`APP_FILTER` provider for DI/testability vs `app.useGlobalFilters` in `main.ts`) — prefer the DI-friendly approach unless research finds a reason otherwise.
- Exact Zod schema strictness/flags and the `registerAs` namespace breakdown (e.g. `server` / `database` / `app`).
- Correlation-middleware registration mechanism and where the request-id is stashed (request object vs a request-scoped holder) given it will migrate to ALS in Phase 3.
- `main.ts` bootstrap specifics (versioning config object, port binding from typed config).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Shared Infrastructure (Platform Kernel)" — INFRA-01, INFRA-02, INFRA-03, INFRA-05, INFRA-06, INFRA-14 (authoritative requirement text).
- `.planning/ROADMAP.md` § "Phase 2: Platform Kernel — Bootstrap, Config & Error Contract" — goal and 5 success criteria (the verification gate). Also § "Phase 3" to confirm what is deliberately deferred (logging, validation, interceptors, health, Swagger, security, SEAM-06).
- `.planning/PROJECT.md` § Constraints / Context — fixed stack (NestJS 11.1.x, Prisma 6.19.x, Node 22+), layering constraint (API → Application → Domain → Infrastructure → Persistence), AI-mediation and microservice-extraction constraints.

### Authoritative design source (error contract & API standards)
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — §6 API Design Standards (versioned `/api/v1`, standardized responses, validate payloads, OpenAPI), §12 Error Handling (locks the envelope shape `{ success, errorCode, message, traceId }`), §14 API Versioning (`/api/v1`, breaking changes → new version).
- `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/` — check for any prescribed shared-infrastructure / config conventions before finalizing config layout.

### Codebase state (current reality)
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md` — current implemented-vs-planned split and naming conventions.
- `.planning/phases/01-monorepo-tooling-foundation/01-CONTEXT.md` — Phase 1 decisions that bound this phase (ESLint 9 flat config + CI gate exist; `packages/backend` is a minimal compile target with no `main.ts`/AppModule yet; Turborepo orchestration).
- `packages/database/src/prisma.service.ts` / `prisma.module.ts` — the existing global `PrismaModule`/`PrismaService` (`@repo/database`) this phase consumes. Do not modify the schema.
- `packages/backend/package.json` — current `@repo/backend` deps (`@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`); `@nestjs/config`, `zod`, and a UUID source will need adding.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@repo/database` `PrismaModule`/`PrismaService` — global, already implements `OnModuleInit`/`OnModuleDestroy` (`$connect`/`$disconnect`). Import into `AppModule`; this is the single Prisma access seam (INFRA-14).
- ESLint 9 flat config + GitHub Actions CI gate (Phase 1) — the lint-ban for `process.env` (INFRA-03) plugs into these; no new gate mechanism needed.

### Established Patterns
- Conventions (PROJECT.md / CONVENTIONS.md): kebab-case module dirs; files `[domain].service.ts` / `.controller.ts` / `.repository.ts` / `.module.ts`. The kernel's modules (config, error/exception) should follow the same file-naming shape.
- Node 22+ / TypeScript 5.9.x, SWC builder (`nest build`), Vitest 4 (SWC) — established Phase 1; tests for the filter/config use Vitest.

### Integration Points
- `packages/backend/src/` currently holds only `index.ts` + `index.spec.ts` (a minimal compile target). This phase introduces `main.ts` + `AppModule` and the kernel modules; wire `PrismaModule` and the global config module into `AppModule`.
- New runtime deps to add to `@repo/backend`: `@nestjs/config`, `zod`, a UUID source (Node's built-in `crypto.randomUUID` avoids a dependency), and whatever the bootstrap needs (`@nestjs/platform-express` is the standard adapter).

### Landmines
- Do not instantiate a second `PrismaClient` — all Prisma access flows through `@repo/database` (INFRA-14).
- "No stack traces in production" hinges on `NODE_ENV` — that var is in the required fail-fast set (D-07); the filter must branch on it for what detail it returns.
- Stray artifact `packages/database/prisma.zip` is present in the working tree (untracked) — ensure it is not committed.

</code_context>

<specifics>
## Specific Ideas

- Error envelope shape is fixed verbatim by both INFRA-05 and the design doc: `{ success, errorCode, message, traceId }`.
- errorCode example set the kernel mints: `PLATFORM.RESOURCE_CONFLICT` (409 / P2002), `PLATFORM.NOT_FOUND` (404 / P2025), `PLATFORM.VALIDATION_ERROR`, `PLATFORM.INTERNAL_ERROR` (500 / unknown).
- traceId honors `x-request-id` then `traceparent` (W3C) on inbound requests before minting a new UUID.

</specifics>

<deferred>
## Deferred Ideas

- AsyncLocalStorage correlation-ID infrastructure (INFRA-04) — Phase 3; traceId generation migrates into it (see D-02).
- Formal error-code catalog as a TS enum/const, plus pagination and idempotency-key conventions (SEAM-06) — Phase 3.
- Validation pipe, response/audit interceptors, health checks, Swagger, Helmet/CORS/rate-limit, graceful shutdown lifecycle (INFRA-07–13) — Phase 3.
- Broader Prisma error-code mappings (P2003, P2000/P2006, P2014, …) — add per-domain when a real endpoint needs them.

None of the above came from scope-creep during discussion — all are roadmap-defined later phases.

</deferred>

---

*Phase: 2-Platform Kernel — Bootstrap, Config & Error Contract*
*Context gathered: 2026-06-30*
