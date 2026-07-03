# Phase 7: Project Foundation — Research

**Researched:** 2026-07-03
**Domain:** NestJS modular-monolith — org-scoped Project/Team CRUD, member lifecycle management, in-process port contract
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Team is org-scoped (`organizationId`, `@@unique([organizationId, name])`, no `projectId`). "Teams within a project" is loose wording; the frozen schema governs.
- **D-02:** Build BOTH org-scoped Team + TeamMember AND ProjectMember management this phase.
- **D-03:** TeamMember lifecycle mirrors Phase 6 OrganizationMember: add existing ACTIVE org member, list, soft-remove, reactivate-on-readd via `@@unique([teamId, organizationMemberId])`. No JIT provisioning.
- **D-04:** TeamMember has no `roleName` field. Do not invent one.
- **D-05:** Full org-scoped Team CRUD (create/list/read/update/soft-delete), authorized by ACTIVE org membership. No last-member guardrail for teams.
- **D-06:** list/read return ALL projects in the active org (pure org-scoping). ProjectMember does NOT gate reads this phase.
- **D-07:** Project `key` is user-supplied and validated — reject duplicate-in-org or format violation with actionable errors.
- **D-08:** Creator is auto-added as ACTIVE ProjectMember on project creation (mirrors Phase 6 D-10 org-create).
- **D-09:** Project create authorization is membership-based (any ACTIVE org member).
- **D-10:** ProjectMember lifecycle: add existing ACTIVE org member by `organizationMemberId`, optional free-form `roleName`, soft-remove, reactivate-on-readd.
- **D-11:** Contracts at `packages/backend/src/contracts/organization/` — pure TS port interfaces + DI tokens + read-only summary DTOs; depends on NOTHING in any domain module.
- **D-12:** OrganizationPort is an in-process synchronous NestJS provider bound to a DI token.
- **D-13:** Port surface: `getOrganizationSummary(orgId)`, `getProjectSummary(projectId)`, `isActiveMember(orgId, userId, orgMemberId)` — lean read-only DTOs only; no list/enumeration methods.
- **Schema is frozen.** No migrations, no new columns, no schema changes.

### Claude's Discretion

- Exact module placement: one leaf module `src/project/` or two (`src/project/` + `src/team/`).
- Whether ProjectMember/TeamMember repos extend BaseRepository directly or use a thin variant.
- Creator `roleName` value on auto-add (e.g. `OWNER`) and allowed `roleName` vocabulary for D-10.
- Exact REST shape (routes, DTOs, pagination) following SEAM-06 conventions.
- Project `key` validation rules (charset, length, casing) and error codes.
- Port interface name, DI token name, file layout under `src/contracts/organization/`.
- Whether `getProjectSummary`/membership-check use scoped or unscoped Prisma path.

### Deferred Ideas (OUT OF SCOPE)

- Project-level private access control (ProjectMember gating reads).
- Team/Project member roles wired to RBAC.
- Repository entity/assignment.
- OrganizationPort enumeration methods.
- Per-org role provisioning.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | A user can create a project scoped to an organization they belong to | D-07/D-08/D-09 patterns; `src/project/` module mirroring Phase 6; `$transaction` for atomic creator-add |
| PROJ-02 | A user can list and read projects within their organization, scoped by the tenant context | `project` in `ORG_SCOPED_MODELS`; BaseRepository auto-scoping; `findMany`/`findFirst` patterns |
| PROJ-03 | A user can create teams within a project and manage team membership | `team` in `ORG_SCOPED_MODELS`; `teamMember` NOT scoped (manual raw-client); upsert re-add pattern; ProjectMember lifecycle |
| PROJ-04 | A published OrganizationPort/project-summary contract exposes org/project lookup to downstream domains | `src/contracts/organization/`; NestJS DI Symbol token; raw PrismaService for port adapter |

</phase_requirements>

---

## Summary

Phase 7 extends the Phase 6 tenancy foundation with org-scoped Project and Team entities, member management for both, and the first `contracts/<domain>/` port that downstream phases depend on. All four new entities (`Project`, `ProjectMember`, `Team`, `TeamMember`) are already present in the frozen Prisma schema — the work is entirely application code.

The Phase 6 `src/organization/` module is the authoritative reference implementation. Its three-layer layout (`api/application/persistence`), the upsert-for-reactivation pattern, the `assertPathMatchesContext` IDOR guard, the error catalog convention, and the atomic creator-add transaction must be replicated verbatim. Any deviation is a maintenance liability, not an improvement.

The two non-trivial challenges are: (1) `TeamMember` has no direct `organizationId` FK so the `TenantedPrismaService` auto-scoping cannot apply — team-member queries require raw `PrismaService` with explicit nested org filtering; (2) the `OrganizationPort` implementation adapter must use raw `PrismaService` (not `scopedPrisma.client`) with explicit org validation — the port may be called by future cross-org consumers and must never silently do a full-table unscoped read.

