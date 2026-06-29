# Architecture Research

**Domain:** NestJS 11 modular-monolith backend foundation for a 14-domain AI SDLC platform (microservice-ready)
**Researched:** 2026-06-29
**Confidence:** HIGH

> This document does **not** redesign the platform architecture. The target (modular monolith,
> 14 bounded contexts, 5-layer per-domain stack, API/event communication, AI mediation, no
> cross-domain DB access, microservice-ready) is already authoritative in
> `Enterprise-AI-Delivery-Platform-Documentation/` and `.planning/codebase/ARCHITECTURE.md`.
> It answers: **how to physically structure the NestJS 11 `packages/backend` package so that
> architecture is enforced by construction and extraction later is mechanical, not a rewrite.**

---

## Standard Architecture

### System Overview — Backend Package Composition

```
┌──────────────────────────────────────────────────────────────────────┐
│  packages/backend (NestJS 11 modular monolith — one deployable unit)   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Platform Kernel (shared, framework-level, cross-cutting)      │    │
│  │  config · logging · exception filters · validation pipe ·      │    │
│  │  interceptors · health · swagger · auth guards · base classes  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              ▲ imported by all                         │
│  ┌──────────────┐  ┌──────────────┐        ┌──────────────────────┐   │
│  │  Domain      │  │  Domain      │  ...   │  AI Platform Domain   │   │
│  │  Module      │  │  Module      │        │  (mediates ALL LLM)   │   │
│  │  (api/app/   │  │  (api/app/   │        │                       │   │
│  │  domain/inf/ │  │  domain/inf/ │        │  exposes AiOrchestr-  │   │
│  │  persistence)│  │  persistence)│        │  ationPort (token)    │   │
│  └──────┬───────┘  └──────┬───────┘        └──────────┬───────────┘   │
│         │ sync: published contract ports (DI tokens)  │               │
│         │ async: domain events via EventBus port      │               │
│  ┌──────┴───────────────────────────────────────────┴───────────┐    │
│  │  contracts/  — published interfaces + event envelopes only     │    │
│  │              (the ONLY thing a module exposes to its peers)     │    │
│  └────────────────────────────────────────────────────────────────┘   │
│                              │ persistence layer only                  │
└──────────────────────────────┼────────────────────────────────────────┘
                                ▼
              @repo/database (PrismaModule / PrismaService)
                                ▼
                    PostgreSQL  ·  (later: Qdrant, Redis)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Platform Kernel (`shared/`, `core/`) | Cross-cutting infra: typed config, structured logging, global exception filter, validation pipe, response/timing/audit interceptors, health checks, Swagger, auth guards, base repository/DTO classes | Globally-registered NestJS modules + `APP_*` providers |
| Domain Module (×14) | One bounded context. Owns its 5 layers, its data, its events, its published port. Never reaches into another domain's internals | One NestJS `@Module` per domain under `modules/` |
| `contracts/` layer | The published surface of each domain: port interfaces (sync) + event classes (async). The only code one module may import from another | Plain TS interfaces + classes + DI tokens (zero framework deps) |
| AI Platform module | Owns ALL LLM execution, model/prompt/capability/graph registries, workflow state. Business domains depend on its **port**, never on an LLM SDK | NestJS module exporting `AiOrchestrationPort` token |
| Event infrastructure | In-process domain-event delivery + saga orchestration of long-running SDLC workflows; swappable transport behind a port | `@nestjs/cqrs` `EventBus`/`Saga`, wrapped by a `DomainEventPublisher` port |
| `@repo/database` | Single source of truth for schema + Prisma client. Already implemented and frozen this milestone | Existing `PrismaModule` (`@Global`) |

---

## Recommended Project Structure

```
packages/backend/
├── src/
│   ├── main.ts                       # bootstrap: /api/v1 prefix, Swagger, global pipes/filters
│   ├── app.module.ts                 # composition root: imports kernel + all 14 domain modules
│   │
│   ├── core/                         # framework wiring registered once, app-wide
│   │   ├── config/                   # @nestjs/config + Zod/Joi schema, typed ConfigService
│   │   ├── logging/                  # structured logger (pino), request-id propagation
│   │   ├── http/                     # global exception filter, response interceptor, timing
│   │   ├── validation/               # ValidationPipe config (whitelist, transform)
│   │   ├── health/                   # @nestjs/terminus: liveness, readiness, DB ping
│   │   ├── swagger/                  # OpenAPI document builder
│   │   └── events/                   # CqrsModule wiring + DomainEventPublisher port impl
│   │
│   ├── shared/                       # reusable building blocks (no business logic)
│   │   ├── database/                 # BaseRepository<T>, soft-delete + audit-field helpers
│   │   ├── auth/                     # JWT/Entra guard, @CurrentUser, @Permissions decorator
│   │   ├── rbac/                     # RolesGuard, permission evaluation
│   │   └── dto/                      # ApiResponse<T>, pagination, error envelope
│   │
│   ├── contracts/                    # PUBLISHED cross-domain surface (importable by anyone)
│   │   ├── identity/                 # IdentityPort interface + tokens
│   │   ├── organization/             # OrganizationPort interface + tokens
│   │   ├── ai-platform/              # AiOrchestrationPort interface + capability request DTOs
│   │   └── events/                   # DomainEvent base + per-domain event classes
│   │
│   └── modules/                      # one folder per bounded context (14)
│       ├── identity/
│       │   ├── identity.module.ts
│       │   ├── api/                  # controllers, request/response DTOs, route validation
│       │   ├── application/          # use-case services, command/query/saga handlers
│       │   ├── domain/               # entities, value objects, domain services, event defs
│       │   ├── infrastructure/       # external adapters (Entra ID strategy), port impls
│       │   └── persistence/          # repositories (ONLY layer touching PrismaService)
│       ├── organization/             # same 5-layer shape
│       ├── integration/
│       ├── repository/
│       ├── knowledge/
│       ├── documentation/
│       ├── planning/
│       ├── development/
│       ├── validation/
│       ├── testing/
│       ├── delivery/
│       ├── learning/
│       ├── ai-platform/
│       └── platform-operations/
├── tsconfig.json                     # path aliases enforce import direction (see below)
├── .eslintrc.cjs                     # boundary rules (eslint-plugin-boundaries)
└── package.json                      # depends on @repo/database via workspace
```

### Structure Rationale

- **`modules/<domain>/` mirrors the 14 schema files** in `@repo/database/prisma/schema/`. One module ↔ one bounded context ↔ one schema file ↔ one future microservice. The 1:1:1:1 mapping is the single most important extraction enabler — it is already half-done because the schema is pre-split by domain.
- **5 sub-folders per module = the documented 5 layers**, made physical. `api → application → domain → infrastructure → persistence`. Dependencies point *inward/downward*; `domain/` has zero NestJS and zero Prisma imports so business rules stay portable.
- **`contracts/` is the only legal cross-module dependency.** A domain exports a port interface + a DI token; consumers inject the token, never the concrete service or repository. This is what lets you replace an in-process call with an HTTP/gRPC client at extraction time without touching callers.
- **`core/` vs `shared/`:** `core/` is wired once at the composition root (global filters, pipes, config, event bus). `shared/` is stateless reusable code (base classes, guards, decorators) any module imports. Keeping them distinct prevents the "god SharedModule" anti-pattern.
- **`persistence/` is the only layer that imports `PrismaService`.** This concentrates the `@repo/database` dependency in one ring per domain, so a future per-service database split touches only that ring.

---

## Architectural Patterns

### Pattern 1: Published Port + DI Token for synchronous cross-domain calls

**What:** A domain exposes a narrow interface (a "port") in `contracts/`, bound to a DI token. The owning module provides the implementation and `exports` the token; consumers inject the token.
**When to use:** Every synchronous cross-domain interaction documented in the Context Interaction Matrix (e.g. `Identity ↔ Organization`, `Knowledge → Planning` API, `Documentation → Planning` API).
**Trade-offs:** Slight indirection vs. importing a service directly; in return, callers never depend on the provider's internals and the call site is transport-agnostic. This is the extraction seam.

```typescript
// contracts/organization/organization.port.ts
export const ORGANIZATION_PORT = Symbol('ORGANIZATION_PORT');
export interface OrganizationPort {
  getProjectById(id: string): Promise<ProjectSummary>;
}

