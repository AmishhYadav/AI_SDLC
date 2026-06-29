# Enterprise AI Delivery Platform

## What This Is

An enterprise-grade platform that automates the software delivery lifecycle through AI orchestration. It ingests work items (Azure DevOps), runs a repository-intelligence pipeline, generates documentation (BRD → TSD → LLD → ADR) and production code through LangGraph-orchestrated AI graphs with human approval at every stage, then validates, tests, and ships pull requests. It is built for enterprise engineering organizations and is designed for production deployment — not a demo, prototype, or reduced-scope MVP.

The system is a 14-domain modular-monolith (NestJS 11) backed by PostgreSQL + Qdrant + Redis, with a Next.js frontend, authenticated via Microsoft Entra ID, deployed to AWS EKS. It is built incrementally over multiple milestones until the complete platform — exactly as designed in `Enterprise-AI-Delivery-Platform-Documentation/` — is delivered.

## Core Value

Architectural correctness and production readiness of a permanent engineering foundation that every future capability and microservice extraction builds on without structural rewrites. If everything else slips, this foundation must be right.

## Current Milestone

**Backend Foundation** (the user's "Phase 1 of implementation").

Deliver a production-ready backend skeleton on top of the completed database layer:
- Modular NestJS 11 architecture following the already-defined domain boundaries.
- Shared infrastructure: configuration, dependency injection, structured logging, exception handling, request validation, interceptors, common utilities, health checks, Swagger/OpenAPI, environment management.
- Prisma integration via the existing `@repo/database` package — **without modifying the completed schema**.
- A clean module structure for all platform domains (many initially scaffolded).
- Authentication and RBAC infrastructure prepared for Microsoft Entra ID integration.
- Organization and Project foundations that future domains depend upon.
- An architecture that supports long-running workflows, AI orchestration, repository intelligence, and future microservice extraction.

This is the first implementation milestone. Subsequent milestones (via `/gsd:new-milestone`) deliver the remaining capabilities listed under Active.

## Requirements

### Validated

<!-- Shipped and confirmed. -->

- ✓ Production PostgreSQL schema (Prisma 6) split across 14 domains — existing (`packages/database`)
- ✓ Initial migration covering all domain tables — existing
- ✓ Seed bootstrap: system organization, 16 permissions, 4 RBAC roles — existing
- ✓ Shared `@repo/database` package exposing `PrismaModule` / `PrismaService` (NestJS, global) — existing

### Active

<!-- Building toward these. This milestone's scope is the Backend Foundation group;
     the rest are full-platform capabilities targeted by future milestones. -->

**Backend Foundation (this milestone):**

- [ ] NestJS 11 modular-monolith application skeleton following defined domain boundaries
- [ ] Shared infrastructure: typed configuration + environment management
- [ ] Shared infrastructure: structured logging
- [ ] Shared infrastructure: global exception handling with typed, actionable errors
- [ ] Shared infrastructure: request validation pipeline
- [ ] Shared infrastructure: interceptors (response shaping, logging/audit, timing)
- [ ] Shared infrastructure: health checks (liveness/readiness, DB connectivity)
- [ ] Shared infrastructure: Swagger/OpenAPI documentation at `/api/v1`
- [ ] Prisma integration via `@repo/database` with no schema changes
- [ ] Module scaffolding for all 14 domains (consistent layered structure)
- [ ] Authentication infrastructure prepared for Microsoft Entra ID (SSO) integration
- [ ] RBAC authorization infrastructure (roles/permissions enforcement)
- [ ] Organization foundation (organizations, members)
- [ ] Project foundation (projects, teams)
- [ ] Architecture supports long-running workflows, AI orchestration, and microservice extraction without rewrites

**Future milestones (full platform — not this milestone):**

- [ ] Repository Intelligence domain (clone, language detection, AST, dependency/API/DB/architecture discovery)
- [ ] Knowledge Hub domain (context packages, semantic search via Qdrant, embeddings)
- [ ] Documentation Intelligence domain (BRD/TSD/LLD/ADR + Mermaid generation)
- [ ] Planning domain (work-item planning, impact analysis, implementation plans)
- [ ] Development domain (backend/frontend code generation, developer workspace, consensus review)
- [ ] Validation domain (security, performance, cost, compliance checks)
- [ ] Testing domain (test generation, execution, auto-fix)
- [ ] Delivery domain (branches, commits, pull requests, Azure DevOps sync)
- [ ] Organizational Learning domain (pattern capture, coding preferences)
- [ ] AI Platform domain (model/prompt/capability/graph registries, cost routing, execution)
- [ ] LangGraph workflow orchestration (8 specialized graphs, checkpointed state, human approval nodes)
- [ ] External integrations (Azure DevOps, GitHub, Stitch, SonarQube)
- [ ] Next.js + React + shadcn/ui frontend
- [ ] Persistence expansion: Qdrant (vectors), Redis (cache/queue/sessions)
- [ ] Deployment: AWS EKS, RDS, ElastiCache, Terraform, GitHub Actions CI/CD

### Out of Scope

<!-- Explicit boundaries for THIS milestone. -->

- Modifying the completed database schema — it is finished and authoritative; future schema work is additive only
- Implementing domain business logic for non-foundation domains — those domains are scaffolded only this milestone
- Frontend implementation — backend-first; frontend is a future milestone
- Qdrant and Redis runtime integration — wiring deferred until the capabilities that need them
- Live Entra ID tenant integration — auth is structured and ready, but full SSO wiring to a real tenant is verified in its own milestone
- Reduced-scope or temporary shortcuts substituting for planned capabilities — prohibited unless explicitly instructed

## Context

- **Authoritative design source:** `Enterprise-AI-Delivery-Platform-Documentation/` — vision, BRDs, capability map, Domain Architecture (DAS Volumes I–IV), High-Level Design, module specs, LangGraph architecture, data architecture (ERD), service/API contracts, deployment/DevOps. All implementation must conform to these.
- **Codebase map:** `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING) reflects the current implemented vs. planned split as of 2026-06-29.
- **Implemented today:** only `packages/database`. Everything else is greenfield on top of it.
- **Layering constraint (from CLAUDE.md + DAS):** API → Application → Domain → Infrastructure → Persistence. Controllers orchestrate only; services hold business logic; repositories do data access. Business domains never call LLM providers directly — all AI execution flows through the AI Platform domain. Cross-domain DB access is prohibited; domains communicate via published APIs (sync) or domain events (async).
- **Conventions:** Prisma models PascalCase singular with snake_case `@@map`; cuid IDs; soft-delete audit fields on all models; planned NestJS module dirs kebab-case; files `[domain].service.ts` / `.controller.ts` / `.repository.ts` / `.module.ts`.

## Constraints

- **Tech stack**: NestJS 11.1.x, Prisma 6.19.x, PostgreSQL — fixed by existing code and design docs.
- **Tech stack**: TypeScript on Node.js 22+ (seed uses `--experimental-strip-types`) — established by the database package.
- **Architecture**: Modular monolith, microservice-ready — every decision must preserve future extraction without rewrites.
- **Database**: The existing Prisma schema is the single source of truth and must not be modified this milestone — additive-only thereafter.
- **AI mediation**: No business domain may call an LLM provider directly — must route through the AI Platform domain (future).
- **Security**: Microsoft Entra ID (SSO) is the planned auth provider; least-privilege RBAC; assume hostile input; never expose secrets/stack traces/internal IDs.
- **Quality bar**: Production-grade for paying enterprise customers. No shortcuts or simplifications substituting for planned capabilities unless explicitly instructed.
- **Tooling gap**: No build/lint/format/test tooling configured yet (no tsconfig, eslint, prettier, test framework) — this milestone establishes them.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build the complete platform incrementally, not an MVP | Architecture, domains, data model, and roadmap already designed in detail; goal is the full production product | — Pending |
| Roadmap scopes the Backend Foundation milestone only; PROJECT.md holds the full-platform vision | Keeps each phase high-quality and verifiable; later capabilities come via `/gsd:new-milestone` | — Pending |
| Database layer is complete and frozen for this milestone | It is production-grade and authoritative; modifying it would risk the foundation | — Pending |
| Scaffold all 14 domain modules now, implement only foundation domains | Establishes the permanent module structure so future domains drop in without restructuring | — Pending |
| Prioritize correctness/maintainability/extensibility over speed | First implementation milestone sets the permanent foundation for the entire platform | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-29 after initialization*