**Primary recommendation:** Two leaf modules — `src/project/` (Project + ProjectMember) and `src/team/` (Team + TeamMember) — both importing `TenancyModule`, with `OrganizationModule` providing the `OrganizationPort` DI token bound to a new `OrganizationPortAdapter` service.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project CRUD (create/list/read/update/soft-delete) | API / Backend (`src/project/`) | Database (Prisma via BaseRepository) | Business logic and org-scoping owned by backend service layer |
| ProjectMember management (add/list/remove/reactivate) | API / Backend (`src/project/`) | Database (raw PrismaService for upsert) | Lifecycle mirrors OrganizationMember; atomic upsert requires raw client |
| Team CRUD (create/list/read/update/soft-delete) | API / Backend (`src/team/`) | Database (Prisma via BaseRepository) | Team is parallel org-scoped entity to Project |
| TeamMember management (add/list/remove/reactivate) | API / Backend (`src/team/`) | Database (raw PrismaService — no org FK on TeamMember) | TeamMember has no `organizationId`; scoping must be explicit |
| OrganizationPort contract (interface + token + DTOs) | `src/contracts/organization/` | — | Pure TS; no domain imports; consumed by downstream phases |
| OrganizationPort adapter (implementation) | API / Backend (`src/organization/`) | Database (raw PrismaService — unscoped) | OrganizationModule provides the token; raw client for cross-org safety |
| Tenant isolation enforcement | Backend (`TenantedPrismaService`, `TenantGuard`) | — | Already in place from Phase 6; Project/Team/ProjectMember are pre-listed in `ORG_SCOPED_MODELS` |

---

## Standard Stack

No new packages. Phase 7 consumes what Phase 6 delivered.

### Core (already installed)

| Library | Verified Version | Purpose | Role in Phase 7 |
|---------|-----------------|---------|-----------------|
| `@nestjs/core` + `@nestjs/common` | 10.x [VERIFIED: codebase] | NestJS framework | Modules, controllers, services, DI |
| `@repo/database` (Prisma) | workspace [VERIFIED: codebase] | DB access | `PrismaService` for raw + `TenantedPrismaService` for scoped queries |
| `nestjs-cls` | installed [VERIFIED: codebase] | AsyncLocalStorage CLS | CLS reads in repositories and context service |
| `class-validator` + `class-transformer` | installed [VERIFIED: codebase] | DTO validation | Request body + query validation |

### Supporting (already installed)

| Library | Purpose | When Used |
|---------|---------|-----------|
| `vitest` + `unplugin-swc` | Unit test runner | All service + repository unit tests |
| `class-validator` decorators (`@IsString`, `@Matches`, `@IsOptional`, etc.) | DTO field validation | CreateProjectDto, CreateTeamDto, AddMemberDto |

**Installation:** No new packages to install.

---

## Package Legitimacy Audit

> No new packages are introduced in this phase. All dependencies were installed in prior phases.

| Package | Disposition |
|---------|-------------|
| *(none)* | N/A |

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (with X-Organization-Id header)
        │
        ▼
[ThrottlerGuard → JwtAuthGuard → PermissionsGuard → TenantGuard]
        │ TenantGuard populates CLS: userId / organizationId / organizationMemberId
        ▼
ProjectController  |  TeamController
        │
        ▼
ProjectService  |  ProjectMemberService  |  TeamService  |  TeamMemberService
(business logic — orchestrates repositories, enforces IDOR guard via assertPathMatchesContext)
        │                                     │
        ▼                                     ▼
ProjectRepository        TeamRepository       TeamMemberRepository
ProjectMemberRepository  (extends BaseRepo)   (raw PrismaService — no org FK)
(extend BaseRepository)
        │
        ▼
TenantedPrismaService ($extends auto-injects organizationId + deletedAt:null)
        │
        ▼
PrismaService → PostgreSQL

[OrganizationPort interface + DI token]
   src/contracts/organization/
        ▲
        │ consumes
Phases 8, 9 (downstream domains)

OrganizationModule provides ORGANIZATION_PORT → OrganizationPortAdapter
        │ uses raw PrismaService (never scoped client) + explicit org validation
```

### Recommended Project Structure

```
packages/backend/src/
├── contracts/
│   └── organization/
│       ├── index.ts                    # barrel re-export
│       ├── organization.port.ts        # interface OrganizationPort + DI token Symbol
│       └── organization-summary.dto.ts # OrganizationSummaryDto, ProjectSummaryDto (read-only)
├── project/
│   ├── api/
│   │   └── dto/
│   │       ├── create-project.dto.ts
│   │       ├── update-project.dto.ts
│   │       ├── project-response.dto.ts
│   │       ├── add-project-member.dto.ts
│   │       └── project-member-response.dto.ts
│   │   └── project.controller.ts
│   ├── application/
│   │   ├── project.service.ts
│   │   ├── project.service.spec.ts
│   │   ├── project-member.service.ts
│   │   └── project-member.service.spec.ts
│   ├── persistence/
│   │   ├── project.repository.ts
│   │   └── project-member.repository.ts
│   ├── project-error-codes.ts
│   └── project.module.ts
├── team/
│   ├── api/
│   │   └── dto/
│   │       ├── create-team.dto.ts
│   │       ├── update-team.dto.ts
│   │       ├── team-response.dto.ts
│   │       ├── add-team-member.dto.ts
│   │       └── team-member-response.dto.ts
│   │   └── team.controller.ts
│   ├── application/
│   │   ├── team.service.ts
│   │   ├── team.service.spec.ts
│   │   ├── team-member.service.ts
│   │   └── team-member.service.spec.ts
│   ├── persistence/
│   │   ├── team.repository.ts
│   │   └── team-member.repository.ts
│   ├── team-error-codes.ts
│   └── team.module.ts
└── organization/
    ├── application/
    │   └── organization-port.adapter.ts   # NEW: implements OrganizationPort
    └── organization.module.ts             # UPDATED: provides ORGANIZATION_PORT token
