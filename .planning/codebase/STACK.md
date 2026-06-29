# Technology Stack

**Analysis Date:** 2026-06-29

> **Status legend used throughout this document:**
> - **[IMPLEMENTED]** — exists in committed code today
> - **[PLANNED]** — specified in architecture docs under `Enterprise-AI-Delivery-Platform-Documentation/`, not yet built

---

## Languages

**Primary:**
- TypeScript — all implemented code in `packages/database/src/` and `packages/database/prisma/seed.ts`
- SQL (Prisma-managed) — migrations in `packages/database/prisma/schema/migrations/`

**Planned secondary:**
- TypeScript [PLANNED] — frontend (Next.js), full NestJS backend services (not yet scaffolded beyond the database package)

---

## Runtime

**Environment:**
- Node.js — version not pinned (no `.nvmrc` or `.node-version` present)
- The seed script uses `node --experimental-strip-types` (native TS stripping, Node.js 22+) — set in `packages/database/package.json` prisma.seed field

**Package Manager:**
- npm — lockfile present at `/Users/amish/AI_SDLC/package-lock.json` and `packages/database/package-lock.json`
- Lockfiles: present and committed

---

## Frameworks

**Core (Implemented):**
- NestJS 11.1.27 (`@nestjs/common`) — provides `@Injectable`, `@Global`, `@Module` decorators used in `packages/database/src/prisma.module.ts` and `packages/database/src/prisma.service.ts`
- Prisma 6.19.3 — ORM and schema management, split-schema configuration pointing to `packages/database/prisma/schema/`

**Core (Planned):**
- NestJS [PLANNED] — full modular monolith backend with layered architecture (API → Application → Domain → Infrastructure → Persistence). No NestJS app module exists yet.
- Next.js [PLANNED] — frontend framework. `nextjs ^0.0.3` is listed in root `package.json` (this is a stub/placeholder package, not the real `next` package; no Next.js app directory exists)
- React [PLANNED] — UI layer paired with Next.js
- LangGraph [PLANNED] — AI workflow orchestration engine for 8 specialized graphs
- LangChain [PLANNED] — chain/agent primitives used within LangGraph graphs

**Testing:**
- No test framework implemented yet.
- No test files exist in `packages/database/`.

**Build/Dev:**
- No build tooling configured (no `tsconfig.json`, no `esbuild`, no `webpack` config found)
- No linter or formatter config (no `.eslintrc*`, `.prettierrc*`, `biome.json`)

---

## Key Dependencies

**Implemented:**

| Package | Resolved Version | Location | Purpose |
|---------|-----------------|----------|---------|
| `@prisma/client` | 6.19.3 | root + `packages/database` | Prisma ORM client, generated at `packages/database/generated/client/` |
| `prisma` | 6.19.3 | root + `packages/database` | Prisma CLI, schema tooling, migrations |
| `@nestjs/common` | 11.1.27 | `packages/database` | NestJS DI decorators for `PrismaModule`/`PrismaService` |
| `@types/node` | ^26.0.1 | root devDependencies | Node.js type definitions |
| `reflect-metadata` | (transitive) | `packages/database/node_modules` | Required by NestJS decorator system |
| `rxjs` | (transitive) | `packages/database/node_modules` | Required by NestJS |

**Planned (architecture-documented, no package.json entry):**

| Package/Tool | Purpose |
|-------------|---------|
| `next` (real package) | Next.js frontend (currently only stub `nextjs 0.0.3` present) |
| `@langchain/langgraph` | LangGraph workflow orchestration |
| `@langchain/core` | LangChain primitives |
| `langsmith` | AI execution tracing and observability |
| `qdrant-client` | Qdrant vector database client |
| `ioredis` | Redis client for caching, sessions, queues |
| Tailwind CSS | Frontend utility CSS |
| shadcn/ui | Frontend component library |
| Monaco Editor | In-platform code editor for Developer Workspace |
| Mermaid.js | Architecture diagram rendering |

---

## Configuration

**Environment:**
- Database connection: `DATABASE_URL` env var consumed in `packages/database/prisma/schema/schema.prisma` via `env("DATABASE_URL")`
- `.env` file present at `packages/database/.env` (existence noted; contents not read)
- No `.env.example` or documented env var list exists yet

**Build:**
- `packages/database/package.json` sets `prisma.schema` to `prisma/schema` (split-schema directory)
- `packages/database/package.json` sets `prisma.seed` to `node --experimental-strip-types prisma/seed.ts`
- Generated Prisma client output: `packages/database/generated/client/`

**Planned configuration:**
- AWS Secrets Manager for production secrets [PLANNED]
- Kubernetes Secrets for in-cluster configuration [PLANNED]
- Feature flags via `Configuration` Prisma model (schema defined, service not implemented)

---

## Monorepo Structure

**Implemented:**
- Manual `packages/` directory — no monorepo tooling (no Turborepo, Nx, Lerna, or pnpm workspaces config)
- Currently one package: `packages/database`

**Planned:**
- Additional packages implied by architecture: `packages/backend` (NestJS app), `packages/frontend` (Next.js app), `packages/ai-platform` (LangGraph workers)

---

## Platform Requirements

**Development:**
- Node.js 22+ (required for `--experimental-strip-types`)
- PostgreSQL instance accessible via `DATABASE_URL`
- npm

**Production (Planned):**
- AWS EKS (Kubernetes) cluster
- Amazon RDS PostgreSQL (multi-AZ)
- Amazon ElastiCache Redis
- Qdrant cluster (self-hosted or cloud)
- Amazon S3 for artifacts, documentation exports, logs, backups
- AWS Route53, Application Load Balancer, CloudWatch

---

*Stack analysis: 2026-06-29*