// modules/organization/organization.module.ts
@Module({ providers: [{ provide: ORGANIZATION_PORT, useClass: OrganizationService }],
         exports: [ORGANIZATION_PORT] })
export class OrganizationModule {}

// modules/planning/application/planning.service.ts — consumer
constructor(@Inject(ORGANIZATION_PORT) private readonly organizations: OrganizationPort) {}
```

### Pattern 2: Domain events via `@nestjs/cqrs` EventBus behind a publisher port

**What:** Asynchronous cross-domain communication. Events are plain serializable classes in `contracts/events/`. Producers publish through a `DomainEventPublisher` port (backed by `@nestjs/cqrs` `EventBus` today); consumers implement `@EventsHandler`.
**When to use:** Every async edge in the documented Event Catalog (`Integration → Repository`, `Repository → Knowledge`, `Planning → Development`, the whole SDLC chain through `Delivery → Learning`).
**Trade-offs:** `@nestjs/cqrs` over `@nestjs/event-emitter` because the platform needs **Sagas** to orchestrate the long-running SDLC pipeline and human-approval state machine — `event-emitter` is a fire-and-forget emitter with no orchestration or command model. CQRS gives Commands + Events + Sagas, which map directly onto the documented WorkflowRun/WorkflowState/HumanApproval lifecycle. Cost: more ceremony for trivial cases. (Confidence HIGH — verified against `/nestjs/cqrs` docs.)

```typescript
// contracts/events/planning.events.ts
export class PlanningCompletedEvent {
  constructor(readonly workItemId: string, readonly lldId: string,
              readonly occurredAt = new Date()) {}
}

