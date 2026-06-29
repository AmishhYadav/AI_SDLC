# Pitfalls Research

**Domain:** Production enterprise NestJS 11 modular-monolith backend foundation (14 bounded contexts, microservice-ready, frozen Prisma/PostgreSQL schema, Entra ID auth)
**Researched:** 2026-06-29
**Confidence:** HIGH (architecture/coupling, Prisma, NestJS 11 specifics verified against docs/community); MEDIUM (Entra ID library landscape — actively shifting)

> Scope note: This milestone builds the *foundation* only. The most expensive mistakes here are structural — they are cheap to prevent now and require a platform-wide rewrite to fix later. Every pitfall below is filtered for "would this force a rewrite of the permanent foundation?" Generic web-app advice is excluded.

---

## Critical Pitfalls

### Pitfall 1: Cross-domain Prisma access (the shared-client trap)

**What goes wrong:**
`@repo/database` exposes a single global `PrismaService` whose client can read/write *every* table in all 14 domains. The path of least resistance is for `PlanningRepository` to call `prisma.workItem.findMany()` and also `prisma.repository.findUnique()` because "it's right there." This silently couples Planning to Repository's storage schema. When you later extract Repository to its own service, Planning breaks because the table no longer exists in its database.

**Why it happens:**
The global `@Global()` `PrismaModule` makes the entire client injectable everywhere with zero friction. Nothing in the type system or DI graph stops a domain from touching another domain's models. The DAS rule ("direct cross-domain DB access is prohibited") is a *convention* with no enforcement.

**How to avoid:**
- Each domain owns a repository layer; that repository may only touch tables in its own `.prisma` domain file. Document the model→domain ownership map (it already exists in ARCHITECTURE.md) as the authoritative allow-list.
- Enforce mechanically, not by review: add `dependency-cruiser` (or ESLint `no-restricted-imports` + a custom rule) so a domain module cannot import another domain's repository, and ideally so only repositories — never services/controllers — import `PrismaService`.
- Cross-domain reads go through the owning domain's service interface (sync) or a domain event (async), never a direct query.
- Consider a thin per-domain Prisma accessor that exposes only that domain's delegates, so a `PlanningRepository` literally cannot see `prisma.repository`.

**Warning signs:**
- A repository file imports/queries a model defined in another domain's `.prisma` file.
- `grep` for a model name (e.g., `prisma.adr`) returns hits in more than one domain directory.
- Service-layer or controller code injecting `PrismaService` directly.

**Phase to address:** Prisma Integration phase (establish per-domain repository boundary + lint enforcement) and Module Scaffolding phase (bake the boundary into the scaffold template).

---

### Pitfall 2: Hidden coupling via a "shared" / "common" module that grows business logic

**What goes wrong:**
A `shared`/`common` module starts as a home for genuinely cross-cutting infrastructure (logger, exception filter, base DTOs) and gradually accumulates domain types, enums, and "utility" functions that encode business rules. Every domain imports it, so it becomes an un-extractable hub. When you split out a microservice, it drags the entire shared module — and therefore every other domain's logic — with it. This is the #1 cause of a "distributed monolith."

**Why it happens:**
"Don't repeat yourself" gets misapplied to *coincidental* duplication. Two domains have a similar-looking `Status` enum, so someone hoists it into `common`. Now the two domains are coupled forever through a shared kernel they never agreed to share.

**How to avoid:**
- Restrict the shared module to *infrastructure with no business meaning*: config, logging, the exception contract, interceptors, pipes, decorators, health, Swagger setup, generic pagination DTOs.
- Business types, enums, and rules live in their owning domain. Duplication of a 3-line enum across two domains is *cheaper* than coupling them.
- Treat the shared kernel as append-rarely. Adding to it requires justifying that the concept is genuinely domain-agnostic.
- Prisma-generated types are the one sanctioned shared "kernel" (they come from the frozen schema) — but expose them through domain repositories, don't pass raw Prisma models across domain boundaries as the public contract.

**Warning signs:**
- `shared/`/`common/` contains files with domain names (`shared/planning-helpers.ts`).
- The shared module imports from a domain module (dependency direction must always be domain → shared, never shared → domain).
- A change to a "utility" function requires regression-testing multiple domains.

