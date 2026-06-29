# External Integrations

**Analysis Date:** 2026-06-29

> **Status legend used throughout this document:**
> - **[IMPLEMENTED]** — exists in committed code (schema model/enum defined)
> - **[SCHEMA ONLY]** — the Prisma model exists but no service/adapter code has been written
> - **[PLANNED]** — specified in architecture docs under `Enterprise-AI-Delivery-Platform-Documentation/`, schema not yet defined

The integration provider enum and `Integration` model are fully defined in `packages/database/prisma/schema/integration.prisma`. No service-layer adapter code exists yet in any package.

---

## Source Control & Work Item Providers

**Azure DevOps [SCHEMA ONLY]:**
- Purpose: Primary work item source (Azure Work Items drive the entire SDLC pipeline), repository hosting, branch/PR management
- Schema: `IntegrationProvider.AZURE_DEVOPS` in `packages/database/prisma/schema/integration.prisma`
- Work item link: `WorkItem.azureWorkItemId` (Int) in `packages/database/prisma/schema/planning.prisma`
- Delivery interaction: Delivery Graph commits code, creates PRs, and updates Azure Work Item status on merge (`packages/database/prisma/schema/delivery.prisma`)
- Auth: PAT or OAuth — stored encrypted in `Credential` model (`packages/database/prisma/schema/integration.prisma`)
- Planned SDK: Azure DevOps Node API (no package.json entry yet)

**GitHub [SCHEMA ONLY]:**
- Purpose: Repository hosting, PR creation, branch management, CI/CD trigger
- Schema: `IntegrationProvider.GITHUB` and `RepositoryProvider.GITHUB` in `packages/database/prisma/schema/integration.prisma` and `organization.prisma`
- Auth: GitHub token — stored in `Credential` model
- Planned use: Repository cloning for intelligence pipeline, PR creation in Delivery Graph
- Also supported: `RepositoryProvider.GITLAB`, `RepositoryProvider.BITBUCKET` (schema enums defined, not in `IntegrationProvider`)

---

## UI Generation

**Stitch [SCHEMA ONLY]:**
- Purpose: AI-powered frontend UI generation. Used by the Development Graph Frontend Workflow to convert LLD specs into generated UI components
- Schema: `IntegrationProvider.STITCH` in `packages/database/prisma/schema/integration.prisma`
- Auth: Stored in `Credential` model
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md`, `Enterprise-AI-Delivery-Platform-Documentation/06-Module-Specifications/Module-Specifications.md`

---

## Code Quality

**SonarQube [SCHEMA ONLY]:**
- Purpose: Static code analysis; results feed into the Validation Graph's security and compliance reviews
- Schema: `IntegrationProvider.SONARQUBE` in `packages/database/prisma/schema/integration.prisma`
- Auth: Stored in `Credential` model
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md`

---

## Collaboration & Notifications

**Slack [SCHEMA ONLY]:**
- Purpose: Outbound notifications — workflow status, human approval requests, alerts
- Schema: `IntegrationProvider.SLACK` in `packages/database/prisma/schema/integration.prisma`
- Auth: Bot token — stored in `Credential` model

**Microsoft Teams [SCHEMA ONLY]:**
- Purpose: Outbound notifications (enterprise default given Microsoft Entra ID SSO dependency)
- Schema: `IntegrationProvider.MICROSOFT_TEAMS` in `packages/database/prisma/schema/integration.prisma`
- Auth: Incoming webhook URL or Bot credentials — stored in `Credential` model

**Confluence [SCHEMA ONLY]:**
- Purpose: Documentation publishing (BRD, TSD, LLD, ADR export)
- Schema: `IntegrationProvider.CONFLUENCE` in `packages/database/prisma/schema/integration.prisma`
- Auth: Stored in `Credential` model

---

## Data Storage

**Databases:**

