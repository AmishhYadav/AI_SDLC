# Roadmap: Enterprise AI Delivery Platform — Backend Foundation

## Overview

This milestone builds the permanent, production-ready NestJS 11 backend skeleton for the 14-domain AI SDLC platform, on top of the already-frozen `@repo/database` (Prisma 6 / PostgreSQL) package. It proceeds along the dependency chain the research converged on: establish the missing toolchain and remediate the exposed secret, land the cross-cutting Platform Kernel so all 14 domains inherit identical config/logging/error/validation/security contracts, then build authentication and RBAC as separate seams, the tenancy/organization boundary (the highest multi-tenant risk), the project foundation, the AI-mediation and event extraction seams, and finally the consistent 5-layer scaffolding for all 14 domains with mechanically-enforced boundaries. The single load-bearing outcome is that any domain can later be extracted to a microservice as a mechanical re-deployment rather than a rewrite — achievable only because the seams are designed now.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Monorepo & Tooling Foundation** - Workspaces, strict TS/ESLint/Prettier/Vitest/Nest tooling, and the urgent `.env` + credential remediation
- [ ] **Phase 2: Platform Kernel — Bootstrap, Config & Error Contract** - `/api/v1` bootstrap, fail-fast typed config, the global error envelope, and Prisma integration
- [ ] **Phase 3: Platform Kernel — Observability, Validation, Security & Health** - Structured logging, validation pipe, interceptors, health, Swagger, security baseline, shared conventions
- [ ] **Phase 4: Authentication (Entra ID) Infrastructure** - Swappable JWKS-based token validation, `@Public()`, `CurrentUser`, dev stub validator
- [ ] **Phase 5: RBAC Authorization Infrastructure** - `@RequirePermissions()` + `PermissionsGuard` over the seeded permissions, independent of authN
- [ ] **Phase 6: Tenancy & Organization Foundation** - Request-scoped tenant context, organization/member CRUD, isolation tests, enforcement-mechanism ADR
- [ ] **Phase 7: Project Foundation** - Org-scoped project/team CRUD and the published `OrganizationPort` contract
- [ ] **Phase 8: AI Platform Port & Event/Extraction Seams** - `AiOrchestrationPort` stub, `DomainEventPublisher`/event base, job/queue port, LLM-import lint ban
- [ ] **Phase 9: 14-Domain Scaffolding & Boundary Enforcement** - Identical 5-layer skeleton for all domains with mechanically-enforced boundaries

## Phase Details

### Phase 1: Monorepo & Tooling Foundation
**Goal**: A verifiable build/lint/format/test toolchain exists so all subsequent work meets the Definition of Done, and the exposed database credential is remediated.
**Depends on**: Nothing (first phase)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07
**Success Criteria** (what must be TRUE):
  1. `npm install` at the repo root resolves `@repo/database` from `packages/backend` via workspaces, with no relative-path hacks.
  2. Lint (ESLint 9 flat config), format (Prettier), and type-check pass across the repo; a sample Vitest 4 (SWC) test runs and passes.
  3. `nest build` (SWC builder via `nest-cli.json`) compiles the backend package successfully.
  4. `git status` shows no `.env` tracked, `**/.env` is gitignored, and the previously-committed `DATABASE_URL` credential has been rotated.
  5. Node is pinned via `.nvmrc` to a Node 22+ LTS and TypeScript is pinned to 5.9.x (not 6.0).
**Plans**: TBD (~3 estimated)

### Phase 2: Platform Kernel — Bootstrap, Config & Error Contract
**Goal**: The NestJS application boots under `/api/v1` with fail-fast typed configuration, a single error contract, and Prisma reached only through `@repo/database`.
**Depends on**: Phase 1
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-05, INFRA-06, INFRA-14
**Success Criteria** (what must be TRUE):
  1. The application boots and serves routes under `/api/v1` (URI versioning).
  2. The app refuses to boot when a required env var is missing or invalid (Zod fail-fast validation); all configuration is read through the typed config service.
  3. Direct `process.env` access outside the config module fails lint.
  4. Any thrown error returns a consistent envelope `{ success, errorCode, message, traceId }`, with no stack traces leaked in production.
  5. Prisma errors map to correct HTTP status (P2002→409, P2025→404) without leaking schema details, and Prisma is reached solely through `@repo/database` with zero schema changes.
