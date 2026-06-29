<!-- refreshed: 2026-06-29 -->
# Architecture

**Analysis Date:** 2026-06-29

> **Implementation Status Note**
> This document covers two distinct states:
> - **Implemented now** — what exists as running code in the repository today
> - **Documented/planned** — the target architecture defined in `Enterprise-AI-Delivery-Platform-Documentation/`
>
> All future implementation work should conform to the planned architecture described here.

---

## Implemented Now — What Exists As Code

### Implemented Components

Only one package exists as implemented code:

| Component | Status | Location |
|-----------|--------|----------|
| `packages/database` | Implemented | `packages/database/` |
| NestJS backend | Not started | Planned only |
| Next.js frontend | Not started | Planned only |
| LangGraph AI platform | Not started | Planned only |

### Database Package Structure (Implemented)

```text
packages/database/
├── src/
│   ├── index.ts              # Barrel export: PrismaModule, PrismaService, generated client
│   ├── prisma.module.ts      # NestJS @Global() module providing PrismaService
│   └── prisma.service.ts     # PrismaClient wrapper with OnModuleInit/OnModuleDestroy
├── prisma/
│   ├── schema/
│   │   ├── schema.prisma     # Root: datasource (PostgreSQL) + generator config
│   │   ├── identity.prisma   # User, Role, Permission, UserRole, Session, UserPreference
│   │   ├── organization.prisma   # Organization, Project, Team, OrganizationMember
│   │   ├── integration.prisma    # Integration
│   │   ├── repository.prisma     # Repository and intelligence models
│   │   ├── knowledge.prisma      # KnowledgeSource, ContextPackage, EmbeddingMetadata, AdrIndex
│   │   ├── documentation.prisma  # Brd, Tsd, Lld, Adr, Diagram, DocumentationVersion
│   │   ├── planning.prisma       # WorkItem, PlanningSession, ImpactReport, ImplementationPlan
│   │   ├── development.prisma    # GeneratedCode, CodeGeneration, DeveloperReview, ConsensusResult, CodeChat, CodeRefactor
│   │   ├── validation.prisma     # ValidationReport, ValidationFinding, SecurityReport, PerformanceReport, CostReport, ComplianceReport
│   │   ├── testing.prisma        # TestSuite, TestCase, TestRun, CoverageReport, AutoFixHistory
│   │   ├── delivery.prisma       # Branch, Commit, PullRequest, PullRequestReview, DeploymentReport
│   │   ├── learning.prisma       # LearningProfile
│   │   ├── ai-platform.prisma    # Capability, Prompt, AiModel, Graph, WorkflowRun, WorkflowState, WorkflowEvent, HumanApproval, AiExecution
│   │   └── operations.prisma     # AuditLog, Notification, configuration
│   ├── migrations/
│   │   └── 20260627064322_init/migration.sql   # Single initial migration (all tables)
│   └── seed.ts               # Bootstrap: system org, 16 permissions, 4 RBAC roles
└── generated/
    └── client/               # Prisma-generated TypeScript client (do not edit)
```

### PrismaService Pattern (Implemented)

`packages/database/src/prisma.service.ts` extends `PrismaClient` and implements NestJS lifecycle hooks. Import via `PrismaModule` (globally registered) which exports `PrismaService`.

```typescript
// Consumer pattern in any NestJS module:
import { PrismaService } from '@repo/database';

@Injectable()
class SomeRepository {
  constructor(private readonly prisma: PrismaService) {}
}
```

### Seed Bootstrap Data (Implemented)

`packages/database/prisma/seed.ts` creates:
- 1 system organization (`slug: 'system'`)
- 16 permissions covering every domain (e.g., `organization:read`, `development:execute`, `ai-platform:manage`)
- 4 RBAC roles: Platform Administrator, Engineering Manager, Developer, Viewer

---

## Planned Architecture — Target System

### System Overview