```

### Pattern 1: Scoped Repository (Project, ProjectMember, Team)

These models have a direct `organizationId` FK and are pre-listed in `ORG_SCOPED_MODELS` in `TenantedPrismaService`.

**`project` and `projectMember` verified in `ORG_SCOPED_MODELS`:** [VERIFIED: `packages/backend/src/tenancy/tenanted-prisma.service.ts` line 31–39]

```typescript
// Source: packages/backend/src/organization/persistence/member.repository.ts
@Injectable()
export class ProjectRepository extends BaseRepository {
  constructor(
    scopedPrisma: TenantedPrismaService,
    cls: ClsService,
  ) {
    super(scopedPrisma, cls);
  }

  findMany(): Promise<Project[]> {
    // auto-scoped: organizationId + deletedAt:null injected by TenantedPrismaService
    return this.scopedPrisma.client.project.findMany();
  }

  findById(id: string): Promise<Project | null> {
    // MUST use findFirst (not findUnique) for org-scoped lookups
    return this.scopedPrisma.client.project.findFirst({ where: { id } });
  }
}
```

**Critical:** Use `findFirst` (not `findUnique`) for single-row lookups. The scoped client cannot inject `organizationId` into a `findUnique.where` clause because Prisma enforces unique-constraint field typing. [VERIFIED: `base-repository.ts` comment, line 11]

### Pattern 2: Upsert for Re-add (ProjectMember, TeamMember)

Re-add (reactivation) uses raw `PrismaService` — the `$extends` where-injection conflicts with upsert's unique-key argument. [VERIFIED: `base-repository.ts` line 24, RESEARCH A3]

```typescript
// Source: packages/backend/src/organization/persistence/member.repository.ts (upsertMember)
upsertProjectMember(
  organizationId: string,
  projectId: string,
  organizationMemberId: string,
  roleName: string | null,
  actorUserId: string,
): Promise<ProjectMember> {
  return this.prisma.projectMember.upsert({
    where: { projectId_organizationMemberId: { projectId, organizationMemberId } },
    create: {
      organizationId,
      projectId,
      organizationMemberId,
      status: 'ACTIVE',
      roleName,
      joinedAt: new Date(),
      createdBy: actorUserId,
    },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      joinedAt: new Date(),
      roleName,
      updatedBy: actorUserId,
    },
  });
}
```

### Pattern 3: TeamMember — Manual Org-Scoping (CRITICAL)

`teamMember` is NOT in `ORG_SCOPED_MODELS` because it has no direct `organizationId` FK. [VERIFIED: `tenanted-prisma.service.ts` lines 31–39 — `teamMember` absent from set]

TeamMember repositories MUST use raw `PrismaService` with explicit org filtering through the `team` relation:

```typescript
// TeamMemberRepository uses raw PrismaService — no auto-scoping available
@Injectable()
export class TeamMemberRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private getOrgId(): string {
    const orgId = this.cls.get<string>('organizationId');
    if (!orgId) throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT, message: 'No active organization context.' });
    return orgId;
  }

  findManyByTeam(teamId: string): Promise<TeamMember[]> {
    const organizationId = this.getOrgId();
    return this.prisma.teamMember.findMany({
      where: {
        teamId,
        deletedAt: null,
        team: { organizationId, deletedAt: null },  // explicit org isolation
      },
    });
  }

  upsertMember(teamId: string, organizationMemberId: string, actorUserId: string): Promise<TeamMember> {
    // upsert uses raw client — same RESEARCH A3 reason as MemberRepository
    return this.prisma.teamMember.upsert({
      where: { teamId_organizationMemberId: { teamId, organizationMemberId } },
      create: { teamId, organizationMemberId, joinedAt: new Date(), createdBy: actorUserId },
      update: { deletedAt: null, joinedAt: new Date(), updatedBy: actorUserId },
    });
  }
}
```

Note: `TeamMember` has `onDelete: Cascade` (not Restrict). A hard-delete of `Team` would cascade-delete its members. However, since Team uses soft-delete (setting `deletedAt`), the cascade never fires in practice.

### Pattern 4: Atomic Creator-Add Transaction (PROJ-01, D-08)

Project creation and creator ProjectMember insertion must be atomic. The `$extends` client DOES NOT propagate into Prisma interactive transactions (RESEARCH A2). Use raw `PrismaService.$transaction`:

```typescript
// Source: packages/backend/src/organization/application/organization.service.ts (createOrganization)
async createProject(actorUserId: string, organizationId: string, orgMemberId: string, dto: CreateProjectDto): Promise<Project> {
  return this.prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId,
        name: dto.name,
        key: dto.key,
        description: dto.description ?? null,
        status: 'ACTIVE',
        createdBy: actorUserId,
      },
    });
    await tx.projectMember.create({
      data: {
        organizationId,
        projectId: project.id,
        organizationMemberId: orgMemberId,
        status: 'ACTIVE',
        roleName: 'OWNER',
        joinedAt: new Date(),
        createdBy: actorUserId,
      },
    });
    return project;
  });
}
```

### Pattern 5: IDOR Prevention (assertPathMatchesContext)

Every controller route with an org-id path param must verify it against the CLS `organizationId`. [VERIFIED: `member.service.ts` lines 107–115]

```typescript
// Source: packages/backend/src/organization/application/member.service.ts
private assertPathMatchesContext(orgId: string): string {
  const organizationId = this.ctx.getOrganizationId();
  if (orgId !== organizationId) {
    throw new ForbiddenException({
      errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
      message: 'Access denied.',
    });
  }
  return organizationId;
}
```

All project/team service methods that accept an `organizationId` path param call this first.

### Pattern 6: Error Catalog

```typescript
// Source: packages/backend/src/tenancy/tenancy-error-codes.ts (model)
import { createErrorCatalog } from '../common/error-catalog/create-error-catalog';