**Plans**: TBD (~3 estimated)

### Phase 3: Platform Kernel — Observability, Validation, Security & Health
**Goal**: Every request flows through structured logging, strict validation, response/audit shaping, health checks, Swagger, and a security baseline, with shared conventions available to all domains.
**Depends on**: Phase 2
**Requirements**: INFRA-04, INFRA-07, INFRA-08, INFRA-09, INFRA-10, INFRA-11, INFRA-12, INFRA-13, SEAM-06
**Success Criteria** (what must be TRUE):
  1. Each request emits structured JSON logs carrying a per-request correlation ID (AsyncLocalStorage), with auth headers and secrets redacted.
  2. The global validation pipe rejects unknown/extra fields (400) and transforms typed DTOs; successful responses are wrapped in the standard envelope, with a `@RawResponse()` escape hatch.
  3. Mutating operations are recorded to the `AuditLog` model via the audit interceptor.
  4. Liveness returns 200 always; readiness fails when the database is unreachable (Terminus DB ping); Swagger/OpenAPI documents the `/api/v1` surface.
  5. Helmet headers, a CORS allowlist, and request rate limiting are enforced; the app shuts down gracefully closing the Prisma connection; shared pagination, idempotency-key, and error-code-catalog conventions are documented and importable.
**Plans**: TBD (~5 estimated)

### Phase 4: Authentication (Entra ID) Infrastructure
**Goal**: Protected endpoints authenticate Entra-issued JWTs behind a swappable validator seam, with a dev stub for local work and a resolvable principal.
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A protected endpoint rejects requests without a valid Entra-issued JWT and accepts requests with one (validated via `passport-jwt` + `jwks-rsa` against the tenant JWKS).
  2. Token validation sits behind a swappable `TokenValidator` interface with no dependency on the deprecated `passport-azure-ad`.
  3. A `@Public()` decorator lets marked endpoints bypass authentication.
  4. Handlers can resolve a `CurrentUser` principal carrying user/org identity claims.
  5. A stub/dev validator lets local development and tests authenticate without a live Entra tenant.
**Plans**: TBD (~3 estimated)
**Research flag**: Verify Entra JWKS validation specifics (`iss`/`aud`/v2.0 issuer formats, key caching) against current Microsoft docs at plan time — library landscape is actively shifting (MEDIUM confidence).

### Phase 5: RBAC Authorization Infrastructure
**Goal**: Endpoints enforce the seeded permissions through a guard that decides authorization independently of authentication.
**Depends on**: Phase 4
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04
**Success Criteria** (what must be TRUE):
  1. An endpoint annotated with `@RequirePermissions()` is denied (403) when the principal lacks the permission and allowed when it is present.
  2. `PermissionsGuard` resolves permissions from the seeded 16 permissions / 4 roles in the database.
  3. The guard chain executes in the order Authentication → RBAC → Tenancy.
  4. A valid token whose principal lacks the required permission is still denied (authN and authZ are not conflated).
**Plans**: TBD (~2 estimated)

### Phase 6: Tenancy & Organization Foundation
**Goal**: A trusted request-scoped tenant context exists and organization/member data is provably isolated across tenants, with the enforcement mechanism decided.
**Depends on**: Phase 5
**Requirements**: TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05, TENANT-06, TENANT-07, SEAM-05
**Success Criteria** (what must be TRUE):
  1. A request-scoped tenant/actor context (AsyncLocalStorage) is populated from the authenticated principal and is always available to repositories without per-query plumbing.
  2. A user can create an organization and is recorded as a member, can list/read organizations they belong to, and cannot read organizations they do not belong to.
  3. Organization members can be added, listed, and removed.
  4. A two-organization isolation test proves organization A never receives organization B's data.
  5. The tenant-enforcement mechanism (PostgreSQL RLS vs Prisma client extension) is decided and recorded as an ADR, and an org-scoped, soft-delete-aware `BaseRepository` is available to domain repositories.