**Phase to address:** Shared Infrastructure phase — define and document the shared-module charter up front; enforce dependency direction with dependency-cruiser.

---

### Pitfall 3: Exporting concrete Prisma entities as the cross-domain contract

**What goes wrong:**
Domain A's service returns a raw Prisma `Organization` model (with `deletedAt`, `createdBy`, internal cuid relations, and every column) to Domain B. Now Domain B is coupled to Domain A's *storage shape*. A frozen schema mitigates churn today, but it also means internal IDs, soft-delete fields, and audit columns leak across boundaries and into HTTP responses — violating "never expose internal IDs / sensitive fields." Extraction later forces a contract redesign anyway.

**Why it happens:**
Prisma generates beautiful types for free, so returning them feels efficient. There is no compiler pressure to define a separate contract.

**How to avoid:**
- Every domain publishes an explicit interface/DTO for what it exposes to other domains and to HTTP — separate from the Prisma model. Map at the repository or service boundary.
- HTTP responses are shaped by response DTOs + a serialization interceptor (`ClassSerializerInterceptor` or explicit mappers), never the raw entity.
- Internal fields (`deletedAt`, `createdBy`, `updatedBy`, raw relation arrays) are stripped at the boundary by default.

**Warning signs:**
- A controller returns the value of a repository call directly with no mapping.
- HTTP responses contain `deletedAt: null`, `createdBy`, or unbounded nested relations.
- A domain's public method signature references a Prisma-generated type.

**Phase to address:** Shared Infrastructure phase (response-shaping interceptor + DTO conventions) and each domain's scaffold (contract interface stubs).

---

### Pitfall 4: Tenant scoping left to per-query discipline (org/project data isolation)

**What goes wrong:**
Multi-tenancy here is logical (shared schema, `organizationId`/`projectId` columns). The dangerous pattern is relying on every developer to remember `where: { organizationId }` on every query, forever. One forgotten filter leaks one customer's BRDs, code, or repositories to another. Verified as the single most common — and most catastrophic — multi-tenant failure mode.

**Why it happens:**
The tenant filter is dispersed across hundreds of query sites. It is invisible when omitted (the query still works, just returns too much). Tests written against single-tenant fixtures never catch it.

**How to avoid:**
- Centralize tenant scoping so it cannot be forgotten. Options, in order of robustness for this stack:
  1. **PostgreSQL Row-Level Security (RLS)** keyed off a session variable set per-request — the DB enforces isolation even if app code is buggy. Strongest guarantee. (Note: the schema is frozen, but RLS is applied via additive migrations/policies later — keep the *foundation* designed so a tenant context is always available to set the session var.)
  2. **Prisma Client Extension** that auto-injects `organizationId` into `where` for tenant-scoped models, sourced from a request-scoped tenant context.
- Establish a **request-scoped tenant context** (from the authenticated principal) in the foundation now, even before enforcement is wired, so every later domain has a single, trusted source of the current org/project.
- Write isolation tests early: seed two orgs, query as org A, assert zero rows from org B.

**Warning signs:**
- Repository methods take `organizationId` as an optional param, or some queries omit it.
- No request-scoped tenant/principal context exists; controllers pass org IDs around manually.
- Tests only ever use one organization.

**Phase to address:** Organization foundation phase (request-scoped tenant context) + a dedicated decision on RLS-vs-extension; Auth phase populates the principal that feeds the context.

---

### Pitfall 5: Coupling auth to a deprecated/wrong Entra ID library and conflating authN with authZ

**What goes wrong:**
Two distinct failures:
(a) Building on `passport-azure-ad`, which is **deprecated and no longer maintained** (Microsoft moved it to the MSAL repo; security fixes stopped). A foundation built on it inherits an unmaintained, vulnerable auth core.
(b) Treating "logged in via Entra" as authorization. Entra ID (authentication: *who you are*, via OIDC ID token + JWT validation) is separate from the platform's RBAC (authorization: *what you may do*, via the seeded 16 permissions / 4 roles). Conflating them means every permission decision is wrong the moment roles matter.

**Why it happens:**
`passport-azure-ad` is still the top search result and has historical tutorials. And SSO "just working" creates the illusion that access control is done.