export const PROJECT_ERROR_CODES = createErrorCatalog('PROJECT', [
  'KEY_DUPLICATE',           // project key already exists in org (P2002 also caught by PrismaExceptionFilter)
  'KEY_INVALID_FORMAT',      // regex validation failure
  'MEMBER_NOT_ORG_MEMBER',   // target orgMemberId is not ACTIVE in the org
  'MEMBER_ALREADY_ADDED',    // note: upsert reactivates, so this may never fire; keep for explicit guard
  'ACCESS_DENIED',           // path/header mismatch
] as const);

export const TEAM_ERROR_CODES = createErrorCatalog('TEAM', [
  'NAME_DUPLICATE',          // team name already exists in org (P2002)
  'MEMBER_NOT_ORG_MEMBER',   // target orgMemberId is not ACTIVE in the org
  'ACCESS_DENIED',
] as const);
```

Note: `PrismaExceptionFilter` already maps `P2002` → 409 `PLATFORM.RESOURCE_CONFLICT`. For project key and team name collisions, the generic Prisma filter will catch the unique constraint violation. Domain-specific `KEY_DUPLICATE` / `NAME_DUPLICATE` codes are for application-layer explicit checks (e.g. before the DB call), but if they slip through to Prisma, the filter catches them with a consistent envelope.

### Pattern 7: OrganizationPort Contract

```typescript
// packages/backend/src/contracts/organization/organization.port.ts
export const ORGANIZATION_PORT = Symbol('ORGANIZATION_PORT');

export interface OrganizationSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
}

export interface ProjectSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly status: string;
  readonly organizationId: string;
}