```text
                         Enterprise Users
                                │
                                ▼
                  ┌─────────────────────────┐
                  │   Next.js Frontend       │
                  │   (React + shadcn/ui)    │
                  └────────────┬────────────┘
                               │ HTTP/REST
                               ▼
                  ┌─────────────────────────┐
                  │      API Gateway         │
                  │   /api/v1 (NestJS)       │
                  └──────┬──────┬──────┬────┘
                         │      │      │
          ┌──────────────┘      │      └──────────────┐
          ▼                     ▼                      ▼
  Business Services       AI Platform         Platform Services
  (Identity, Org,         (Orchestrator,      (Audit, Notify,
   Integration,           Model Router,        Config,
   Repo, Knowledge,       Prompt Svc,          Monitoring)
   Docs, Planning,        Context Engine,
   Dev, Validation,       Graph Registry,
   Testing, Delivery,     State Manager)
   Learning)
          │                     │
          └──────────┬──────────┘
                     ▼
        ┌────────────────────────────┐
        │      Persistence Layer      │
        │  PostgreSQL | Qdrant | Redis │
        └────────────────────────────┘
```

### Architectural Style

| Layer | Pattern |
|-------|---------|
| Frontend | Component-Based (Next.js App Router) |
| Backend | Modular Monolith, Microservice-Ready |
| AI | LangGraph Workflow Orchestration |
| Communication | REST (sync) + Domain Events (async) |
| Persistence | PostgreSQL + Qdrant (vectors) + Redis (cache/queue) |
| Authentication | Microsoft Entra ID (SSO) |
| Deployment | Kubernetes (AWS EKS) |

---

## Planned Layers — Backend Per-Domain Structure

Every domain follows the same five-layer stack:

```
API Layer          ← NestJS controllers, route handlers, request validation
       ↓
Application Layer  ← Use cases, orchestration, workflow triggers
       ↓
Domain Layer       ← Business rules, entities, aggregates, domain events
       ↓
Infrastructure Layer ← External integrations, LLM calls via AI Platform
       ↓
Persistence Layer  ← Prisma repositories (PostgreSQL access)
```

**Constraint:** Business logic must not exist in controllers. Controllers orchestrate only. Services contain business logic. Repositories perform database access.

---

## Planned Bounded Contexts (14 Domains)

### Core Business Domains

| Domain | Primary Responsibility | Key Schema File |
|--------|----------------------|----------------|
| Repository | Codebase intelligence, plumbing, architecture discovery | `packages/database/prisma/schema/repository.prisma` |
| Knowledge | Context packages, semantic search, embeddings | `packages/database/prisma/schema/knowledge.prisma` |
| Documentation | BRD, TSD, LLD, ADR, Mermaid diagrams generation | `packages/database/prisma/schema/documentation.prisma` |
| Planning | Work item planning, impact analysis, LLD generation | `packages/database/prisma/schema/planning.prisma` |
| Development | Backend/frontend code generation, developer workspace | `packages/database/prisma/schema/development.prisma` |
| Validation | Security, performance, cost, compliance checks | `packages/database/prisma/schema/validation.prisma` |
| Testing | Test generation, execution, auto-fix | `packages/database/prisma/schema/testing.prisma` |
| Delivery | Branches, commits, pull requests, Azure DevOps sync | `packages/database/prisma/schema/delivery.prisma` |
| Learning | Organizational learning, coding preferences | `packages/database/prisma/schema/learning.prisma` |

### Supporting Domains

| Domain | Primary Responsibility | Key Schema File |
|--------|----------------------|----------------|
| Identity | Authentication (Entra ID), RBAC, sessions | `packages/database/prisma/schema/identity.prisma` |
| Organization | Organizations, projects, teams, memberships | `packages/database/prisma/schema/organization.prisma` |
| Integration | Azure DevOps, GitHub, Stitch, SonarQube connectors | `packages/database/prisma/schema/integration.prisma` |

### Platform Domains