| System | Status | Purpose | Connection |
|--------|--------|---------|-----------|
| PostgreSQL | [IMPLEMENTED] | Primary relational store — all business data, workflow state, audit logs, AI execution metadata | `DATABASE_URL` env var, schema at `packages/database/prisma/schema/` |
| Qdrant | [PLANNED] | Vector database for repository embeddings, documentation embeddings, semantic search | `VectorStoreProvider.QDRANT` enum in `packages/database/prisma/schema/knowledge.prisma`; planned deployment on EKS |
| Redis | [PLANNED] | Sessions, workflow cache, context cache, queue state, temporary execution state | AWS ElastiCache; planned deployment on EKS |

**Alternative vector stores (schema-enumerated, not confirmed for use):**
- `VectorStoreProvider.PGVECTOR` — pgvector PostgreSQL extension
- `VectorStoreProvider.PINECONE` — Pinecone managed vector DB
- `VectorStoreProvider.WEAVIATE` — Weaviate vector DB
- All four options are defined in `packages/database/prisma/schema/knowledge.prisma`; Qdrant is the primary per deployment docs

**File Storage:**
- Amazon S3 [PLANNED] — documentation exports, generated reports, logs, backups, large artifacts
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

---

## Authentication & Identity

**Microsoft Entra ID [PLANNED]:**
- Purpose: Enterprise SSO — the sole planned identity provider. Handles user authentication before JWT issuance.
- Implementation: Identity Module (not yet scaffolded). After Entra ID auth, the platform issues JWTs for API access and stores sessions in the `Session` model (`packages/database/prisma/schema/identity.prisma`)
- RBAC: Custom RBAC layer via `Role`, `Permission`, `UserRole`, `RolePermission` models — not delegated to Entra ID
- Architecture docs: `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md`, `Enterprise-AI-Delivery-Platform-Documentation/06-Module-Specifications/Module-Specifications.md`

**JWT Sessions [SCHEMA ONLY]:**
- Hashed refresh tokens stored in `Session` model (`packages/database/prisma/schema/identity.prisma`)
- Fields: `hashedRefreshToken`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`

---

## AI / LLM Providers

All AI provider integrations are [PLANNED] — no LLM client code exists. The `ModelProvider` enum and `AiModel` model are [SCHEMA ONLY] in `packages/database/prisma/schema/ai-platform.prisma`.

**Anthropic (Claude) [SCHEMA ONLY]:**
- Schema: `ModelProvider.ANTHROPIC`
- Planned default use: Documentation generation, Planning, Backend code generation (primary agent), Testing
- Recommended model: Claude Sonnet (per `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-IV-AI-Platform.md`)

**OpenAI (GPT) [SCHEMA ONLY]:**
- Schema: `ModelProvider.OPENAI`
- Planned default use: Backend code generation (secondary agent), Consensus Agent, Frontend Planning, Validation
- Recommended models: GPT-5 (backend/consensus), GPT-5 Mini (frontend planning, validation)

**Google (Gemini) [SCHEMA ONLY]:**
- Schema: `ModelProvider.GOOGLE`
- Planned default use: Classification tasks, Documentation updates (lower-cost operations)
- Recommended model: Gemini Flash

**AWS Bedrock [SCHEMA ONLY]:**
- Schema: `ModelProvider.AWS_BEDROCK`
- Planned use: Model fallback routing; allows accessing multiple model families through AWS

**Azure OpenAI [SCHEMA ONLY]:**
- Schema: `ModelProvider.AZURE_OPENAI`
- Planned use: Enterprise deployments where OpenAI access must route through Azure

**Multi-agent collaboration pattern (Planned):**
- Backend code generation uses two independent LLM agents (Claude Sonnet + GPT-5) whose outputs are reconciled by a Consensus Agent (GPT-5)
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/07-LangGraph-Architecture/LangGraph-Architecture.md`

---

## AI Orchestration & Tooling

**LangGraph [PLANNED]:**
- Purpose: Stateful, resumable workflow orchestration for 8 SDLC graphs
- Graphs: Repository Analysis, Documentation, Planning, Development, Validation, Testing, Delivery, Learning
- State schema: persisted to PostgreSQL via `WorkflowState`, `WorkflowCheckpoint`, `WorkflowRun` models
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/07-LangGraph-Architecture/LangGraph-Architecture.md`

**LangChain [PLANNED]:**
- Purpose: Chain/agent primitives used within LangGraph nodes
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md`