export interface OrganizationPort {
  getOrganizationSummary(orgId: string): Promise<OrganizationSummaryDto | null>;
  getProjectSummary(projectId: string): Promise<ProjectSummaryDto | null>;
  isActiveMember(orgId: string, userId: string): Promise<boolean>;
}
```

The implementation adapter in `OrganizationModule`:

```typescript
// packages/backend/src/organization/application/organization-port.adapter.ts
@Injectable()
export class OrganizationPortAdapter implements OrganizationPort {
  constructor(private readonly prisma: PrismaService) {}
  // Uses raw PrismaService (never scoped) — port is cross-org safe
  // Explicit null returns = not found; no throws
}
```

OrganizationModule registers the binding:

```typescript
// Updated organization.module.ts provider list:
{ provide: ORGANIZATION_PORT, useClass: OrganizationPortAdapter }
// and exports it:
exports: [..., ORGANIZATION_PORT]
```

Consuming modules inject by token:
```typescript
constructor(@Inject(ORGANIZATION_PORT) private readonly orgPort: OrganizationPort) {}
```

### Pattern 8: Module Registration

```typescript
// src/project/project.module.ts
@Module({
  imports: [TenancyModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectMemberService, ProjectRepository, ProjectMemberRepository],
})
export class ProjectModule {}
```

Register in `app.module.ts` alongside `OrganizationModule`:
```typescript
imports: [..., OrganizationModule, ProjectModule, TeamModule]
```

### Pattern 9: Paginated List Endpoints

All list endpoints use `CursorPaginationDto` (query params) and return `PaginatedResult<T>`. [VERIFIED: `packages/backend/src/common/pagination/`]

```typescript
@Get('/')
@RequirePermissions('project:read')
async listProjects(@Param('orgId') orgId: string, @Query() query: CursorPaginationDto): Promise<PaginatedResult<ProjectResponseDto>> {
  const { data, meta } = await this.projectService.listProjects(orgId, query);
  return { data: data.map(ProjectResponseDto.from), meta };
}
```

### Anti-Patterns to Avoid

- **`findUnique` on scoped models:** The auto-scoping extension cannot inject `organizationId` into `findUnique.where`. Always use `findFirst` for single-row org-scoped lookups.
- **`scopedPrisma.client` for upsert:** The extension's where-injection conflicts with upsert's unique-key argument. Always use raw `PrismaService` for upsert operations.
- **`scopedPrisma.client` for TeamMember:** `teamMember` is not in `ORG_SCOPED_MODELS`. Using it on TeamMember passes through UNSCOPED — a silent full-table cross-tenant read.
- **Domain imports in `contracts/`:** The contracts directory must depend on nothing. Importing a domain's service, repository, or entity type breaks the extraction boundary.
- **`include`/`select` scoped relations through scoped client:** The `$extends` hook only rewrites the top-level `where`. Nested relations bypass org-scoping (WR-06 note in `base-repository.ts`).
- **`TenantedPrismaService` in OrganizationPort adapter:** The port may be called by future cross-org consumers (Phase 8/9). Using the scoped client would fail-closed with NO_ORG_CONTEXT. Use raw `PrismaService` with explicit validation.
- **Business logic in controllers:** All orchestration lives in service layer. Controllers call services and map to DTOs only.
- **Exposing soft-delete metadata in response DTOs:** `deletedAt`, `deletedBy`, `updatedBy` must never appear in API response shapes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-scoped find queries (Project, Team, ProjectMember) | Custom org-id injection | `TenantedPrismaService.client.<model>.findFirst/findMany` | Auto-injects `organizationId + deletedAt:null`; fail-closed when no CLS context |
| Re-add / reactivation semantics | Custom "check if exists then create-or-update" | `PrismaService.upsert` with `@@unique` constraint | Atomic; handles concurrent re-add race |
| Request validation | Custom validator classes | `class-validator` decorators on DTOs + global `ValidationPipe` | Already wired globally; whitelist + forbidNonWhitelisted |
| Error envelope formatting | Custom error response shaping | `GlobalExceptionFilter` + domain `createErrorCatalog` | Already registered globally; `{ success, errorCode, message, traceId }` |
| Prisma unique-constraint errors → 409 | Manual P2002 catch blocks | `PrismaExceptionFilter` (already registered globally) | Already maps P2002 → 409 RESOURCE_CONFLICT |
| Tenant context reads | Calling CLS directly in controllers | `TenantContextService.getOrganizationId()` / `.getUserId()` | Type-safe accessor; consistent null semantics |
| Paginated list response shape | Custom pagination wrappers | `CursorPaginationDto` + `PaginatedResult<T>` | Already standardized in SEAM-06 |
| Port DI binding | Service locator pattern | NestJS `@Inject(ORGANIZATION_PORT)` + `provide: ORGANIZATION_PORT` | Type-safe; extraction-ready |

**Key insight:** The entire infrastructure layer — validation, error envelopes, scoping, CLS, pagination — is already wired. Phase 7 writes domain logic on top; it does not re-invent any plumbing.

---

## Common Pitfalls

### Pitfall 1: Using `findUnique` with Scoped Client

**What goes wrong:** A `ProjectRepository` calls `scopedPrisma.client.project.findUnique({ where: { id } })`. At runtime, the extension tries to inject `organizationId` into the `where`, but Prisma's TypeScript types reject non-unique-constraint fields in `findUnique.where`. In strict TypeScript mode this is a compile error; at JS runtime the injection silently fails or throws.

**Why it happens:** The `$extends` hook modifies `args.where` regardless of operation, but `UNIQUE_OPERATIONS` set in `TenantedPrismaService` was added specifically to prevent this.

**How to avoid:** Use `findFirst` for all single-row org-scoped lookups without exception. [VERIFIED: `base-repository.ts` line 11 warning]

---

### Pitfall 2: Calling `scopedPrisma.client.teamMember.*` in TeamMemberRepository

**What goes wrong:** `teamMember` is absent from `ORG_SCOPED_MODELS`. The extension passes `teamMember` queries through UNSCOPED — a full cross-tenant read with no error and no `organizationId` or `deletedAt:null` filter.

**Why it happens:** `ORG_SCOPED_MODELS` is an explicit allowlist. Models not listed are intentionally not scoped (many future models are in the schema but not yet wired). `TeamMember` has no direct `organizationId` FK, so it cannot be added to the set.

**How to avoid:** `TeamMemberRepository` must use raw `PrismaService` with an explicit `team: { organizationId, deletedAt: null }` nested filter on every query. [VERIFIED: `tenanted-prisma.service.ts` lines 31–39]

---

### Pitfall 3: `$extends` Not Propagating into Interactive Transactions

**What goes wrong:** `ProjectService.createProject` uses `scopedPrisma.client.$transaction(async tx => ...)`. The `tx` inside is the raw Prisma client, not the extended one. Queries inside the transaction bypass org-scoping — but also bypass the fail-closed NO_ORG_CONTEXT guard.

**Why it happens:** Prisma `$extends` applies at the client level, not at the transaction level. Interactive transactions receive a raw `Prisma.TransactionClient`. [VERIFIED: RESEARCH A2 note in `base-repository.ts` line 24]

**How to avoid:** Use raw `PrismaService.$transaction(async tx => ...)` and explicitly scope all writes inside the transaction (always include `organizationId` in `create.data` and `where` clauses). This is exactly what `OrganizationService.createOrganization` does. [VERIFIED: `organization.service.ts` line 47–60]

---

### Pitfall 4: Importing Domain Internals into `src/contracts/`

**What goes wrong:** `organization.port.ts` imports `Project` from `@repo/database` or `OrganizationService` from the organization module. Phase 9's scaffolding agent copies `contracts/<domain>/` as a pure boundary template, but the import creates a circular dependency or violates the extraction contract.

**Why it happens:** It's tempting to reuse existing Prisma types in the DTO shapes.

**How to avoid:** Summary DTOs in `contracts/organization/` declare their own plain TypeScript interfaces with only client-safe fields (`id`, `name`, `key`, `status`, `organizationId`). They import nothing from any domain module or `@repo/database`. [VERIFIED: CONTEXT.md D-11, D-13]

---

### Pitfall 5: Forgetting `assertPathMatchesContext` on Project/Team Routes

**What goes wrong:** A route handler accepts `:organizationId` in the URL but doesn't verify it matches the CLS `organizationId`. A client with valid membership in org-A can craft a request with X-Organization-Id=orgA and `/:orgB/projects` path to read another org's projects.

**Why it happens:** The `TenantGuard` validates membership for the org in the header, but doesn't enforce that the URL path org matches.

**How to avoid:** Every service method that accepts an org path param must call `this.assertPathMatchesContext(orgId)` first. This is the `MemberService` pattern. [VERIFIED: `member.service.ts` line 107–115]

---

### Pitfall 6: `organizationMemberId` Validation Before Add

**What goes wrong:** `ProjectMemberService.addMember` receives an `organizationMemberId` and calls upsert without verifying the member is ACTIVE in the current org. A stale or cross-org `organizationMemberId` gets silently written.

**Why it happens:** upsert succeeds if the FK constraint passes; Prisma won't check member status.

**How to avoid:** Before upsert, query `scopedPrisma.client.organizationMember.findFirst({ where: { id: organizationMemberId, status: 'ACTIVE' } })`. Because `organizationMember` IS in `ORG_SCOPED_MODELS`, this query auto-scopes to the current org AND filters `deletedAt:null`. If null → throw `PROJECT_ERROR_CODES.MEMBER_NOT_ORG_MEMBER` NotFoundException. [VERIFIED: Phase 6 D-13 requirement + `tenanted-prisma.service.ts` ORG_SCOPED_MODELS list]

---

## Code Examples

### Project Key Validation

```typescript
// Recommended: JIRA-style, 2–10 uppercase chars, starts with letter
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/, {
    message: 'key must be 2–10 uppercase letters/digits starting with a letter (e.g. PLAT, PROJ1)',
  })
  key!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