**How to avoid:**
- For a resource-server API, validate Entra-issued JWTs using a maintained, generic OIDC/JWKS approach: `passport-jwt` with `jwks-rsa` pointed at the tenant's JWKS endpoint, or `jose` for direct JWKS validation. Avoid `passport-azure-ad`. Use MSAL on the client/token-acquisition side.
- Keep an **auth abstraction seam**: a `TokenValidator` interface and a `CurrentUser` principal type, so the Entra-specific validator is one swappable adapter. This milestone explicitly does *not* wire a live tenant — so the seam must let you stub validation in dev/test and drop in the real issuer/audience later.
- Authentication produces a principal; **RBAC guards** (NestJS `CanActivate` + a `@RequirePermissions()` decorator reading the seeded permission codes) make every authorization decision. Permissions come from the DB roles, not from token presence.
- Validate `iss`, `aud`, `exp`, signature, and tenant — never trust unvalidated claims.

**Warning signs:**
- `passport-azure-ad` in `package.json`.
- Guards check only "is there a valid token" with no permission check.
- Entra-specific types leak into domain services (tight coupling to the IdP).
- Hardcoded role/permission strings instead of the seeded permission codes.

**Phase to address:** Auth (Entra ID) infrastructure phase (validation seam + principal) and RBAC infrastructure phase (permission guard + decorator). These are two separate phases on purpose.

---

### Pitfall 6: Inconsistent / leaky error contract established too late

**What goes wrong:**
Each domain throws ad-hoc errors and shapes responses differently. Some leak stack traces or Prisma errors (`P2002 unique constraint on column "email"` exposes schema internals and internal IDs). Frontend and external integrators must special-case every endpoint. Retrofitting a uniform contract across 14 domains after the fact is a massive, breaking change.

**Why it happens:**
Error handling feels like a per-endpoint concern, so it is deferred. Prisma's `PrismaClientKnownRequestError` is thrown raw because mapping it is tedious.

**How to avoid:**
- Define **one** error envelope in the foundation: stable machine-readable `code`, human message (what failed / why / how to fix per CLAUDE.md §13), `traceId`, no stack traces in production responses.
- A **global exception filter** is the only place that serializes errors. It maps NestJS `HttpException` subclasses and translates known Prisma error codes (`P2002`→409 Conflict, `P2025`→404, etc.) into the envelope without leaking column/table names.
- Provide a small set of typed domain exceptions (`EntityNotFound`, `Conflict`, `Forbidden`, `ValidationFailed`) all domains reuse.
- Every error carries the request/trace ID so it correlates with logs.

**Warning signs:**
- More than one error response shape across endpoints.
- Prisma error codes or `error.message` strings reaching the client.
- 500s with stack traces in any non-local environment.

**Phase to address:** Shared Infrastructure phase — exception filter + error contract + Prisma-error mapping are foundational and must precede domain implementation.

---

### Pitfall 7: Structuring the monolith so microservice extraction requires a rewrite

**What goes wrong:**
Domains are organized as anemic technical layers (`controllers/`, `services/`, `repositories/` at the root) instead of self-contained vertical modules. Synchronous in-process calls reach directly into another domain's *service implementation* rather than a published interface. When you extract a domain, there is no seam: the call site, the DI wiring, and the data access are all entangled across the would-be service boundary, so extraction becomes a rewrite — the exact outcome PROJECT.md forbids.

**Why it happens:**
The default NestJS tutorials organize by technical type, and direct service injection across modules "just works" in a monolith. The cost is invisible until extraction.

**How to avoid:**
- **Package by domain, not by layer.** Each domain is a self-contained module folder (`api/`, `application/`, `domain/`, `infrastructure/`, `persistence/` inside it). A domain is the unit you would lift out.
- Cross-domain sync calls go through a **published interface token**, not the concrete service class — so the in-process implementation can be swapped for an HTTP/gRPC client adapter at extraction with no call-site changes.
- Async cross-domain communication uses a **domain-event abstraction** (start with an in-process event bus that has the same publish/subscribe contract a message broker will later satisfy). The DAS already defines which links are sync vs async — encode that now.
- No shared mutable state across domains; no cross-domain DB transactions.

**Warning signs:**
- Folder structure is `src/controllers`, `src/services`, `src/repositories` instead of `src/<domain>/...`.
- A domain imports another domain's concrete `*.service.ts` class.
- A single transaction spans tables from two domains.
- The in-process event mechanism leaks NestJS-specific or in-memory-only assumptions into handlers.

