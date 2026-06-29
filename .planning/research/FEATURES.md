# Feature Research

**Domain:** Production-grade enterprise NestJS 11 backend foundation (modular monolith, microservice-ready) for an AI SDLC platform
**Researched:** 2026-06-29
**Confidence:** HIGH (foundational NestJS patterns are well-established and verified against current ecosystem; auth approach verified against Microsoft's deprecation of `passport-azure-ad`)

> **Scope note:** This file covers the *foundational capabilities* a permanent backend skeleton must provide — cross-cutting infrastructure, auth/RBAC scaffolding, tenancy primitives, and extraction-readiness. It deliberately excludes the platform's end-user AI features (Repository Intelligence, Documentation generation, LangGraph orchestration, etc.), which are future milestones. Where a future capability shapes a *foundation decision* (e.g., long-running workflows demanding a job/queue seam), it is called out as a forward-compatibility requirement, not as something to build now.

## Feature Landscape

### Table Stakes (A Production Backend Foundation Must Have These)

Missing any of these means the foundation is not production-ready and future domains will hack around the gap, causing rewrites.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Typed configuration + env validation** (`@nestjs/config` + schema validation via Zod or `class-validator`/Joi) | Fail-fast on missing/invalid env at boot, not at first request. Typed `ConfigService` prevents `process.env` sprawl. | LOW–MEDIUM | Validate on startup; throw if `DATABASE_URL`, Entra issuer/audience, etc. are absent. Namespaced config (`registerAs`) per concern. No secrets in code. Foundation for everything else. |
| **Structured JSON logging with correlation IDs** (`nestjs-pino` + `AsyncLocalStorage`) | Enterprise observability requires machine-parseable logs correlated across a request/workflow. Default Nest `Logger` is not structured. | MEDIUM | `nestjs-pino` (`/iamolegga/nestjs-pino`, Context7 HIGH) auto-attaches request context to every log line. Generate/propagate `x-correlation-id` (and `traceId`) via middleware + ALS. Redact secrets/tokens in serializers (CLAUDE.md §14). |
| **Global exception filter with standardized error envelope** | API contract (doc §12) mandates `{ success:false, errorCode, message, traceId }`. Prevents stack-trace/internal-ID leakage (CLAUDE.md §11). | MEDIUM | One `AllExceptionsFilter` mapping `HttpException` + domain errors + Prisma errors → typed envelope. Include `traceId`/`correlationId`. Map `PrismaClientKnownRequestError` codes (P2002 → 409, P2025 → 404). |
| **Global validation pipe** (`class-validator` + `class-transformer`) | "Assume hostile input" (CLAUDE.md §11). Validate body/params/query against typed DTOs. | LOW | `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })` global. DTOs per endpoint. Pairs with Swagger via `@nestjs/swagger` decorators. |
| **Response envelope interceptor** | Doc §6/§12 mandate standardized response objects. Consistent `{ success:true, data, meta }` shape across all domains. | LOW–MEDIUM | Single global `TransformInterceptor`. Decide envelope shape *once* now — changing it later touches every endpoint. Provide a `@RawResponse()` escape hatch for streaming/file endpoints. |
| **Health + readiness checks** (`@nestjs/terminus`) | K8s (EKS) liveness/readiness probes are mandatory for safe rollouts. DB connectivity must gate readiness. | LOW | `/health/live` (process up) and `/health/ready` (Prisma `SELECT 1`, plus Redis/Qdrant when wired). Terminus is the de-facto standard. Keep liveness cheap (no DB) to avoid restart storms. |
| **Swagger / OpenAPI at `/api/v1`** (`@nestjs/swagger`) | Doc §6 mandates OpenAPI. Drives frontend integration + contract clarity. | LOW–MEDIUM | Generated from DTO decorators. Document the error envelope + auth (Bearer/OIDC security scheme). Group by domain tag. Consider gating the UI behind auth in prod. |
| **API versioning `/api/v1`** | Doc §14 mandates URI versioning; breaking changes → `/api/v2`. | LOW | Use Nest `VersioningType.URI` with global prefix `api`. Establish now so every controller inherits it. |
| **Global auth guard scaffolding (JWT/OIDC Bearer)** | Doc §13: all APIs require JWT auth. Must validate Entra-issued tokens. | MEDIUM–HIGH | `passport-azure-ad` is **deprecated/unmaintained** (Microsoft moved it to MSAL.js). Use `passport-jwt` + `jwks-rsa` to validate Entra access tokens against the tenant JWKS endpoint (verify `iss`, `aud`, `exp`, signature). Global guard + `@Public()` decorator to opt-out (health, docs). Live tenant wiring is out-of-scope this milestone, but the validation seam + config must be real, not stubbed. |
| **RBAC authorization guard + decorators** | Doc §13 + seed already defines 16 permissions / 4 roles. Least-privilege (CLAUDE.md §11). | MEDIUM | `@RequirePermissions('organization:read')` decorator + `PermissionsGuard` reading roles/permissions from the Identity domain. Permission-based (not just role-based) since seed is permission-granular. Enforced after auth guard. |
| **Organization/Project tenancy foundation** | Every business object is org-scoped; doc §13 requires org/project membership checks. The multi-tenant boundary must exist before any domain stores data. | HIGH | Org + member + project + team CRUD on existing schema. Establish *how tenant context is resolved* (from token claim / header → request-scoped `TenantContext` via ALS) and *enforced* (repository-level org filter). Getting this wrong = security rewrite. See Dependencies. |
| **Audit logging interceptor/hook** | Doc §13 requires audit logging on APIs; `AuditLog` model exists; CLAUDE.md error strategy logs to `AuditLog`. | MEDIUM | Interceptor capturing actor, action, resource, org, outcome, correlationId → `AuditLog`. Async write (don't block response). Distinct from request logging. |
| **Request timing / metrics interceptor** | Monitoring service expects metrics; latency visibility is baseline ops. | LOW | Per-request duration + status into structured logs; expose a `/metrics` (Prometheus) seam for later. Don't over-build the metrics backend now. |
| **Graceful shutdown** | K8s sends SIGTERM on rollout/scale-down; in-flight requests + Prisma connections must drain cleanly. `PrismaService` already has shutdown hooks. | LOW | `app.enableShutdownHooks()`; ensure Prisma `$disconnect` + (later) queue drain on `OnModuleDestroy`. Type the existing `enableShutdownHooks(app: any)` as `INestApplication` (CONCERNS gap). |
| **Security headers + CORS + rate limiting** | Doc §13 requires rate limiting; enterprise baseline needs `helmet`, locked-down CORS. | LOW–MEDIUM | `helmet`, explicit CORS allowlist from config, `@nestjs/throttler` for rate limiting. Cheap to add now, painful to retrofit consistently. |
| **Consistent layered module scaffolding for all 14 domains** | Doc requires identical 5-layer structure (API→App→Domain→Infra→Persistence); scaffolding now means future domains "drop in." | MEDIUM | Generate `module/controller/service/repository` skeletons per domain with consistent file naming (`[domain].service.ts` etc.). Foundation domains (Identity, Organization) implemented; others scaffolded empty but wired. |
| **Build/lint/format/test toolchain** | CONCERNS: no `tsconfig`, ESLint, Prettier, or test runner exist. "Definition of Done" (CLAUDE.md §18) requires types compile + lint + tests pass. | MEDIUM | Root `tsconfig.base.json` (`strict:true`), ESLint + `@typescript-eslint`, Prettier (or Biome), Jest/Vitest. Workspace/monorepo tooling (Turborepo) + workspace package names. Prerequisite for any verifiable code. |

### Differentiators (Raise the Bar for Enterprise Readiness)

Not strictly required for "it runs," but they materially de-risk the platform's future and signal production maturity. Build the *seams* now even if full behavior is deferred.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Distributed tracing seam** (OpenTelemetry) | Correlate a single SDLC workflow across domains/future microservices. Correlation ID alone won't survive extraction. | MEDIUM–HIGH | Adopt OTel `traceId` as the correlation primitive now (W3C `traceparent`). Wire the SDK with a no-op/console exporter; swap to CloudWatch/OTLP later. Avoids re-instrumenting every domain post-extraction. |
| **Domain event bus abstraction** | Doc §8/§10 mandate async domain events for long-running workflows. An in-process event abstraction now → swap to Redis/Kafka on extraction without touching publishers. | MEDIUM | Define a `DomainEvent` contract + publisher/subscriber interface (start with Nest `EventEmitter2` or a thin internal bus). Immutable, versioned events (doc §8). This is the single most important extraction-readiness seam. |
| **Background job / queue abstraction seam** | Long-running AI workflows (minutes–hours) cannot run in a request thread. Foundation must define where async work lives. | MEDIUM | Define a `JobQueue` port now; defer Redis/BullMQ wiring (Redis is out-of-scope this milestone). Controllers must be able to return `202 Accepted` + job/workflow id pattern. Prevents synchronous-handler lock-in. |
| **Idempotency key support** | Workflow triggers + external integration callbacks (Azure DevOps webhooks) must be safely retryable. | MEDIUM | `Idempotency-Key` header → dedupe interceptor. Establish the convention; full store can come later. Pairs with "retryable" AI feature mandate (CLAUDE.md §12). |
| **Cursor/offset pagination convention** | Doc §6 requires pagination "where applicable." Defining the standard envelope (`meta.page`/`meta.cursor`) once prevents per-domain divergence. | LOW | Shared `PaginationQueryDto` + paginated response shape. Decide cursor vs offset policy now. |
| **Request-scoped tenant + actor context via `AsyncLocalStorage`** | Clean propagation of `correlationId`, `userId`, `orgId` to logs/repositories/audit without threading params. | MEDIUM | One ALS store set in middleware; consumed by logger, audit interceptor, and repository tenant filter. Powerful but must be set up carefully (avoid leaking context across async boundaries). |
| **Feature flag / config service seam** | Configuration service (doc §5) owns feature flags + cost limits. A flag abstraction lets foundation gate scaffolded-but-unimplemented domains. | LOW–MEDIUM | Thin interface backed by the existing `configuration` model; defer dynamic remote flags. Useful for "scaffolded domain returns 501 until enabled." |
| **Standardized problem-detail error codes catalog** | A typed, enumerated `errorCode` registry (vs ad-hoc strings) makes errors actionable + client-mappable (CLAUDE.md §13). | LOW | Central enum/registry of error codes shared across domains; referenced by the exception filter envelope. |
| **Liveness vs readiness vs startup probe distinction** | Beyond basic health: a startup probe prevents premature traffic during slow boot (migrations, JWKS warm-up). | LOW | Terminus supports composite indicators; map cleanly to K8s probe types. |
| **Soft-delete-aware repository base** | Schema uses `deletedAt`/`deletedBy` universally. A base repository enforcing soft-delete + tenant filter prevents per-domain mistakes. | MEDIUM | Centralize the soft-delete + org-scope query default so 14 domains can't each forget it. High leverage, but must not become a leaky god-abstraction. |

### Anti-Features (Deliberately NOT Build Into the Foundation Now)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Custom in-house auth / token issuance** | "We control it fully." | Re-implementing OIDC is a security liability; Entra ID is the mandated IdP. | Validate Entra-issued JWTs (`passport-jwt` + `jwks-rsa`). Be a resource server, never an issuer. |
| **Premature microservice split** | "Architecture is microservice-ready." | Splitting now multiplies ops burden with zero benefit; doc explicitly says *modular monolith first*. | Single deployable + clean module boundaries + event/job seams. Extract later without contract changes. |
| **Wiring Redis / Qdrant runtime now** | "We'll need them." | Out-of-scope this milestone (PROJECT.md); adds infra surface before any consumer exists. | Define ports/interfaces (job queue, vector store, cache) only. Wire when the consuming capability arrives. |
| **Implementing business logic in scaffolded domains** | "While we're in there." | Violates milestone scope; unimplemented domains would carry untested, schema-coupled logic. | Scaffold module/controller/service/repository skeletons; return `501 Not Implemented` or guard behind a disabled feature flag. |
| **Direct LLM SDK calls anywhere in the foundation** | "Quick to demo AI." | Bypasses AI Platform domain routing/cost/audit (ARCHITECTURE anti-pattern). | No LLM calls in foundation at all; AI Platform domain (future) owns execution. |
| **Generic `BaseService<T>` CRUD god-abstraction** | "DRY all CRUD." | Hides domain rules, fights bounded contexts, makes per-domain validation/authorization awkward. | Share *cross-cutting* infra (filter, interceptors, pagination DTO, soft-delete base repo) only; keep business services explicit. |
| **Cross-domain Prisma access "for convenience"** | "Faster than calling an API." | Violates bounded-context isolation (ARCHITECTURE); creates hidden coupling that blocks extraction. | Owning-domain published API (sync) or domain event (async). Enforce one-owner-per-model. |
| **GraphQL / gRPC layer** | "More flexible / faster." | Doc mandates REST `/api/v1` + OpenAPI; adding a second protocol now doubles surface with no requirement. | REST + OpenAPI only. Revisit transport per-service at extraction time if justified. |
| **Caching layer in the foundation** | "Performance." | No load profile yet; premature caching adds invalidation bugs. Redis is out-of-scope. | Define a `Cache` port; defer implementation. Optimize against measured N+1s later (CLAUDE.md §16). |
| **Exposing internal cuid IDs / verbose errors to clients** | "Easier debugging." | Leaks internals (CLAUDE.md §11); couples clients to internal identifiers. | Error envelope with `errorCode` + `traceId` only; consider opaque/public identifiers where externally exposed. |
| **Logging full request/response bodies** | "Full audit trail." | Leaks secrets/PII (CLAUDE.md §14); log bloat. | Structured event logging + redaction; audit *intent* (actor/action/resource), not raw payloads. |

## Feature Dependencies

```
Build/lint/format/test toolchain  (FIRST — gates verifiable code)
        └──enables──> everything below

Typed config + env validation
        ├──required by──> Auth guard (Entra issuer/audience/JWKS URL)
        ├──required by──> Logging (level/redaction)
        ├──required by──> CORS / rate limiting / Swagger gating
        └──required by──> Tenancy (resolution policy)

Correlation ID middleware + AsyncLocalStorage
        ├──required by──> Structured logging (request context)
        ├──required by──> Audit interceptor (correlationId in records)
        ├──required by──> Exception filter (traceId in envelope)
        └──enhanced by──> OpenTelemetry tracing (traceId as the primitive)

Auth guard (JWT/OIDC)
        └──required by──> RBAC guard (needs authenticated principal)
                              └──required by──> Tenancy enforcement (org/project membership)
                                                    └──required by──> Org/Project/Team CRUD authorization

Response envelope interceptor ──conflicts with──> raw streaming/file endpoints
        └──mitigated by──> @RawResponse() escape hatch

Domain event bus seam ──required by──> long-running workflow readiness ──required by──> future AI orchestration
Job/queue seam        ──required by──> 202-Accepted async handler pattern ──required by──> future LangGraph runs

Health/readiness ──depends on──> Prisma connectivity (DB probe)
Graceful shutdown ──depends on──> Prisma shutdown hooks (already present, needs typing fix)

Layered module scaffolding ──depends on──> all cross-cutting infra (so each domain inherits it uniformly)
```

### Dependency Notes

- **RBAC requires Auth:** the permissions guard needs an authenticated principal (roles/permissions resolved from Identity) before it can enforce. Order in the global guard chain: Auth → RBAC → (Tenancy membership).
- **Tenancy enforcement requires RBAC + Auth + ALS:** org/project scoping resolves from token claims into request context, then repository-level filters apply. This three-way dependency is why tenancy is HIGH complexity and must be designed before any domain persists data.
- **Logging/Audit/Exception envelope all consume the correlation primitive:** establish one ID propagation mechanism (ALS, ideally OTel `traceId`) and feed all three from it — do not let each build its own.
- **Event bus + job queue are the extraction-readiness seams:** publishers/handlers must depend on interfaces, not concrete transports, so the modular monolith can split into services without contract changes (doc §16).
- **Toolchain is the true prerequisite:** per CONCERNS, no `tsconfig`/lint/test exists; nothing else can meet the Definition of Done until this lands.

## MVP Definition (Foundation Milestone = the "MVP" here)

### Launch With (this milestone)

- [ ] Monorepo + build/lint/format/test toolchain (`tsconfig` strict, ESLint, Prettier/Biome, Jest/Vitest, workspace names) — gates all verifiable work
- [ ] NestJS 11 app bootstrap with global prefix + URI versioning (`/api/v1`)
- [ ] Typed config + startup env validation
- [ ] Structured JSON logging (`nestjs-pino`) + correlation-ID middleware + ALS context
- [ ] Global exception filter → standardized `{success,errorCode,message,traceId}` envelope (incl. Prisma error mapping)
- [ ] Global validation pipe + DTO convention
- [ ] Response envelope interceptor (+ escape hatch)
- [ ] Audit interceptor → `AuditLog`; request timing interceptor
- [ ] Terminus health: liveness + readiness (DB probe)
- [ ] Swagger/OpenAPI at `/api/v1` with auth + error schemas
- [ ] Security baseline: helmet, CORS allowlist, `@nestjs/throttler`
- [ ] Graceful shutdown (typed Prisma shutdown hook)
- [ ] Auth guard scaffolding: `passport-jwt` + `jwks-rsa` Entra token validation seam + `@Public()`
- [ ] RBAC: `@RequirePermissions()` + `PermissionsGuard` over seeded permissions/roles
- [ ] Organization + member + Project + team foundation CRUD with tenant scoping
- [ ] Request-scoped tenant/actor context (ALS) + soft-delete-aware, org-scoped repository base
- [ ] Consistent layered module scaffolding for all 14 domains (foundation domains implemented; rest skeleton + 501/flag-gated)
- [ ] Domain event bus *abstraction* + job/queue *port* (interfaces only) for workflow/extraction readiness

### Add After Validation (next milestones)

- [ ] OpenTelemetry exporter wiring (CloudWatch/OTLP) — trigger: deployment to EKS
- [ ] Redis/BullMQ job queue + Redis cache implementation — trigger: first long-running workflow capability
- [ ] Qdrant vector store implementation — trigger: Knowledge Hub milestone
- [ ] Idempotency-key store — trigger: external webhook integrations (Azure DevOps/GitHub)
- [ ] `/metrics` Prometheus endpoint — trigger: monitoring stack stand-up

### Future Consideration (v2+)

- [ ] Actual microservice extraction of a domain — only when scale/team boundaries justify it
- [ ] Multi-region / read-replica data strategy — defer until load profile exists
- [ ] Dynamic remote feature-flag service — defer until config service domain is built

## Feature Prioritization Matrix

| Feature | Enterprise Value | Implementation Cost | Priority |
|---------|------------------|---------------------|----------|
| Toolchain (tsconfig/lint/format/test/monorepo) | HIGH | MEDIUM | P1 |
| Typed config + env validation | HIGH | LOW | P1 |
| Structured logging + correlation IDs | HIGH | MEDIUM | P1 |
| Global exception filter + error envelope | HIGH | MEDIUM | P1 |
| Validation pipe + DTOs | HIGH | LOW | P1 |
| Response envelope interceptor | MEDIUM | LOW | P1 |
| Health/readiness (Terminus) | HIGH | LOW | P1 |
| Swagger/OpenAPI | HIGH | LOW | P1 |
| API versioning `/api/v1` | MEDIUM | LOW | P1 |
| Auth guard (Entra JWT via jwks-rsa) | HIGH | MEDIUM–HIGH | P1 |
| RBAC guard + decorators | HIGH | MEDIUM | P1 |
| Org/Project tenancy foundation | HIGH | HIGH | P1 |
| Audit interceptor | HIGH | MEDIUM | P1 |
| Graceful shutdown | HIGH | LOW | P1 |
| Security headers/CORS/rate limit | HIGH | LOW–MEDIUM | P1 |
| 14-domain layered scaffolding | HIGH | MEDIUM | P1 |
| Domain event bus abstraction (seam) | HIGH | MEDIUM | P1 (seam) / P2 (impl) |
| Job/queue port (seam) | HIGH | MEDIUM | P1 (seam) / P2 (impl) |
| Request timing/metrics interceptor | MEDIUM | LOW | P2 |
| OpenTelemetry tracing | HIGH | MEDIUM–HIGH | P2 |
| Pagination convention | MEDIUM | LOW | P2 |
| Idempotency keys | MEDIUM | MEDIUM | P2 |
| Feature-flag seam | MEDIUM | LOW–MEDIUM | P2 |
| Error-code catalog | MEDIUM | LOW | P2 |
| Redis/Qdrant runtime wiring | HIGH (later) | MEDIUM | P3 (deferred) |

**Priority key:** P1 = must-have for this foundation milestone · P2 = strong differentiator, land if capacity allows (seams in P1) · P3 = deferred to a later milestone by scope.

## Recommended Library Choices (verified)

| Capability | Recommendation | Confidence |
|------------|----------------|------------|
| Structured logging | `nestjs-pino` (`/iamolegga/nestjs-pino`) — request context in every log | HIGH (Context7) |
| Health checks | `@nestjs/terminus` | HIGH |
| OpenAPI | `@nestjs/swagger` | HIGH |
| Validation | `class-validator` + `class-transformer` | HIGH |
| Config validation | `@nestjs/config` + Zod (or Joi) | HIGH |
| Entra ID token validation | `passport-jwt` + `jwks-rsa` (NOT `passport-azure-ad` — deprecated/unmaintained by Microsoft, moved to MSAL.js) | HIGH (verified) |
| Rate limiting | `@nestjs/throttler` | HIGH |
| Security headers | `helmet` | HIGH |
| Tracing (deferred wiring) | OpenTelemetry SDK (`@opentelemetry/*`) | MEDIUM |
| Domain events (in-process seam) | `@nestjs/event-emitter` behind an internal interface | MEDIUM |

## Sources

- Project scope: `.planning/PROJECT.md`; architecture: `.planning/codebase/ARCHITECTURE.md`; conventions: `.planning/codebase/CONVENTIONS.md`; gaps: `.planning/codebase/CONCERNS.md`
- API/service standards: `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` (§6 API standards, §12 error format, §13 security, §14 versioning, §16 scalability)
- `nestjs-pino` (Context7 `/iamolegga/nestjs-pino`, High reputation) — structured logging with request context
- [passport-azure-ad is deprecated, moved to MSAL.js](https://github.com/AzureAD/passport-azure-ad) — confirms the recommended `passport-jwt` + `jwks-rsa` approach
- [Validating Microsoft Entra ID OAuth tokens in Node.js (JWKS, iss/aud/exp)](https://www.voitanos.io/blog/validating-entra-id-generated-oauth-tokens/)
- [Microsoft identity-web — Node.js token validation discussion](https://github.com/AzureAD/microsoft-identity-web/discussions/2405)

---
*Feature research for: enterprise NestJS backend foundation*
*Researched: 2026-06-29*