| Domain | Primary Responsibility | Key Schema File |
|--------|----------------------|----------------|
| AI Platform | Model Registry, Prompt Registry, Capability Registry, Graph Registry, LangGraph execution, Cost Routing | `packages/database/prisma/schema/ai-platform.prisma` |
| Platform Operations | Audit logs, notifications, configuration, monitoring | `packages/database/prisma/schema/operations.prisma` |

**Ownership rule:** Every business object has exactly one owning domain. Direct database access between domains is prohibited. Cross-domain calls use published APIs (sync) or domain events (async).

---

## Planned Data Flow — Primary SDLC Pipeline

```
1.  Azure DevOps Work Item imported by Integration Domain
2.  Repository Domain runs intelligence pipeline:
    Clone → Language Detection → AST Parsing → Dependency Analysis
    → API Discovery → Database Discovery → Architecture Discovery
    → Repository Profile → Knowledge Hub
3.  Knowledge Domain builds Context Package (semantic search via Qdrant)
4.  Documentation Domain generates BRD → TSD → LLD (human approval required at each stage)
5.  Planning Domain performs impact analysis, creates Implementation Plan
6.  Development Domain triggers AI Orchestrator:
    Context Package → LLM A (generate) → LLM B (review) → Consensus Agent → Developer Workspace
7.  Human reviews generated code (HumanApproval.stage = GENERATED_CODE)
8.  Validation Domain runs: Security + Performance + Cost + Compliance
9.  Testing Domain generates tests, executes, runs auto-fix
10. Delivery Domain creates GitHub branch, commits, opens Pull Request
    → Updates Azure DevOps work item status
11. Learning Domain captures organizational patterns from the completed workflow
```

**Human approval checkpoints (HumanApprovalStage enum):** `BRD` | `TSD` | `LLD` | `GENERATED_CODE` | `PULL_REQUEST`

---

## Planned LangGraph AI Architecture

The AI Platform Domain owns all AI execution. Business domains never call LLM providers directly.

```text
                     AI Orchestrator
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
Repository Graph    Documentation Graph   Planning Graph
                                                │
                                                ▼
                                       Development Graph
                                                │
                                                ▼
                                        Validation Graph
                                                │
                                                ▼
                                          Testing Graph
                                                │
                                                ▼
                                          Delivery Graph
                                                │
                                                ▼
                                          Learning Graph
```

### Graph Execution Model

- Each graph is independently versioned (`Graph.version` in `packages/database/prisma/schema/ai-platform.prisma`)
- `GraphType` enum: `REPOSITORY | DOCUMENTATION | PLANNING | DEVELOPMENT | VALIDATION | TESTING | DELIVERY | LEARNING`
- Every graph maintains persistent state via `WorkflowRun` → `WorkflowState` → `WorkflowCheckpoint`
- `WorkflowStatus` enum: `PENDING | RUNNING | WAITING_FOR_APPROVAL | FAILED | COMPLETED | CANCELLED`
- State is persisted after every node execution (resumable from checkpoints)
- Human approval nodes are explicit graph nodes; workflow halts at `WAITING_FOR_APPROVAL`
- Graphs communicate through domain events, not direct invocation

### AI Workflow Lifecycle (per execution)

```
Business Request → Capability Resolution → Context Retrieval
→ Prompt Construction → Model Selection (Cost Optimizer)
→ LangGraph Execution → Human Approval (if required)
→ Artifact Generation → Audit & Learning
```

All AI executions are recorded in `AiExecution` model with `AiExecutionStatus`: `PENDING | RUNNING | SUCCEEDED | FAILED | RETRIED | CANCELLED`.

---

## Planned Persistence Architecture

### PostgreSQL (Primary Store — via Prisma)

Stores all structured business data:
- Organizations, users, RBAC, sessions
- Repository profiles, knowledge sources, embeddings metadata
- All documentation artifacts (BRD, TSD, LLD, ADR)
- Workflow state, checkpoints, events
- Audit trail, notifications