**Plans**: TBD (~4 estimated)
**Research flag**: Highest-risk phase. The RLS-vs-Prisma-client-extension enforcement mechanism and ALS tenant-context propagation across async boundaries warrant a focused decision with isolation tests as the acceptance gate (MEDIUM confidence). Enforcement impl may be deferred; the context must exist now.

### Phase 7: Project Foundation
**Goal**: Org-scoped project and team management works end-to-end, exposing the published contract downstream domains depend on.
**Depends on**: Phase 6
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04
**Success Criteria** (what must be TRUE):
  1. A user can create a project scoped to an organization they belong to.
  2. A user can list and read projects within their organization, scoped by the tenant context.
  3. A user can create teams within a project and manage team membership.
  4. A published `OrganizationPort`/project-summary contract in `contracts/` exposes org/project lookup to downstream domains.
**Plans**: TBD (~3 estimated)

### Phase 8: AI Platform Port & Event/Extraction Seams
**Goal**: Business domains can compile against AI mediation and async communication through ports, with no implementations wired and LLM SDKs mechanically confined.
**Depends on**: Phase 7
**Requirements**: SEAM-01, SEAM-02, SEAM-03, SEAM-04
**Success Criteria** (what must be TRUE):
  1. A `DomainEventPublisher` port and a serializable `DomainEvent` base exist, with an in-process delivery implementation that publishes and dispatches to handlers end-to-end.
  2. A background-job/queue port exists supporting the 202-Accepted async pattern (no broker wired this milestone).
  3. An `AiOrchestrationPort` is defined and provided as a stub, so business domains depend only on the port.
  4. Direct LLM-provider SDK imports outside `modules/ai-platform/` fail lint.
**Plans**: TBD (~3 estimated)
**Research flag**: Settle the open `@nestjs/cqrs` EventBus (Sagas for the long-running SDLC pipeline) vs `@nestjs/event-emitter` (simplicity) decision at plan time — both researchers agree the transport sits behind the `DomainEventPublisher` port, so call sites are safe either way; also confirm the serializable-event + future-outbox (`WorkflowEvent`) contract (MEDIUM confidence).

### Phase 9: 14-Domain Scaffolding & Boundary Enforcement
**Goal**: The permanent module shape is locked: all 14 domains share an identical 5-layer skeleton with boundaries enforced mechanically so violations fail CI.
**Depends on**: Phase 8
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, SCAF-06
**Success Criteria** (what must be TRUE):
  1. All 14 domains have an identical 5-layer module skeleton (`api → application → domain → infrastructure → persistence`) wired into `app.module.ts`.
  2. Each domain exposes a `contracts/<domain>/` port stub as its only cross-module surface.
  3. Every module's `domain/` layer has zero NestJS and zero Prisma imports, and `PrismaService` is importable only within each module's `persistence/` ring (enforced mechanically).
  4. eslint-plugin-boundaries / dependency-cruiser rules fail CI on cross-domain service/repository imports or non-`contracts/` cross-module imports.
  5. The foundation domains (Identity, Organization, Project, AI Platform port) prove the template end-to-end; the remaining domains are wired skeletons with no business logic.
**Plans**: TBD (~3 estimated)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo & Tooling Foundation | 0/3 | Not started | - |
| 2. Platform Kernel — Bootstrap, Config & Error Contract | 0/3 | Not started | - |
| 3. Platform Kernel — Observability, Validation, Security & Health | 0/5 | Not started | - |
| 4. Authentication (Entra ID) Infrastructure | 0/3 | Not started | - |
| 5. RBAC Authorization Infrastructure | 0/2 | Not started | - |
| 6. Tenancy & Organization Foundation | 0/4 | Not started | - |
| 7. Project Foundation | 0/3 | Not started | - |
| 8. AI Platform Port & Event/Extraction Seams | 0/3 | Not started | - |
| 9. 14-Domain Scaffolding & Boundary Enforcement | 0/3 | Not started | - |
