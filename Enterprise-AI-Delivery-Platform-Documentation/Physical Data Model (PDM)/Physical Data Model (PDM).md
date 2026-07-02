Enterprise AI Delivery Platform
Physical Data Model (PDM)
Version 1.0
Status: Locked
1. Database Philosophy
The database shall be:
Multi-tenant
Fully relational
ACID compliant
Normalized (3NF where practical)
Audit-friendly
Version-aware
Soft-delete enabled
AI metadata aware
2. Technology
Component	Technology
Database	PostgreSQL
Hosting (Dev)	Supabase
Hosting (Prod)	AWS RDS PostgreSQL
ORM	Prisma
Vector DB	Qdrant
Cache	Redis
3. Primary Key Strategy
Every table uses
id String @id @default(cuid())
Why CUID?
Collision resistant
URL friendly
Prisma native
Better than sequential IDs
No information leakage
4. Naming Convention
Prisma
camelCase
createdAt

organizationId

repositoryProfile
PostgreSQL
snake_case
Automatically handled by Prisma using
@@map()

@map()
5. Standard Columns
Every business table contains
id

createdAt

updatedAt

createdBy

updatedBy

deletedAt

deletedBy
Example
id          String   @id @default(cuid())

createdAt   DateTime @default(now())

updatedAt   DateTime @updatedAt

createdBy   String?

updatedBy   String?

deletedAt   DateTime?

deletedBy   String?
Every.
Single.
Table.
6. Multi-Tenancy
Every business object belongs to an organization.
Therefore
organizationId
exists on almost every table.
Example
Organization

↓

Project

↓

Repository

↓

WorkItem

↓

LLD

↓

GeneratedCode
7. Foreign Key Rules
Default
onDelete: Restrict

onUpdate: Cascade
Only use
Cascade
when child records are meaningless without the parent.
Example
Project

↓

Repository
Deleting a Project should not automatically delete the Repository in most cases—archiving is usually safer. Reserve cascading deletes for true dependent records like join tables.
8. Soft Delete
Never permanently delete business data.
Instead
deletedAt

deletedBy
Queries ignore deleted rows.
9. Versioning
Version these entities
BRD
TSD
LLD
ADR
Prompt
Workflow
RepositoryProfile
Every version immutable.
10. JSON Fields
Allowed only when schema is dynamic.
Examples
Prompt Variables

LLM Response Metadata

Workflow Metadata

Context Metadata

Model Parameters
Not for
Users
Projects
Organizations
Repositories
11. Enum Strategy
Enums live in the Prisma domain file where they are used.
Examples:
identity.prisma contains UserStatus
organization.prisma contains ProjectStatus and RepositoryStatus
ai-platform.prisma contains ModelProvider and WorkflowStatus
Enum names remain globally unique across the Prisma schema folder.
Do not duplicate enum definitions across files.
12. Indexing Rules
Every table gets
Primary Key
↓
Organization Index
↓
CreatedAt Index
Then add
Composite Indexes
when needed.
Example
@@index([organizationId])

@@index([createdAt])

@@index([repositoryId, status])
13. Unique Constraints
Example
Organization
↓
Repository Name
Unique
@@unique([organizationId, name])
14. Audit
Every AI execution stores
Prompt Version
Model
Cost
Tokens
Latency
Retry Count
User
Organization
15. Timestamps
Use
createdAt DateTime @default(now())

updatedAt DateTime @updatedAt
Never manually update timestamps.
16. Workflow State
Stored in PostgreSQL.
Redis only caches it.
Tables
WorkflowRun

WorkflowState

WorkflowCheckpoint

WorkflowEvent
17. Naming Rules
Models
Singular
User

Organization

Repository
Tables
Plural
users

organizations

repositories
Using
@@map("users")
18. Relation Naming
Always explicit.
Example
organization

projects

repositoryProfile

generatedCode

validationReports
Never ambiguous names.
19. File Organization
packages/

database/

prisma/

│

├── schema.prisma

├── datasource.prisma

├── generator.prisma

├── models/

│   ├── identity.prisma

│   ├── organization.prisma

│   ├── repository.prisma

│   ├── knowledge.prisma

│   ├── documentation.prisma

│   ├── planning.prisma

│   ├── development.prisma

│   ├── validation.prisma

│   ├── testing.prisma

│   ├── delivery.prisma

│   ├── learning.prisma

│   ├── ai-platform.prisma

│   └── operations.prisma

│

├── migrations/

└── seed.ts
20. Migration Rules
Every schema change
↓
New Migration
↓
Code Review
↓
Git
↓
CI
↓
Supabase
Never edit production tables manually.
Initial migration must also include PostgreSQL constraints that Prisma cannot express directly:
DocumentationVersion must have exactly one parent artifact reference across brdId, tsdId, lldId, adrId, and diagramId.
Soft-delete-aware unique constraints should use partial unique indexes where deletedAt IS NULL for user-facing names and keys that may be reused after archival.
At most one active default model should exist per organization, capability, and provider where applicable.
HumanApproval should have at most one pending approval per organization, stage, resourceType, and resourceId.
WorkflowState should have at most one current state per workflowRunId and nodeName.
21. Seeding
Seed
Roles
Permissions
Capabilities
Prompt Templates
Default Models
System Configurations
22. Storage Responsibilities
PostgreSQL
Business Data
Workflow Data
AI Metadata
Documentation
Configuration
Redis
Sessions
Queue State
Workflow Cache
Context Cache
Qdrant
Repository Embeddings
BRDs
TSDs
LLDs
ADRs
Code Embeddings
23. Database Standards (LOCKED)
Decision	Standard
ORM	Prisma
DB	PostgreSQL
Dev Host	Supabase
Prod Host	AWS RDS PostgreSQL
Primary Key	CUID
Naming	camelCase (Prisma)
Soft Delete	Yes
Audit Fields	Yes
Multi-Tenant	Yes
Versioning	Enabled
Workflow State	PostgreSQL
Vector Store	Qdrant
Cache	Redis
Migrations	Prisma Migrate
Seed	Prisma Seed