Connection: `DATABASE_URL` env var. Schema split across 14 `.prisma` files under `packages/database/prisma/schema/`.

### Qdrant (Vector Store — Planned)

Stores semantic embeddings for:
- Repository code and architecture
- Documentation artifacts
- Enterprise knowledge hub
- Architecture Decision Records

Referenced via `EmbeddingMetadata` table in `packages/database/prisma/schema/knowledge.prisma`.

### Redis (Cache and Queue — Planned)

Stores:
- User sessions
- Workflow execution cache
- Context package cache
- Queue state for async workflows
- Temporary execution state

---

## Planned API Standards

All REST endpoints:
- Versioned at `/api/v1`
- Follow RESTful conventions
- Return standardized response objects
- Validate all request payloads
- Include authorization checks
- Produce OpenAPI documentation

Key endpoint prefixes (from `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md`):
- Identity: `/api/v1/auth/*`, `/api/v1/users/*`
- Organization: `/organizations`, `/projects`, `/teams`
- Repository: `/repositories/*`
- Knowledge: `/knowledge/*`
- Documentation: `/documentation/*`
- Development: `/development/*`
- Validation: `/validation/*`

---

## Planned Deployment Architecture

Target: AWS EKS (Kubernetes)

| Service | AWS Resource |
|---------|-------------|
| Frontend | EKS pod (frontend namespace) |
| NestJS API | EKS pod (backend namespace) |
| AI Workers | EKS pod (ai-platform + workers namespaces) |
| PostgreSQL | Amazon RDS PostgreSQL |
| Redis | Amazon ElastiCache Redis |
| Qdrant | EKS pod or EC2 (infrastructure namespace) |
| Observability | CloudWatch + monitoring namespace |

Ingress: AWS Route53 → Application Load Balancer → Ingress Controller → EKS.

CI/CD: GitHub Actions. Infrastructure as Code: Terraform.

---

## Domain Communication Rules

- Synchronous (API): `Identity ↔ Organization`, `Knowledge → Planning`, `Documentation → Planning`
- Asynchronous (Events): `Integration → Repository`, `Repository → Knowledge`, `Planning → Development`, `Development → Validation`, `Validation → Testing`, `Testing → Delivery`, `Delivery → Learning`
- Direct database access between domains: **prohibited**
- AI calls from business domains to LLM providers: **prohibited** (must go through AI Platform Domain)

---

## Anti-Patterns

### Business logic in controllers

**What happens:** Controller methods contain branching, calculations, or decisions rather than delegating to services.
**Why it's wrong:** Makes controllers impossible to unit-test and duplicates logic across routes.
**Do this instead:** Controllers orchestrate only. Place all business rules in service classes under the domain layer.

### Business domain calling LLM directly

**What happens:** A service (e.g., DocumentationService) imports an LLM SDK and calls it directly.
**Why it's wrong:** Bypasses the AI Platform Domain's model routing, cost optimization, prompt versioning, and audit trail.
**Do this instead:** Business domains submit capability requests to the AI Orchestrator. The AI Platform Domain handles all LLM execution.

### Cross-domain database access

**What happens:** A repository from Domain A queries tables owned by Domain B using `prisma.domainBModel.findMany()`.
**Why it's wrong:** Violates bounded context isolation and creates hidden coupling.
**Do this instead:** Call the owning domain's published API or consume its domain events.

---

## Error Handling Strategy (Planned)

- Every error must be typed, actionable, and informative (what failed, why, how to fix)
- Avoid generic exceptions
- Workflow failures use `WorkflowStatus.FAILED` with retry support (`WorkflowRun.metadata` captures retry context)
- AI execution failures use `AiExecutionStatus.RETRIED` before escalating to `FAILED`
- All errors are captured in `AuditLog` for traceability

---

*Architecture analysis: 2026-06-29*