**Phase to address:** Module Scaffolding phase (vertical-slice scaffold template for all 14 domains) and Shared Infrastructure phase (event-bus + published-interface conventions).

---

### Pitfall 8: Premature abstraction of AI/workflow/event infrastructure (and its opposite)

**What goes wrong:**
Two symmetric failures, both costly here:
- **Over-abstraction:** Building a generic plugin framework, full event-sourcing, or a speculative message-broker abstraction *now*, when no domain logic exists to validate the design. The foundation balloons, slows delivery, and ossifies the wrong assumptions.
- **Under-abstraction:** Hardwiring direct calls and in-memory assumptions with no seam, so future extraction/AI mediation requires rewrites — which PROJECT.md explicitly forbids.

**Why it happens:**
The grand documented vision (8 LangGraph graphs, cost routing, checkpointed state) tempts building it all up front; the "ship fast" instinct tempts skipping seams entirely. The foundation needs *seams, not implementations*.

**How to avoid:**
- Build **interfaces and boundaries** for the things the architecture guarantees (AI mediation via AI Platform, domain events, tenant context, published domain APIs) but the **simplest working implementation** behind them (in-process event bus, no broker; a stub AI Platform port; no real LangGraph yet).
- Apply the rule: abstract a boundary the moment the architecture *requires* swappability (extraction, AI mediation, IdP), not because it *might* be nice.
- Don't scaffold business logic into the 11 non-foundation domains — module shell + boundaries only (matches the milestone's "scaffold all, implement foundation" decision).

**Warning signs:**
- A message broker, event store, or plugin system is being built before any domain consumes it.
- Conversely: a foundation `TODO` says "wire AI here later" with a direct, un-seamed call.
- Abstractions with exactly one implementation and no second one on the roadmap *and* no extraction/mediation rationale.

**Phase to address:** Architecture-decision gate before Module Scaffolding; revisited per phase. The "supports long-running workflows / AI orchestration / extraction without rewrites" requirement is satisfied by seams, not implementations.

---

### Pitfall 9: Configuration & secrets handled ad-hoc and untyped

**What goes wrong:**
`process.env` is read directly in services, untyped and unvalidated. A missing/malformed env var fails deep in a request at runtime instead of at boot. Secrets land in committed `.env` files (CONCERNS.md already flags an unprotected `packages/database/.env` with live `DATABASE_URL`, plus no `**/.env` gitignore). Per-environment config drifts. This is a security and reliability foundation crack.

**Why it happens:**
`process.env.FOO` is the fastest thing to type. Validation feels optional until the first 3am misconfiguration outage.

**How to avoid:**
- Single typed config layer: `@nestjs/config` with **schema validation at startup** (zod/joi). App refuses to boot on invalid/missing config — fail fast, loudly.
- No service reads `process.env` directly; everything goes through the typed config service. Lint-ban `process.env` outside the config module.
- Secrets never in source: fix the gitignore (`**/.env`, `**/.env.*`, `packages/database/generated/`) immediately, rotate the exposed dev credential, and design config to source secrets from an external manager (AWS Secrets Manager / SSM for the EKS target) — env vars are the *interface*, not the storage.
- Provide `.env.example` (committed) documenting every required key with no values.

**Warning signs:**
- `process.env.` appearing outside the config module.
- App boots successfully with a missing required variable, fails later.
- Any `.env` tracked by git; secrets in `git log`.

**Phase to address:** Project/Monorepo Tooling phase (gitignore + secret rotation, urgent) and Shared Infrastructure phase (typed validated config service).

---

### Pitfall 10: Validation as an afterthought / trusting inbound data

