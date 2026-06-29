# Codebase Structure

**Analysis Date:** 2026-06-29

> **Implementation Status Note**
> The repository is in early bootstrap phase. Only `packages/database` is implemented as code.
> All other directories under `packages/` and any application services must be created.
> Section "Where to Add New Code" provides authoritative guidance for all future work.

---

## Directory Layout

```
AI_SDLC/                                         # Monorepo root
├── packages/                                    # All deployable packages
│   └── database/                               # IMPLEMENTED: Shared Prisma database package
│       ├── src/
│       │   ├── index.ts                        # Barrel: exports PrismaModule, PrismaService, generated client
│       │   ├── prisma.module.ts                # NestJS @Global() module
│       │   └── prisma.service.ts               # PrismaClient with lifecycle hooks
│       ├── prisma/
│       │   ├── schema/
│       │   │   ├── schema.prisma               # Root: datasource + generator (do not add models here)
│       │   │   ├── identity.prisma             # Identity domain models
│       │   │   ├── organization.prisma         # Organization domain models
│       │   │   ├── integration.prisma          # Integration domain models
│       │   │   ├── repository.prisma           # Repository intelligence models
│       │   │   ├── knowledge.prisma            # Knowledge hub models
│       │   │   ├── documentation.prisma        # BRD/TSD/LLD/ADR models
│       │   │   ├── planning.prisma             # Planning and work item models
│       │   │   ├── development.prisma          # Code generation models
│       │   │   ├── validation.prisma           # Validation report models
│       │   │   ├── testing.prisma              # Test suite/run models
│       │   │   ├── delivery.prisma             # PR, branch, deployment models
│       │   │   ├── learning.prisma             # Organizational learning models
│       │   │   ├── ai-platform.prisma          # AI registries, workflow state
│       │   │   └── operations.prisma           # Audit logs, notifications
│       │   ├── migrations/
│       │   │   └── 20260627064322_init/        # Initial migration (all tables)
│       │   └── seed.ts                         # Bootstrap: system org, permissions, roles
│       └── generated/
│           └── client/                         # Prisma-generated client (do not edit)
├── Enterprise-AI-Delivery-Platform-Documentation/  # Architecture documentation (reference)
│   ├── 01-Executive/                           # Executive Vision & Platform Charter
│   ├── 02-Business-Requirements/               # BRD Volume I and II
│   ├── 03-Capability-Map/                      # Platform capability map
│   ├── 04-Domain-Architecture/                 # DAS Volumes I–IV (primary architecture reference)
│   ├── 05-High-Level-Design/                   # High-Level Design (HLD)
│   ├── 06-Module-Specifications/               # Per-module specifications
│   ├── 07-LangGraph-Architecture/              # AI workflow architecture
│   ├── 08-Data-Architecture/                   # ERD
│   ├── 09-Service-and-API-Architecture/        # Service & API contracts
│   ├── 10-Deployment-and-DevOps/               # Deployment architecture
│   └── Physical Data Model (PDM)/              # Physical data model
├── .planning/
│   └── codebase/                               # Codebase map documents (this directory)
├── .agent/                                     # GSD agent tooling (do not modify)
├── package.json                                # Root: monorepo dependencies (early placeholder)
├── package-lock.json
├── CLAUDE.md                                   # AI behavioral guidelines (authoritative)
└── AGENTS.md                                   # Agent instructions
```

---

## Planned Future Package Structure

Based on `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md` and `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md`, the expected monorepo structure once implementation begins:

```
packages/
├── database/             # IMPLEMENTED — shared Prisma client
├── backend/              # PLANNED — NestJS modular monolith
│   └── src/
│       ├── modules/
│       │   ├── identity/
│       │   ├── organization/
│       │   ├── integration/
│       │   ├── repository/
│       │   ├── knowledge/
│       │   ├── documentation/
│       │   ├── planning/
│       │   ├── development/
│       │   ├── validation/
│       │   ├── testing/
│       │   ├── delivery/
│       │   ├── learning/
│       │   ├── ai-platform/
│       │   └── platform-operations/
│       └── main.ts
├── frontend/             # PLANNED — Next.js + React + shadcn/ui
│   └── src/
│       └── app/
└── ai-workers/           # PLANNED — LangGraph workflow executors
```

---

## Directory Purposes

**`packages/database/`**
- Purpose: Shared database access package consumed by all backend services
- Contains: Prisma schema (split by domain), NestJS PrismaModule/PrismaService, generated Prisma client, migrations, seed
- Key files: `packages/database/src/index.ts`, `packages/database/prisma/schema/schema.prisma`
- Used by: All future NestJS modules via `import { PrismaService } from '@repo/database'`

**`packages/database/prisma/schema/`**
- Purpose: Domain-split Prisma schema files — one file per bounded context
- Pattern: Each file owns only the models for its domain. The root `schema.prisma` contains only datasource and generator config.
- Key constraint: Do NOT add models to `schema.prisma`. Add them to the appropriate domain `.prisma` file.

**`packages/database/generated/client/`**
- Purpose: Auto-generated Prisma TypeScript client
- Generated: Yes — do not edit manually. Regenerate with `prisma generate` after schema changes.
- Committed: Yes (currently)