// modules/development/application/planning-completed.handler.ts
@EventsHandler(PlanningCompletedEvent)
export class PlanningCompletedHandler implements IEventHandler<PlanningCompletedEvent> {
  handle(event: PlanningCompletedEvent) { /* trigger code-generation use case */ }
}
```

> **Extraction note:** keep events serializable (no class methods, no Prisma entities). The
> `DomainEventPublisher` port is the swap point — today CQRS in-process; at extraction, back it
> with Redis Streams/Kafka **plus a transactional outbox** to solve the dual-write problem. The
> existing `WorkflowEvent` table is the natural outbox substrate. Do not build the outbox this
> milestone — just keep events serializable and behind the port so it can be added without
> touching domain code.

### Pattern 3: AI mediation through `AiOrchestrationPort` (structural enforcement of AP-05)

**What:** Business domains never import an LLM SDK. They depend on `AiOrchestrationPort` (in `contracts/ai-platform/`), submitting a capability request. The AI Platform module owns the only implementation.
**When to use:** Every AI-driven flow (Documentation, Planning, Development, Validation, Testing, Learning).
**Trade-offs:** Indirection now, even though the implementation is stubbed this milestone. The payoff is that the "no business domain calls LLMs directly" rule is enforced *by the dependency graph*, not by reviewer vigilance. A lint rule additionally bans `@anthropic-ai/*`, `openai`, `langchain` imports outside `modules/ai-platform/`.

```typescript
// contracts/ai-platform/ai-orchestration.port.ts
export const AI_ORCHESTRATION_PORT = Symbol('AI_ORCHESTRATION_PORT');
export interface AiOrchestrationPort {
  execute(req: CapabilityRequest): Promise<CapabilityResult>; // capability-based, provider-agnostic
}
```

### Pattern 4: Repository ring isolates `@repo/database`

**What:** Only files in a module's `persistence/` ring import `PrismaService`, and a repository queries **only the Prisma models its domain owns**.
**When to use:** All data access.
**Trade-offs:** Prisma is a single client over a single DB, so this is enforced by convention + lint + a `BaseRepository`, not by the type system. The reward: when a domain becomes a service with its own DB, only its `persistence/` ring changes.

---

## Data Flow

### Synchronous request flow (e.g. create project)

```
HTTP /api/v1/projects
    ↓
api/  Controller (validates DTO, no logic)
    ↓
application/  Use-case service (orchestrates, authorizes)
    ↓
domain/  Entity + business rules
    ↓
persistence/  Repository → PrismaService (@repo/database)
    ↓
ApiResponse<T> ← response interceptor (shaping) ← service
```

### Asynchronous SDLC pipeline (saga-driven)

```
Integration.RepositoryImported
        → Repository (index)  →  RepositoryProfileGenerated
        → Knowledge (context) →  ContextPackageGenerated
        → Documentation (BRD/TSD/LLD, human approval) → LLDApproved
        → Planning            →  PlanningCompleted
        → Development (AiOrchestrationPort) → CodeGenerated / DeveloperApproved
        → Validation → Testing → Delivery → Learning
   (each hop = a domain event; the chain = a CQRS Saga; halts at WAITING_FOR_APPROVAL)
```

### Key data flows

1. **Cross-domain sync:** caller → injected port token → provider's `application/` service. Never crosses into `domain/` or `persistence/` of another module.
2. **Cross-domain async:** producer → `DomainEventPublisher` → EventBus → consumers' `@EventsHandler`. Producer has zero knowledge of subscribers.
3. **AI execution:** business domain → `AiOrchestrationPort.execute(capabilityRequest)` → AI Platform resolves capability → model routing → LangGraph → result. All recorded in `AiExecution`.

---

## Suggested Build Order (foundation pieces that unblock everything)

| Step | Deliverable | Unblocks |
|------|-------------|----------|
| 1 | **Backend package bootstrap** — tsconfig (path aliases), ESLint boundaries, Prettier, Jest, `main.ts` with `/api/v1`, `app.module.ts` | All subsequent code |
| 2 | **Platform Kernel (`core/`)** — typed config, structured logging, global exception filter, validation pipe, response/timing/audit interceptors, Swagger, Terminus health (incl. DB ping via `@repo/database`) | Every controller/service; satisfies most "shared infrastructure" requirements |
| 3 | **`shared/` building blocks** — `BaseRepository` (soft-delete + audit fields), `ApiResponse<T>`, pagination, error envelope | All domain persistence + APIs |
| 4 | **Event + contracts infrastructure** — `CqrsModule` wiring, `DomainEventPublisher` port, `DomainEvent` base, `contracts/` scaffold | All async communication; AI mediation port |
| 5 | **Auth & RBAC infra** — JWT/Entra guard (strategy stubbed), `RolesGuard`, `@Permissions`/`@CurrentUser` decorators, wired to seeded roles/permissions | Securing every endpoint |
| 6 | **Identity + Organization domains (fully implemented)** — the foundation everyone depends on; expose `IdentityPort` / `OrganizationPort` | Project/team ownership for all downstream domains |
| 7 | **AI Platform module (port + stub)** — `AiOrchestrationPort` defined and provided (impl stubbed) | Lets business domains compile against AI mediation now |
| 8 | **Scaffold remaining 12 domains** — identical empty 5-layer skeleton, module registered, contract stub | Future milestones drop logic in without restructuring |

Steps 1–5 are the true "foundation"; 6–8 prove the structure end-to-end and lock the permanent module shape.

### Scaffolding all 14 domains consistently

Generate each module from a single template so the 5-layer shape, file naming
(`<domain>.module.ts` / `.controller.ts` / `.service.ts` / `.repository.ts`, `dto/`,
`<domain>.events.ts`), and a `contracts/<domain>/` port stub are identical. Foundation domains
(Identity, Organization) get real implementations; the other 12 ship as compiling skeletons with
the module wired into `app.module.ts` and a health-visible but empty controller. Consistency here
is the payoff: future milestones never restructure, they only fill rings.

---

## Microservice Extraction Readiness (concrete)

The monolith is extraction-ready when each of these holds — design for them now:

| Enabler | How this structure provides it |
|---------|-------------------------------|
| Service boundary == module boundary | 1 module ↔ 1 bounded context ↔ 1 schema file ↔ 1 future service |
| No hidden coupling | Cross-module imports allowed **only** from `contracts/`; enforced by `eslint-plugin-boundaries` + tsconfig path restrictions |
| Sync calls are transport-agnostic | Callers inject port tokens; swap in-process provider for an HTTP/gRPC client implementing the same interface |
| Async is broker-ready | Events are serializable classes behind `DomainEventPublisher`; swap CQRS in-process bus → Redis Streams/Kafka + outbox (use existing `WorkflowEvent` table) |
| DB splits cleanly | Schema already split per domain; only the extracted domain's `persistence/` ring changes; cross-domain DB access already prohibited |
| Stateless services | Sessions/cache go to Redis (future); app nodes hold no state — matches HLD scalability strategy |
| AI never leaks | Only `modules/ai-platform/` imports LLM SDKs (lint-enforced); business domains depend on `AiOrchestrationPort` |

**Verdict:** with module=context, contracts-only imports, serializable events behind a port, and
the pre-split schema, extracting any domain to a microservice is mechanical re-deployment, not a
rewrite — which is the milestone's core value.

---

## Anti-Patterns (specific to this build)

### Anti-Pattern 1: "God" SharedModule holding business logic
**What people do:** Dump services used by 2+ domains into `shared/`.
**Why it's wrong:** Recreates the coupling bounded contexts exist to prevent; the blob can never be extracted.
**Do this instead:** `shared/` holds only stateless framework helpers. Cross-domain behavior goes through a published port on the *owning* domain.

### Anti-Pattern 2: Importing another domain's service/repository directly
**What people do:** `import { PlanningService } from '../planning/...'`.
**Why it's wrong:** Bypasses the contract, couples internals, blocks extraction.
**Do this instead:** Inject the published port token from `contracts/`. Add a lint boundary rule so the direct import fails CI.

### Anti-Pattern 3: Querying another domain's Prisma models
**What people do:** A repository calls `prisma.workItem.findMany()` from outside Planning.
**Why it's wrong:** Violates `DC-04 No Shared Database`; creates invisible coupling on a single DB.
**Do this instead:** Call the owning domain's port or consume its event. Keep each repository scoped to its own models; review + lint guard the `persistence/` ring.

### Anti-Pattern 4: Business domain importing an LLM SDK
**What people do:** `DocumentationService` imports `@anthropic-ai/sdk`.
**Why it's wrong:** Violates AP-05; bypasses model routing, cost optimization, prompt versioning, audit.
**Do this instead:** Depend on `AiOrchestrationPort`. Lint-ban LLM packages outside `modules/ai-platform/`.

### Anti-Pattern 5: Business logic in controllers
**What people do:** Branching/decisions in `api/` controllers.
**Why it's wrong:** Untestable, duplicated across routes (also violates CLAUDE.md §6).
**Do this instead:** Controllers validate + delegate to `application/` use-case services only.

---

## Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Domain ↔ Domain (sync) | Published port token via DI | Identity↔Organization, Knowledge→Planning, Documentation→Planning |
| Domain ↔ Domain (async) | Domain event via `DomainEventPublisher` | The full SDLC chain; CQRS Saga orchestrates |
| Business domain ↔ AI | `AiOrchestrationPort.execute(capabilityRequest)` | Provider-agnostic; AI Platform owns execution |
| Domain ↔ `@repo/database` | `persistence/` repositories only, via `PrismaService` | One DB now; per-domain models only |
| Module ↔ Platform Kernel | Import global `core/` providers + `shared/` helpers | Filters/pipes/interceptors registered once at root |

### External services (deferred wiring this milestone, but ports defined)

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Microsoft Entra ID | Passport strategy in Identity `infrastructure/` | Guard + JWT issuance structured now, live tenant wiring is a later milestone |
| LLM providers | Only inside AI Platform `infrastructure/` | Never imported elsewhere |
| Qdrant / Redis | Adapters behind Knowledge / Platform-Operations ports | Runtime wiring deferred; ports keep call sites stable |

---

## Sources

- `@nestjs/cqrs` docs — EventBus, IEventHandler, Sagas, testing patterns (Context7 `/nestjs/cqrs`, 536 snippets) — HIGH
- NestJS core docs (Context7 `/nestjs/docs.nestjs.com`, v11.1.x confirmed in `/nestjs/nest`) — HIGH
- `@nestjs/event-emitter` vs `@nestjs/cqrs` EventBus + outbox/dual-write analysis (WebSearch, multiple corroborating sources: nestjs docs, dev.to, Medium) — MEDIUM
- Modular-monolith / bounded-context-in-NestJS practice (Synapse Studios standards, codanyks, dev.to DDD-in-Nest) — MEDIUM
- Authoritative platform design: `DAS-Volume-I/III/IV`, `High-Level-Design.md`, `.planning/codebase/ARCHITECTURE.md` & `STRUCTURE.md` — HIGH (primary, conformed-to, not redesigned)

---
*Architecture research for: NestJS 11 modular-monolith backend foundation*
*Researched: 2026-06-29*