**What goes wrong:**
DTOs lack validation, or `ValidationPipe` is registered without `whitelist`/`forbidNonWhitelisted`, so clients can inject extra fields that flow into Prisma writes (mass-assignment: a client sets `organizationId`, `createdBy`, or `isActive` it shouldn't). Numeric/enum coercion is inconsistent. Given the frozen schema's strict constraints, malformed input surfaces as opaque DB constraint errors instead of clean 400s. CLAUDE.md §11 ("assume hostile input") is violated by default.

**Why it happens:**
A bare `app.useGlobalPipes(new ValidationPipe())` looks complete but is permissive without explicit options.

**How to avoid:**
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, and explicit `transformOptions`.
- Every endpoint has a `class-validator`/`class-transformer` DTO; validate body, params, and query. Never bind a Prisma input type directly to the request.
- Tenant/owner fields (`organizationId`, `createdBy`, audit fields) are set server-side from the principal/context, never accepted from the client.

**Warning signs:**
- Controllers accept `any`/`Partial<Model>` or pass `req.body` to a repository.
- `ValidationPipe` registered with no options.
- Audit/ownership fields appear in request DTOs.

**Phase to address:** Shared Infrastructure phase (global pipe + DTO conventions), enforced in every domain scaffold.

---

### Pitfall 11: Logging/observability that can't trace a request and leaks secrets

**What goes wrong:**
Plain `console.log` / unstructured NestJS default logger means no JSON for CloudWatch, no correlation ID, no way to follow one request across 14 domains and (later) async workflows. Worse, naive request logging dumps headers/bodies including the Entra bearer token, `DATABASE_URL`, or PII — violating CLAUDE.md §14. Retrofitting correlation IDs after domains exist is invasive.

**Why it happens:**
The framework's default logger is "good enough" in dev. Correlation and redaction only matter once you're debugging production across services.

**How to avoid:**
- Structured JSON logger (`pino` via `nestjs-pino`, or a configured NestJS logger) from day one. NestJS 11's `ConsoleLogger` improved, but production wants JSON for CloudWatch.
- **Correlation/trace ID** generated per request (interceptor/middleware), attached to every log line and the error envelope, and propagated through the event bus so it survives into async workflows — designed now even though workflows come later.
- Redaction list at the logger level: never log `authorization`, tokens, passwords, connection strings, or known PII fields.
- Distinguish liveness vs readiness in health checks (`@nestjs/terminus`): readiness must check DB connectivity so EKS doesn't route traffic to a pod that can't reach Postgres.

**Warning signs:**
- `console.log` anywhere in app code.
- Logs lack a request/trace ID; cannot reconstruct one request's path.
- A single `/health` that returns 200 even when the DB is down.
- Auth headers or connection strings visible in logs.

**Phase to address:** Shared Infrastructure phase (logger + correlation interceptor + health checks); correlation propagation contract revisited when the event bus lands.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inject global `PrismaService` directly into services | Skip repository layer, faster CRUD | Cross-domain leakage, un-extractable, untestable services | Never — violates layering + extraction goal |
| Return raw Prisma entities from controllers | No DTO mapping work | Leaks internal/audit fields; storage shape becomes public contract | Never in this milestone (security + contract risk) |
| `passport-azure-ad` for Entra | Familiar tutorials | Deprecated/unmaintained auth core; security debt | Never — use maintained JWKS/JWT validation |
| Per-query `where: { organizationId }` discipline (no central enforcement) | Ship sooner | One forgotten filter = cross-tenant data leak | Only with isolation tests + a planned move to RLS/extension |
| In-process event bus (no broker) | No infra to run; simple | None *if* it implements a broker-compatible contract | Acceptable and recommended for the foundation |
| Scaffold-only for 11 non-foundation domains | Establishes structure fast | None if boundaries are real, not empty folders | Acceptable — matches milestone plan |
| Read `process.env` directly | Fastest config access | Runtime failures, no validation, scattered config | Never — use typed validated config |
| Skip correlation ID "for now" | Less plumbing | Invasive retrofit across 14 domains + async flows | Never — cheapest to add at foundation |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Microsoft Entra ID (OIDC) | Using deprecated `passport-azure-ad`; trusting unvalidated claims | Maintained JWT+JWKS validation (`passport-jwt`+`jwks-rsa` or `jose`); validate `iss`/`aud`/`exp`/signature/tenant; keep a swappable `TokenValidator` seam |
| Entra ID vs RBAC | Treating authenticated = authorized | AuthN yields a principal; RBAC guard enforces seeded permissions independently |
| Prisma (`@repo/database`) | Querying other domains' models; raw `P-code` errors to client | Per-domain repositories only; global exception filter maps Prisma codes to the error envelope |
| PostgreSQL on RDS (EKS target) | Readiness probe ignores DB; pool sized for one pod | `@nestjs/terminus` readiness checks DB; size connection pool for total replica count, not per-pod defaults |
| Future message broker | Domains call each other's services synchronously | Publish/subscribe via a broker-compatible event contract from day one |
| AI providers (future) | A business domain importing an LLM SDK directly | All AI flows through an AI Platform *port* (interface) — even if stubbed this milestone |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries via lazy relation loading | Endpoint latency grows with row count; many small SQL statements | Explicit Prisma `include`/`select`; batch loads; review query plans | First multi-tenant customer with real data volume |
| Unbounded list endpoints (no pagination) | Memory spikes, slow responses returning whole tables | Mandatory pagination DTO + default/max page size in the foundation | When any domain table grows past a few thousand rows |
| Connection-pool exhaustion under K8s scale | `too many connections`, timeouts when replicas scale | Configure Prisma pool size accounting for replica count; consider PgBouncer | When EKS scales beyond a couple of pods |
| Request-scoped providers everywhere | Per-request DI instantiation overhead | Default to singleton scope; use request scope only for the tenant context | Under sustained concurrent load |
| Synchronous long-running work in the request thread | Request timeouts; blocked event loop | Long/AI work goes async via the event/queue boundary (designed now) | First real AI/workflow execution |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Forgotten tenant filter on a query | Cross-organization data leak (BRDs, code, repos) | Centralized tenant scoping (RLS or Prisma extension) + isolation tests |
| Mass assignment via permissive DTOs | Client sets `organizationId`/`createdBy`/`isActive` | `whitelist`+`forbidNonWhitelisted`; server sets ownership/audit fields |
| Leaking internal IDs / audit fields in responses | Schema/internal disclosure; violates §11 | Response DTOs + serialization interceptor strip internal fields |
| Stack traces / Prisma error text to client | Discloses schema, table/column names | Global exception filter; sanitized envelope in production |
| Secrets in committed `.env` / git history | Credential compromise (live `DATABASE_URL` already exposed locally) | Fix `**/.env` gitignore now; rotate credential; external secret manager |
| Token/PII in logs | Credential theft; compliance breach | Logger redaction list; never log auth headers or connection strings |
| Coarse RBAC (token presence = access) | Privilege escalation across domains | Permission-level guards using the seeded 16 permissions / 4 roles |

## "Looks Done But Isn't" Checklist

- [ ] **Module boundaries:** Folders exist, but verify no domain imports another domain's repository/concrete service — run dependency-cruiser, not just eyeballs.
- [ ] **Exception handling:** Filter is registered, but verify Prisma `P2002`/`P2025` map to 409/404 and no stack trace leaks in prod mode.
- [ ] **Validation:** Global pipe present, but verify `whitelist`+`forbidNonWhitelisted` reject unknown fields (test with an extra `isAdmin` field).
- [ ] **Config:** `@nestjs/config` wired, but verify the app *refuses to boot* on a missing required var.
- [ ] **Auth:** Token validates, but verify it is the maintained JWKS path (not `passport-azure-ad`) and that `aud`/`iss` are checked — and that a stub validator exists for dev/test (no live tenant this milestone).
- [ ] **RBAC:** Guards exist, but verify they check *permissions*, not just authentication, and read from the seeded permission codes.
- [ ] **Tenant isolation:** Queries run, but verify a two-org isolation test proves org A cannot read org B.
- [ ] **Logging:** Logs appear, but verify they are JSON, carry a correlation ID, and redact auth headers.
- [ ] **Health:** `/health` returns 200, but verify readiness actually fails when the DB is unreachable.
- [ ] **Microservice-readiness:** Modules compile, but verify at least one cross-domain call goes through a published interface token + one async link goes through the event bus (the extraction seam exists).
- [ ] **Swagger:** UI loads at `/api/v1`, but verify DTOs/error envelope/auth scheme are documented, not just route names.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-domain Prisma access spread through code | HIGH | Add dependency-cruiser to surface all violations; introduce per-domain repositories; reroute via interfaces/events; backfill tests |
| Secret committed to git | MEDIUM | Rotate credential immediately; purge from history (filter-repo); add gitignore; add secret-scanning to CI |
| Inconsistent error contract across domains | HIGH | Define envelope; introduce global filter; migrate domains endpoint-by-endpoint (breaking — coordinate with consumers) |
| Built on `passport-azure-ad` | MEDIUM | Swap behind the `TokenValidator` seam to JWKS validation; if no seam exists, cost rises to HIGH |
| Tenant filter forgotten somewhere | HIGH (if leaked) | Add RLS as backstop (additive migration); audit all queries; isolation tests per model; incident review |
| Anemic layer-based structure blocking extraction | HIGH | Re-package by domain (vertical slices); introduce interface tokens/event bus; this is the rewrite the milestone exists to prevent |
| Premature broker/event-store abstraction | MEDIUM | Delete speculative layer; replace with in-process bus implementing the same contract |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Secrets in git / untyped config (9) | Project/Monorepo Tooling + Shared Infrastructure | `**/.env` ignored; credential rotated; app refuses boot on missing var |
| Inconsistent error contract (6) | Shared Infrastructure | One envelope; Prisma codes mapped; no stack traces in prod |
| Permissive validation / mass assignment (10) | Shared Infrastructure | Unknown-field test returns 400; ownership fields server-set |
| Logging/observability gaps (11) | Shared Infrastructure | JSON logs + correlation ID; readiness fails on DB down; redaction verified |
| Bloated shared module / hidden coupling (2) | Shared Infrastructure | dependency-cruiser: shared never imports domains |
| Cross-domain Prisma access (1) | Prisma Integration + Module Scaffolding | grep/lint: each model touched by one domain only |
| Leaking Prisma entities as contract (3) | Prisma Integration + per-domain scaffold | Responses use DTOs; no Prisma types in public signatures |
| Structure blocking extraction (7) | Module Scaffolding | Domain-packaged slices; cross-domain via interface token + event bus |
| Premature vs under-abstraction (8) | Architecture-decision gate before Scaffolding | Every abstraction has an extraction/mediation rationale; no broker built |
| Entra library/authN-authZ conflation (5) | Auth (Entra ID) + RBAC phases | Maintained JWKS validator behind a seam; permission guards independent of token |
| Tenant scoping by discipline (4) | Organization foundation + Auth | Request-scoped tenant context exists; two-org isolation test passes |

## Sources

- NestJS modular monolith / microservice extraction & hidden coupling — Synapse Studios standards, Milan Jovanović "Monolith to Microservices via Modular Monolith", "Building a microservices-ready modulith" (dependency-cruiser enforcement, domain events, no shared DB): https://docs.synapsestudios.com/implementation/frameworks/nest/modular-monolith , https://www.milanjovanovic.tech/blog/monolith-to-microservices-how-a-modular-monolith-helps , https://medium.com/@allousas/building-a-microservices-ready-modulith-91f08f552cf3 — MEDIUM (community/practitioner, corroborated across sources)
- `passport-azure-ad` deprecation (moved to MSAL repo, no longer supported) — AzureAD/passport-azure-ad GitHub + npm + Microsoft security bulletin: https://github.com/AzureAD/passport-azure-ad , https://www.npmjs.com/package/passport-azure-ad , https://support.microsoft.com/en-us/topic/security-update-for-the-passport-azure-ad-for-node-js-library-207a398e-ba56-cb74-6524-04061b468f78 — HIGH (official)
- Prisma multi-tenant isolation pitfalls (forgotten `where`, RLS vs Prisma extension) — ZenStack multi-tenancy, Medium RLS-with-Prisma, "making `where` required": https://zenstack.dev/blog/multi-tenant , https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35 , https://medium.com/@kz-d/multi-tenancy-with-prisma-a-new-approach-to-making-where-required-1e93a3783d9d — MEDIUM (community, consistent)
- NestJS 11 changes (reverse-order shutdown hooks, CacheModule→Keyv, ConsoleLogger upgrade, dynamic-module identity) — NestJS migration guide + Trilon "Announcing NestJS 11": https://docs.nestjs.com/migration-guide , https://trilon.io/blog/announcing-nestjs-11-whats-new — HIGH (official/maintainer)
- Project-internal: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` (anti-patterns, domain communication rules), `.planning/codebase/CONCERNS.md` (exposed `.env`, missing tooling), `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`, `CLAUDE.md` (§6, §9–§14) — HIGH (authoritative for this repo)

---
*Pitfalls research for: enterprise NestJS 11 modular-monolith backend foundation*
*Researched: 2026-06-29*
</content>
</invoke>