```

### ProjectResponseDto (no soft-delete fields)

```typescript
// Source pattern: packages/backend/src/organization/api/dto/organization-response.dto.ts
import { Project } from '@repo/database';

export class ProjectResponseDto {
  id!: string;
  organizationId!: string;
  name!: string;
  key!: string;
  description!: string | null;
  status!: string;
  createdAt!: Date;
  createdBy!: string | null;

  static from(p: Project): ProjectResponseDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      key: p.key,
      description: p.description,
      status: p.status,
      createdAt: p.createdAt,
      createdBy: p.createdBy,
    };
  }
}
```

### OrganizationPortAdapter (raw PrismaService, explicit validation)

```typescript
// packages/backend/src/organization/application/organization-port.adapter.ts
@Injectable()
export class OrganizationPortAdapter implements OrganizationPort {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationSummary(orgId: string): Promise<OrganizationSummaryDto | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId, deletedAt: null },
      select: { id: true, name: true, slug: true, status: true },
    });
    if (!org) return null;
    return { id: org.id, name: org.name, slug: org.slug, status: org.status };
  }

  async getProjectSummary(projectId: string): Promise<ProjectSummaryDto | null> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true, key: true, status: true, organizationId: true },
    });
    if (!p) return null;
    return { id: p.id, name: p.name, key: p.key, status: p.status, organizationId: p.organizationId };
  }

  async isActiveMember(orgId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId: orgId, userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return member !== null;
  }
}
```

**Note:** `getProjectSummary` uses raw `PrismaService.project.findUnique` (not scoped). This is safe and intentional — the port may be called by cross-org consumers. Explicit `deletedAt: null` prevents soft-deleted projects from surfacing. The Organization `findUnique` on `id` is also unscoped (Organization has no org FK — same reasoning as `OrganizationRepository`). [VERIFIED: `organization.repository.ts` pattern]

### Service Unit Test Pattern

```typescript
// Source: packages/backend/src/organization/application/member.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './project.service';