**LangSmith [PLANNED]:**
- Purpose: AI execution tracing, observability, prompt debugging
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/07-LangGraph-Architecture/LangGraph-Architecture.md`
- Note: Every graph execution records model used, token consumption, cost, latency, and retry count — these are also stored in `AiExecution` model

**MCP (Model Context Protocol) [PLANNED]:**
- Purpose: Tool/resource integration protocol for AI agents
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md`

---

## Monitoring & Observability

All monitoring integrations are [PLANNED].

**OpenTelemetry:**
- Purpose: Distributed tracing across API and AI service boundaries
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**Prometheus:**
- Purpose: Metrics collection — API latency, graph execution time, token usage, AI cost, queue depth, error rates
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**Grafana:**
- Purpose: Metrics dashboards
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**AWS CloudWatch:**
- Purpose: Cloud infrastructure monitoring
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**Platform-native observability (Schema Only):**
- `Metric` model in `packages/database/prisma/schema/operations.prisma` — stores platform metrics in PostgreSQL
- `Alert` model in `packages/database/prisma/schema/operations.prisma` — stores alert records
- `AuditLog` model in `packages/database/prisma/schema/operations.prisma` — full audit trail with `organizationId`, `userId`, `workflowRunId`, `ipAddress`

---

## CI/CD & Deployment

**GitHub Actions [PLANNED]:**
- Purpose: CI/CD pipeline — build, unit tests, static analysis, container build, security scan, image push, environment deploy, smoke tests
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**Docker [PLANNED]:**
- Purpose: Containerization of all deployable components (Frontend, Backend API, AI Orchestrator, LangGraph Worker, Background Worker)

**Kubernetes / AWS EKS [PLANNED]:**
- Purpose: Container orchestration; namespaces: `frontend`, `backend`, `ai-platform`, `workers`, `monitoring`, `infrastructure`

**Terraform [PLANNED]:**
- Purpose: Infrastructure as Code for networking, Kubernetes, databases, storage, IAM, monitoring, secrets
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

---

## Secrets Management

**AWS Secrets Manager [PLANNED]:**
- Stores: Azure credentials, GitHub tokens, LLM API keys, database credentials, OAuth secrets
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/10-Deployment-and-DevOps/Deployment-DevOps-Architecture.md`

**Database-persisted credentials [SCHEMA ONLY]:**
- `Credential` model in `packages/database/prisma/schema/integration.prisma` stores per-integration credentials encrypted at rest
- Fields: `key`, `secret`, `isEncrypted` (default true), `expiresAt`, `lastRotatedAt`

---

## Webhooks & Callbacks

**Webhook model [SCHEMA ONLY]:**
- `Webhook` model in `packages/database/prisma/schema/integration.prisma` tracks registered incoming webhooks per integration
- Fields: `events` (Json), `targetUrl`, `secret`, `lastDeliveryAt`, `failureCount`
- Planned incoming webhooks: Azure DevOps push events, GitHub repository events

**Outgoing webhooks [PLANNED]:**
- Notification Service will dispatch to Slack, Microsoft Teams, email
- Architecture doc: `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md`

---

## Environment Configuration

**Required environment variables (implemented):**
- `DATABASE_URL` — PostgreSQL connection string (referenced in `packages/database/prisma/schema/schema.prisma`)

**Required environment variables (planned, not yet documented in code):**
- `ANTHROPIC_API_KEY` — Claude model access
- `OPENAI_API_KEY` — GPT model access
- `GOOGLE_API_KEY` — Gemini model access
- `AZURE_DEVOPS_ORG_URL` + `AZURE_DEVOPS_PAT` — Azure DevOps integration
- `GITHUB_TOKEN` — GitHub integration
- `MICROSOFT_ENTRA_TENANT_ID` + `MICROSOFT_ENTRA_CLIENT_ID` + `MICROSOFT_ENTRA_CLIENT_SECRET` — SSO
- `REDIS_URL` — Redis connection
- `QDRANT_URL` — Qdrant connection
- `LANGSMITH_API_KEY` — LangSmith tracing
- `JWT_SECRET` — JWT signing

---

*Integration audit: 2026-06-29*
