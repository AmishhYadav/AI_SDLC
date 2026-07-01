# Requirements: Enterprise AI Delivery Platform — Backend Foundation

**Defined:** 2026-06-29
**Core Value:** A permanent, production-ready backend foundation that every future platform capability and microservice extraction builds on without structural rewrites.
**Milestone scope:** Backend Foundation (the user's "Phase 1 of implementation"). Full-platform capabilities are tracked in PROJECT.md and delivered in future milestones.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Tooling & Monorepo

- [ ] **TOOL-01**: Root repository declares workspaces so `packages/backend` resolves `@repo/database` without path hacks
- [ ] **TOOL-02**: Shared strict TypeScript config (`tsconfig.base.json`, strict mode) pinned to TypeScript 5.9.x (not 6.0)
- [ ] **TOOL-03**: ESLint 9 flat config + Prettier are configured and pass on the repository
- [ ] **TOOL-04**: Vitest 4 test runner (with SWC) runs and a sample test passes
- [ ] **TOOL-05**: NestJS build/dev tooling (`nest-cli.json` with SWC builder) compiles the backend package
- [ ] **TOOL-06**: `.gitignore` excludes all `**/.env` files and the previously-committed `DATABASE_URL` credential is rotated
- [ ] **TOOL-07**: Node version is pinned (e.g. `.nvmrc`) to a Node 22+ LTS

### Shared Infrastructure (Platform Kernel)

- [ ] **INFRA-01**: NestJS application bootstraps and serves all routes under `/api/v1` (URI versioning)
- [ ] **INFRA-02**: All configuration is loaded through a typed config service with fail-fast env validation (Zod) at startup
- [ ] **INFRA-03**: Direct `process.env` access is lint-banned outside the config module
- [x] **INFRA-04**: Requests emit structured JSON logs with a per-request correlation ID propagated via AsyncLocalStorage
- [ ] **INFRA-05**: A single global exception filter returns a consistent error envelope `{ success, errorCode, message, traceId }`
- [ ] **INFRA-06**: The exception filter maps Prisma errors to HTTP status (e.g. `P2002`→409, `P2025`→404) and never leaks stack traces in production
- [x] **INFRA-07**: A global validation pipe rejects unknown fields (`whitelist` + `forbidNonWhitelisted`) and transforms typed DTOs
- [x] **INFRA-08**: A response interceptor wraps successful responses in a standard envelope, with a `@RawResponse()` escape hatch
- [x] **INFRA-09**: An audit interceptor records mutating operations to the `AuditLog` model
- [x] **INFRA-10**: Liveness and readiness health endpoints exist; readiness verifies database connectivity via Terminus
- [x] **INFRA-11**: Swagger/OpenAPI documentation is generated and served for the `/api/v1` surface
- [x] **INFRA-12**: Security baseline is enabled: helmet headers, CORS allowlist, and request rate limiting (throttler)
- [x] **INFRA-13**: The application shuts down gracefully, closing the Prisma connection via a typed lifecycle hook
- [ ] **INFRA-14**: Prisma is integrated solely through the existing `@repo/database` package with zero schema changes

### Authentication (Entra ID)

- [ ] **AUTH-01**: Protected endpoints require a valid Entra-issued JWT, validated via `passport-jwt` + `jwks-rsa` against the tenant JWKS
- [ ] **AUTH-02**: Token validation sits behind a swappable `TokenValidator` interface (no dependency on the deprecated `passport-azure-ad`)
- [ ] **AUTH-03**: A `@Public()` decorator marks endpoints that bypass authentication
- [ ] **AUTH-04**: An authenticated principal (`CurrentUser`) is resolvable in handlers and carries user/org identity claims
- [ ] **AUTH-05**: A stub/dev token validator enables local development and tests without a live Entra tenant

### Authorization (RBAC)

- [ ] **RBAC-01**: A `@RequirePermissions()` decorator declares the permissions an endpoint needs
- [ ] **RBAC-02**: A `PermissionsGuard` enforces permissions using the seeded 16 permissions / 4 roles, resolved from the database
- [ ] **RBAC-03**: The guard chain executes in the order Authentication → RBAC → Tenancy
- [ ] **RBAC-04**: Authorization is implemented independently of authentication (no authN/authZ conflation)

### Tenancy & Organization Foundation

- [ ] **TENANT-01**: A request-scoped tenant/actor context (AsyncLocalStorage) is populated from the authenticated principal
- [ ] **TENANT-02**: The tenant context is always available to repositories so organization scoping is never left to per-query discipline
- [ ] **TENANT-03**: A user can create an organization and the creator is recorded as a member
- [ ] **TENANT-04**: A user can list and read organizations they are a member of, and cannot read organizations they do not belong to
- [ ] **TENANT-05**: Organization members can be added, listed, and removed
- [ ] **TENANT-06**: Two-organization isolation tests prove one organization's data is never returned to another
- [ ] **TENANT-07**: The chosen tenant-enforcement mechanism (PostgreSQL RLS vs Prisma client extension) is decided and recorded as an ADR (enforcement impl may be deferred; the context must exist now)

### Project Foundation

- [ ] **PROJ-01**: A user can create a project scoped to an organization they belong to
- [ ] **PROJ-02**: A user can list and read projects within their organization, scoped by the tenant context
- [ ] **PROJ-03**: A user can create teams within a project and manage team membership
- [ ] **PROJ-04**: A published `OrganizationPort`/project-summary contract exposes org/project lookup to downstream domains via `contracts/`

### Extraction Seams (interfaces now, implementations deferred)

- [ ] **SEAM-01**: A `DomainEventPublisher` port and a serializable `DomainEvent` base exist with an in-process delivery implementation
- [ ] **SEAM-02**: A background-job/queue port exists supporting the 202-Accepted async pattern (no broker wired this milestone)
- [ ] **SEAM-03**: An `AiOrchestrationPort` is defined and provided as a stub, so business domains depend only on the port
- [ ] **SEAM-04**: Direct LLM-provider SDK imports are lint-banned outside `modules/ai-platform/`
- [ ] **SEAM-05**: An org-scoped, soft-delete-aware `BaseRepository` is available for domain repositories
- [x] **SEAM-06**: Shared conventions exist for pagination, idempotency keys, and a documented error-code catalog

### Domain Scaffolding & Boundary Enforcement

- [ ] **SCAF-01**: All 14 domains have a consistent 5-layer module skeleton (`api → application → domain → infrastructure → persistence`) wired into `app.module.ts`
- [ ] **SCAF-02**: Each domain exposes a `contracts/<domain>/` port stub as its only cross-module surface
- [ ] **SCAF-03**: The `domain/` layer of every module has zero NestJS and zero Prisma imports
- [ ] **SCAF-04**: `PrismaService` is importable only within each module's `persistence/` ring (enforced mechanically)
- [ ] **SCAF-05**: eslint-plugin-boundaries / dependency-cruiser rules fail CI on cross-domain service/repository imports or non-`contracts/` cross-module imports
- [ ] **SCAF-06**: The foundation domains (Identity, Organization, Project, AI Platform port) prove the template end-to-end; the remaining domains are wired skeletons with no business logic

## v2 Requirements

Deferred to future milestones. Tracked but not in this roadmap.

### Runtime Integrations

- **RT-01**: Wire the domain-event bus to a broker + transactional outbox (e.g. via the `WorkflowEvent` table)
- **RT-02**: Wire the job/queue port to Redis/BullMQ
- **RT-03**: Integrate Qdrant vector store for the Knowledge domain
- **RT-04**: Wire OpenTelemetry exporter and a `/metrics` endpoint
- **RT-05**: Live Microsoft Entra ID tenant integration and end-to-end SSO verification

### Platform Capabilities (per PROJECT.md "Future milestones")

- **CAP-01..n**: Repository Intelligence, Knowledge Hub, Documentation Intelligence, Planning, Development, Validation, Testing, Delivery, Organizational Learning, AI Platform execution, LangGraph workflows, external integrations (Azure DevOps/GitHub/Stitch/SonarQube), and the Next.js frontend — each its own future milestone

## Out of Scope

Explicitly excluded this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Modifying the existing Prisma schema | Database layer is complete and frozen; future schema work is additive only |
| Business logic in non-foundation domains | Those 12 domains are scaffolded only; logic arrives in their own milestones |
| Custom auth / token issuance | Entra ID is the identity provider; never issue our own tokens |
| Premature microservice split | Modular monolith now; extraction is a mechanical re-deployment later |
| Runtime Redis / Qdrant / broker wiring | Define ports only; wire when a consuming capability needs them |
| Direct LLM SDK calls outside AI Platform | All AI execution must route through the AI Platform port |
| GraphQL / gRPC transport | REST `/api/v1` only for the foundation |
| Caching layer | No caching concern until a capability requires it |
| Exposing internal cuid IDs / logging full request bodies | Security/privacy: strip at DTO boundary; log metadata not payloads |
| Generic `BaseService<T>` god-abstraction | Anti-pattern; per-domain services only (org-scoped `BaseRepository` is the allowed shared base) |
| Frontend implementation | Backend-first; frontend is a future milestone |

## Traceability

Which phases cover which requirements. Populated during roadmap creation (2026-06-29).

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | Phase 1 | Pending |
| TOOL-02 | Phase 1 | Pending |
| TOOL-03 | Phase 1 | Pending |
| TOOL-04 | Phase 1 | Pending |
| TOOL-05 | Phase 1 | Pending |
| TOOL-06 | Phase 1 | Pending |
| TOOL-07 | Phase 1 | Pending |
| INFRA-01 | Phase 2 | Pending |
| INFRA-02 | Phase 2 | Pending |
| INFRA-03 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 2 | Pending |
| INFRA-14 | Phase 2 | Pending |
| INFRA-04 | Phase 3 | Complete |
| INFRA-07 | Phase 3 | Complete |
| INFRA-08 | Phase 3 | Complete |
| INFRA-09 | Phase 3 | Complete |
| INFRA-10 | Phase 3 | Complete |
| INFRA-11 | Phase 3 | Complete |
| INFRA-12 | Phase 3 | Complete |
| INFRA-13 | Phase 3 | Complete |
| SEAM-06 | Phase 3 | Complete |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| RBAC-01 | Phase 5 | Pending |
| RBAC-02 | Phase 5 | Pending |
| RBAC-03 | Phase 5 | Pending |
| RBAC-04 | Phase 5 | Pending |
| TENANT-01 | Phase 6 | Pending |
| TENANT-02 | Phase 6 | Pending |
| TENANT-03 | Phase 6 | Pending |
| TENANT-04 | Phase 6 | Pending |
| TENANT-05 | Phase 6 | Pending |
| TENANT-06 | Phase 6 | Pending |
| TENANT-07 | Phase 6 | Pending |
| SEAM-05 | Phase 6 | Pending |
| PROJ-01 | Phase 7 | Pending |
| PROJ-02 | Phase 7 | Pending |
| PROJ-03 | Phase 7 | Pending |
| PROJ-04 | Phase 7 | Pending |
| SEAM-01 | Phase 8 | Pending |
| SEAM-02 | Phase 8 | Pending |
| SEAM-03 | Phase 8 | Pending |
| SEAM-04 | Phase 8 | Pending |
| SCAF-01 | Phase 9 | Pending |
| SCAF-02 | Phase 9 | Pending |
| SCAF-03 | Phase 9 | Pending |
| SCAF-04 | Phase 9 | Pending |
| SCAF-05 | Phase 9 | Pending |
| SCAF-06 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 53 total (enumerated IDs; the prior "45" header count was stale)
- Mapped to phases: 53 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 after roadmap creation (traceability populated, count corrected 45→53)*