const mockProjectRepo = { findMany: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), softDelete: vi.fn() };
const mockProjectMemberRepo = { upsertMember: vi.fn(), findManyByProject: vi.fn(), softRemove: vi.fn() };
const mockPrisma = {
  organizationMember: { findFirst: vi.fn() },
  $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
};
const mockCtx = {
  getOrganizationId: vi.fn().mockReturnValue('org-123'),
  getUserId: vi.fn().mockReturnValue('user-abc'),
  getOrganizationMemberId: vi.fn().mockReturnValue('orgmember-xyz'),
};
```

---

## State of the Art

| Old Approach | Current Approach (Phase 7) | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| Cross-domain service imports | `contracts/<domain>/` port + DI token | Phase 7 (introduced here) | Enables future microservice extraction without rewriting consumers |
| Per-query `organizationId` discipline | `TenantedPrismaService` + `ORG_SCOPED_MODELS` allowlist | Phase 6 | Eliminates per-developer manual scoping; fail-closed by default |
| Direct Prisma entity in API responses | DTO `from()` static mapping | Phase 6 | Prevents internal field leakage; explicit allowlist |

**Deprecated/outdated:**
- Using `findUnique` for scoped model lookups — replaced by `findFirst` with explicit `where: { id }` clause (see Pitfall 1).
- Passing Prisma entities across module boundaries — the port pattern establishes summary-DTO-only cross-boundary sharing.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Creator `roleName` value `OWNER` (D-08 implementation detail) | Pattern 4, Code Examples | If a downstream phase expects a different value, a data migration or code update is needed. Low risk — `roleName` is a free-form label with no enforcement. |
| A2 | Teams should use `organization:read`/`organization:manage` permission codes (not new `team:read`/`team:manage`) | Standard Stack, routes | If RBAC is provisioned per-team later, team-specific permissions will be needed; using org-level codes is a temporary measure consistent with D-05's membership-based authorization. |
| A3 | `ProjectMember` and `TeamMember` soft-remove sets `status='REMOVED'` + `deletedAt` (matching OrganizationMember pattern) | Architecture Patterns | Schema defines `ProjectMemberStatus.REMOVED`; confirmed from schema read. [VERIFIED: schema] |

---

## Open Questions

1. **TeamMemberRepository org-scoping strategy**
   - What we know: `teamMember` has no `organizationId` FK; auto-scoping via TenantedPrismaService is impossible.
   - What's unclear: whether to filter via `team: { organizationId }` nested where OR scope via a prior lookup of the team's ID after confirming team ownership.
   - Recommendation: Use nested `team: { organizationId, deletedAt: null }` in every TeamMember query. This is a single-query solution and mirrors how the scoped client would work if the FK existed. The planner should explicitly call this out in TeamMemberRepository tasks.

2. **OrganizationPort `isActiveMember` signature**
   - What we know: CONTEXT.md D-13 says "a membership check that downstream authorization will need." The exact parameters are unspecified.
   - What's unclear: Whether the check needs `orgId + userId`, or `orgId + organizationMemberId`, or both.
   - Recommendation: Implement `isActiveMember(orgId: string, userId: string): Promise<boolean>` (lookup by userId since downstream consumers will have user context, not necessarily the org-member internal ID). This matches how TenantGuard performs the membership check.

3. **`ORG_SCOPED_MODELS` update for `teamMember`**
   - What we know: Adding `teamMember` to the set would require adding a direct `organizationId` FK to `TeamMember`, which is a schema change. Schema is frozen.
   - What's unclear: Whether a CI guardrail comment/annotation should be added to `tenanted-prisma.service.ts` noting that `teamMember` is intentionally absent.
   - Recommendation: Add an inline comment to `ORG_SCOPED_MODELS` noting `teamMember` is absent by design (no `organizationId` FK). The planner should include this as a code comment task.

---

## Environment Availability

> Step 2.6: No new external dependencies introduced. Phase 7 is code/config only — no new tools, services, or runtimes required beyond what Phase 6 established.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Prisma ORM | ✓ (from prior phases) | — | — |
| Node.js + npm | Build/test | ✓ (from prior phases) | Node 22+ | — |
| Vitest + SWC | Unit tests | ✓ [VERIFIED: vitest.config.ts] | — | — |

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 + unplugin-swc |
| Config file | `packages/backend/vitest.config.ts` |
| Quick run command | `npm run test --workspace=packages/backend -- --run --reporter=verbose` |
| Full suite command | `npm run test --workspace=packages/backend -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | `ProjectService.createProject` creates project + auto-adds creator as ACTIVE ProjectMember atomically | unit | `... -- --run src/project/application/project.service.spec.ts` | ❌ Wave 0 |
| PROJ-01 | Duplicate `key` in org → `PROJECT.KEY_DUPLICATE` or 409 | unit | `... -- --run src/project/application/project.service.spec.ts` | ❌ Wave 0 |
| PROJ-01 | Invalid `key` format → 400 validation error | unit (DTO) | `... -- --run src/project/` | ❌ Wave 0 |
| PROJ-02 | `ProjectService.listProjects` returns all org projects (pure org-scoping, no member gate) | unit | `... -- --run src/project/application/project.service.spec.ts` | ❌ Wave 0 |
| PROJ-02 | `ProjectService.findById` path/CLS mismatch → `ORG_ACCESS_DENIED` | unit | `... -- --run src/project/application/project.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `ProjectMemberService.addMember` validates ACTIVE org membership before upsert | unit | `... -- --run src/project/application/project-member.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `ProjectMemberService.addMember` re-add reactivates existing member (upsert path) | unit | `... -- --run src/project/application/project-member.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `ProjectMemberService.removeMember` soft-deletes (status=REMOVED, deletedAt set) | unit | `... -- --run src/project/application/project-member.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `TeamService.createTeam` creates org-scoped team | unit | `... -- --run src/team/application/team.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `TeamService.softDeleteTeam` sets deletedAt + deletedBy | unit | `... -- --run src/team/application/team.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `TeamMemberService.addMember` validates ACTIVE org membership + upsert | unit | `... -- --run src/team/application/team-member.service.spec.ts` | ❌ Wave 0 |
| PROJ-03 | `TeamMemberService.addMember` re-add reactivates (upsert path, explicit org scope) | unit | `... -- --run src/team/application/team-member.service.spec.ts` | ❌ Wave 0 |
| PROJ-04 | `OrganizationPortAdapter.getProjectSummary` returns lean DTO (no Prisma entity, no soft-delete fields) | unit | `... -- --run src/organization/application/organization-port.adapter.spec.ts` | ❌ Wave 0 |
| PROJ-04 | `OrganizationPortAdapter.getOrganizationSummary` returns null when org not found | unit | `... -- --run src/organization/application/organization-port.adapter.spec.ts` | ❌ Wave 0 |
| PROJ-04 | `OrganizationPortAdapter.isActiveMember` returns false for non-member / inactive member | unit | `... -- --run src/organization/application/organization-port.adapter.spec.ts` | ❌ Wave 0 |
| PROJ-01..04 | Full module wires into AppModule (compilation smoke test) | smoke | `npm run build --workspace=packages/backend` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test --workspace=packages/backend -- --run --reporter=verbose <spec-file>`
- **Per wave merge:** `npm run test --workspace=packages/backend -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/project/application/project.service.spec.ts` — covers PROJ-01, PROJ-02
- [ ] `src/project/application/project-member.service.spec.ts` — covers PROJ-03 ProjectMember
- [ ] `src/team/application/team.service.spec.ts` — covers PROJ-03 Team CRUD
- [ ] `src/team/application/team-member.service.spec.ts` — covers PROJ-03 TeamMember lifecycle
- [ ] `src/organization/application/organization-port.adapter.spec.ts` — covers PROJ-04
- [ ] `src/project/project-error-codes.ts` — error constants file
- [ ] `src/team/team-error-codes.ts` — error constants file
- [ ] `src/contracts/organization/organization.port.ts` — port interface + token + DTOs
- [ ] `src/contracts/organization/index.ts` — barrel export

---

## Security Domain

> `security_enforcement` is not set to false in config — this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (auth handled by Phase 4 JwtAuthGuard; all endpoints are tenant-scoped) | JwtAuthGuard (global) |
| V3 Session Management | No | Handled by Phase 4 |
| V4 Access Control | Yes — IDOR prevention, org membership enforcement | `assertPathMatchesContext` + `TenantGuard` + `ORG_SCOPED_MODELS` auto-filter |
| V5 Input Validation | Yes — project key format, DTO fields | `class-validator` decorators + global `ValidationPipe` (whitelist + forbidNonWhitelisted) |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for NestJS + Prisma Multi-Tenant Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via mismatched path param / org header | Elevation of Privilege | `assertPathMatchesContext(orgId)` in every service method; path must match CLS org |
| Cross-tenant data read (TeamMember scoping gap) | Information Disclosure | Raw `PrismaService` with explicit `team: { organizationId }` nested filter in TeamMemberRepository |
| Port DTO leaking Prisma entity fields (deletedAt, deletedBy, updatedBy) | Information Disclosure | Explicit `static from()` mapping in response DTOs; summary DTOs expose only public fields |
| `contracts/` importing domain internals creating implicit coupling | Tampering (extraction boundary) | No imports from domain modules in `src/contracts/`; plain TypeScript interfaces only |
| Upsert without org-membership validation | Elevation of Privilege | Verify `organizationMember.status = 'ACTIVE'` via scoped client before upsert |
| Mass-assignment via unknown DTO fields | Tampering | Global `ValidationPipe(whitelist: true, forbidNonWhitelisted: true)` [VERIFIED: app.module.ts line 113] |

---

## Sources

### Primary (HIGH confidence — verified against live codebase)

- `packages/backend/src/tenancy/tenanted-prisma.service.ts` — `ORG_SCOPED_MODELS` set, fail-closed D-08 logic, WR-05/WR-06 notes
- `packages/backend/src/tenancy/base-repository.ts` — RESEARCH A2/A3 notes, `findFirst` requirement, `getSoftDeleteData()`
- `packages/backend/src/organization/` (all files) — Phase 6 reference implementation: controller, services, repositories, DTOs, specs, module
- `packages/database/prisma/schema/organization.prisma` — frozen schema: Project, ProjectMember, Team, TeamMember, OrganizationMember exact fields and constraints
- `packages/database/prisma/seed.ts` — seeded permission codes (`project:read`, `project:manage`)
- `packages/backend/src/common/error-catalog/create-error-catalog.ts` — error catalog factory
- `packages/backend/src/common/pagination/` — `CursorPaginationDto`, `PaginatedResult<T>`
- `packages/backend/src/common/exceptions/` — `GlobalExceptionFilter`, `PrismaExceptionFilter`, error envelope shape
- `packages/backend/vitest.config.ts` — test runner setup

### Secondary (MEDIUM confidence — from CONTEXT.md and discussion log)

- `.planning/phases/07-project-foundation/07-CONTEXT.md` — all 13 implementation decisions D-01…D-13
- `.planning/phases/07-project-foundation/07-DISCUSSION-LOG.md` — alternatives considered for team semantics, port location, project key handling

### Tertiary (LOW confidence — documentation and requirements)

- `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-II-Business-Domains.md` — confirms Organization/Project/Team as parallel org-level entities, not nested
- `Enterprise-AI-Delivery-Platform-Documentation/06-Module-Specifications/Module-Specifications.md` — cross-module workflow; "avoid direct database access to other modules"
- `.planning/REQUIREMENTS.md` — PROJ-01…PROJ-04 authoritative requirement text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in codebase; no new packages
- Architecture: HIGH — Phase 6 reference implementation verified in full; all patterns extracted from live code
- Pitfalls: HIGH — most pitfalls verified via explicit codebase comments (WR-05, WR-06, RESEARCH A2, A3) and schema analysis
- Port pattern: MEDIUM — interface/token/DI pattern is well-established NestJS; specific file layout derived from CONTEXT.md D-11/D-12/D-13

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (stable — no new packages; frozen schema; Phase 8 follow-on is the main invalidation trigger)