**`Enterprise-AI-Delivery-Platform-Documentation/`**
- Purpose: Source-of-truth architecture documentation used to guide all implementation
- Contains: 10 documentation sections covering vision, domains, HLD, module specs, LangGraph, data models, APIs, deployment
- Key documents:
  - `04-Domain-Architecture/DAS-Volume-I-Foundation.md` — domain principles and boundaries
  - `04-Domain-Architecture/DAS-Volume-II-Business-Domains.md` — per-domain specifications
  - `04-Domain-Architecture/DAS-Volume-III-Domain-Collaboration.md` — cross-domain interaction matrix and event catalog
  - `04-Domain-Architecture/DAS-Volume-IV-AI-Platform.md` — AI platform architecture
  - `05-High-Level-Design/High-Level-Design.md` — implementation blueprint
  - `07-LangGraph-Architecture/LangGraph-Architecture.md` — AI workflow graph specs
  - `09-Service-and-API-Architecture/Service-API-Architecture.md` — service boundaries and REST API catalog

**`.planning/codebase/`**
- Purpose: GSD codebase map documents for use by plan-phase and execute-phase agents
- Generated: Yes (by gsd:map-codebase)
- Committed: No — gitignored under `.planning/`

---

## Key File Locations

**Entry Points:**
- `packages/database/src/index.ts` — database package public API

**Configuration:**
- `packages/database/prisma/schema/schema.prisma` — Prisma datasource and generator config
- `packages/database/package.json` — database package deps and prisma seed command

**Core Schema Files (by domain):**
- `packages/database/prisma/schema/identity.prisma` — User, Role, Permission, Session
- `packages/database/prisma/schema/organization.prisma` — Organization, Project, Team
- `packages/database/prisma/schema/ai-platform.prisma` — Capability, Prompt, AiModel, Graph, WorkflowRun

**Migration History:**
- `packages/database/prisma/schema/migrations/20260627064322_init/migration.sql` — initial schema (all domains)

**Seed:**
- `packages/database/prisma/seed.ts` — system org, permissions, RBAC roles

---

## Naming Conventions

**Prisma schema files:**
- One file per domain, lowercase, no prefix: `identity.prisma`, `organization.prisma`, `ai-platform.prisma`
- `schema.prisma` is reserved for datasource and generator config only

**Prisma model names:**
- PascalCase singular: `Organization`, `WorkflowRun`, `AiExecution`
- Table names (via `@@map`): snake_case plural: `organizations`, `workflow_runs`, `ai_executions`

**Prisma field names:**
- camelCase: `organizationId`, `createdAt`, `deletedBy`
- All models include: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` (soft delete pattern)
- IDs: `String @id @default(cuid())`

**Prisma enum names:**
- PascalCase: `UserStatus`, `WorkflowStatus`, `ModelProvider`
- Enum values: SCREAMING_SNAKE_CASE: `WAITING_FOR_APPROVAL`, `AWS_BEDROCK`

**Future NestJS module directories (planned):**
- kebab-case matching the domain name: `identity/`, `ai-platform/`, `platform-operations/`

**Future TypeScript files (planned — infer from CLAUDE.md):**
- Services: `[domain].service.ts` (e.g., `identity.service.ts`)
- Controllers: `[domain].controller.ts`
- Repositories: `[domain].repository.ts`
- Modules: `[domain].module.ts`
- DTOs: `[action]-[resource].dto.ts` (e.g., `create-organization.dto.ts`)

---

## Where to Add New Code

### New Prisma Model (new database entity)

1. Identify the owning domain from `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-II-Business-Domains.md`
2. Add the model to the corresponding file: `packages/database/prisma/schema/[domain].prisma`
3. Follow existing patterns: cuid IDs, soft delete fields, `@@map` with snake_case, `@@index` for query fields
4. Run `prisma migrate dev` to generate a new migration under `packages/database/prisma/schema/migrations/`
5. Run `prisma generate` to update `packages/database/generated/client/`

### New NestJS Domain Module (when backend is created)

Planned location: `packages/backend/src/modules/[domain-name]/`

Each domain module should contain:
```
[domain]/
├── [domain].module.ts         # NestJS module definition, imports PrismaModule
├── [domain].controller.ts     # Route handlers only — no business logic
├── [domain].service.ts        # Business logic
├── [domain].repository.ts     # Prisma data access
├── dto/                       # Request/response DTOs with validation
└── [domain].events.ts         # Domain event definitions
```

### New AI Workflow Graph (when AI platform is created)

Planned location: `packages/ai-workers/src/graphs/[graph-type]/`

Register the graph in the `Graph` model in `packages/database/prisma/schema/ai-platform.prisma`.

### New Seed Data

Add to `packages/database/prisma/seed.ts`. Run with `npm run db:seed` (command defined in `packages/database/package.json` prisma.seed).

### New Permission

Add to the `PERMISSIONS` array in `packages/database/prisma/seed.ts`. Follow the pattern `[resource]:[action]`.

---

## Special Directories

**`packages/database/generated/`**
- Purpose: Auto-generated Prisma client TypeScript code
- Generated: Yes — by `prisma generate`
- Committed: Yes (currently checked in to avoid build-time generation requirement)
- Warning: Never edit files in this directory manually

**`.agent/`**
- Purpose: GSD agent workflow tooling, skills, and contexts
- Generated: No — managed by GSD platform
- Committed: Partially (listed in `.gitignore` for some subdirectories)

**`Enterprise-AI-Delivery-Platform-Documentation/`**
- Purpose: Architecture source of truth — not application code
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-29*
