# Phase 7: Project Foundation - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 34 (new or modified)
**Analogs found:** 30 / 34 (4 greenfield — `contracts/organization/` directory)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/contracts/organization/organization.port.ts` | port-interface | N/A (pure TS) | — | greenfield |
| `src/contracts/organization/organization-summary.dto.ts` | dto | N/A (pure TS) | — | greenfield |
| `src/contracts/organization/index.ts` | barrel | N/A | — | greenfield |
| `src/project/project-error-codes.ts` | config/utility | N/A | `src/tenancy/tenancy-error-codes.ts` | exact |
| `src/project/api/dto/create-project.dto.ts` | dto | request-response | `src/organization/api/dto/create-organization.dto.ts` | exact |
| `src/project/api/dto/update-project.dto.ts` | dto | request-response | `src/organization/api/dto/create-organization.dto.ts` | role-match |
| `src/project/api/dto/project-response.dto.ts` | dto | request-response | `src/organization/api/dto/organization-response.dto.ts` | exact |
| `src/project/api/dto/add-project-member.dto.ts` | dto | request-response | `src/organization/api/dto/add-member.dto.ts` | exact |
| `src/project/api/dto/project-member-response.dto.ts` | dto | request-response | `src/organization/api/dto/member-response.dto.ts` | exact |
| `src/project/api/project.controller.ts` | controller | request-response | `src/organization/api/organization.controller.ts` | exact |
| `src/project/application/project.service.ts` | service | CRUD | `src/organization/application/organization.service.ts` | exact |
| `src/project/application/project.service.spec.ts` | test | CRUD | `src/organization/application/organization.service.spec.ts` | exact |
| `src/project/application/project-member.service.ts` | service | CRUD | `src/organization/application/member.service.ts` | exact |
| `src/project/application/project-member.service.spec.ts` | test | CRUD | `src/organization/application/member.service.spec.ts` | exact |
| `src/project/persistence/project.repository.ts` | repository | CRUD | `src/organization/persistence/member.repository.ts` | exact |
| `src/project/persistence/project-member.repository.ts` | repository | CRUD + upsert | `src/organization/persistence/member.repository.ts` | exact |
| `src/project/project.module.ts` | module | N/A | `src/organization/organization.module.ts` | exact |
| `src/team/team-error-codes.ts` | config/utility | N/A | `src/tenancy/tenancy-error-codes.ts` | exact |
| `src/team/api/dto/create-team.dto.ts` | dto | request-response | `src/organization/api/dto/create-organization.dto.ts` | exact |
| `src/team/api/dto/update-team.dto.ts` | dto | request-response | `src/organization/api/dto/create-organization.dto.ts` | role-match |
| `src/team/api/dto/team-response.dto.ts` | dto | request-response | `src/organization/api/dto/organization-response.dto.ts` | exact |
| `src/team/api/dto/add-team-member.dto.ts` | dto | request-response | `src/organization/api/dto/add-member.dto.ts` | role-match |
| `src/team/api/dto/team-member-response.dto.ts` | dto | request-response | `src/organization/api/dto/member-response.dto.ts` | exact |
| `src/team/api/team.controller.ts` | controller | request-response | `src/organization/api/organization.controller.ts` | exact |
| `src/team/application/team.service.ts` | service | CRUD | `src/organization/application/organization.service.ts` | exact |
| `src/team/application/team.service.spec.ts` | test | CRUD | `src/organization/application/organization.service.spec.ts` | exact |
| `src/team/application/team-member.service.ts` | service | CRUD | `src/organization/application/member.service.ts` | exact |
| `src/team/application/team-member.service.spec.ts` | test | CRUD | `src/organization/application/member.service.spec.ts` | exact |
| `src/team/persistence/team.repository.ts` | repository | CRUD | `src/organization/persistence/member.repository.ts` | exact |
| `src/team/persistence/team-member.repository.ts` | repository | CRUD (raw Prisma) | `src/organization/persistence/organization.repository.ts` | role-match |
| `src/team/team.module.ts` | module | N/A | `src/organization/organization.module.ts` | exact |
| `src/organization/application/organization-port.adapter.ts` | service/adapter | request-response | `src/organization/persistence/organization.repository.ts` | partial |
| `src/organization/organization.module.ts` | module | N/A (UPDATED) | `src/organization/organization.module.ts` | self |
| `src/app.module.ts` | config | N/A (UPDATED) | `src/app.module.ts` | self |

---

## Pattern Assignments

### `src/project/project-error-codes.ts` (config/utility)

**Analog:** `src/tenancy/tenancy-error-codes.ts`

**Full file pattern** (lines 1–9):
```typescript
import { createErrorCatalog } from '../common/error-catalog/create-error-catalog';

export const TENANT_ERROR_CODES = createErrorCatalog('TENANT', [
  'MISSING_ORG_HEADER',
  'ORG_ACCESS_DENIED',
  'NO_ORG_CONTEXT',
  'USER_NOT_FOUND',
  'LAST_MEMBER_REMOVAL',
] as const);
```

**Apply:** Use `createErrorCatalog('PROJECT', [...])`. Codes needed per RESEARCH.md Pattern 6:
`KEY_DUPLICATE`, `KEY_INVALID_FORMAT`, `MEMBER_NOT_ORG_MEMBER`, `ACCESS_DENIED`.

---

### `src/team/team-error-codes.ts` (config/utility)

**Analog:** `src/tenancy/tenancy-error-codes.ts`

Same factory pattern. Use `createErrorCatalog('TEAM', [...])`. Codes needed:
`NAME_DUPLICATE`, `MEMBER_NOT_ORG_MEMBER`, `ACCESS_DENIED`.

---

### `src/project/api/dto/create-project.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/create-organization.dto.ts`

**Full file pattern** (lines 1–16):
```typescript
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(60)
  slug!: string;
}
```

**Apply:** Add `name` field (same length constraints). Add `key` field using `@Matches(/^[A-Z][A-Z0-9]{1,9}$/, { message: '...' })` (JIRA-style, 2–10 uppercase chars starting with letter). Add `@IsOptional() @IsString() @MaxLength(500) description?` field.

---

### `src/project/api/dto/update-project.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/create-organization.dto.ts` (lines 1–16)

**Apply:** All fields from CreateProjectDto except `key` (key is immutable after creation). Wrap each field with `@IsOptional()`. No `@Matches` on `key` since it is not updatable.

---

### `src/project/api/dto/project-response.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/organization-response.dto.ts`

**Full file pattern** (lines 1–28):
```typescript
import { Organization } from '@repo/database';

export class OrganizationResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: string;
  createdAt!: Date;
  createdBy!: string | null;

  static from(org: Organization): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
      createdBy: org.createdBy,
    };
  }
}
```

**Apply:** Import `Project` from `@repo/database`. Expose: `id`, `organizationId`, `name`, `key`, `description`, `status`, `createdAt`, `createdBy`. Never expose `deletedAt`, `deletedBy`, `updatedBy`, `updatedAt`.

---

### `src/project/api/dto/add-project-member.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/add-member.dto.ts`

**Full file pattern** (lines 1–6):
```typescript
import { IsEmail } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email!: string;
}
```

**Apply:** Use `@IsString() @IsUUID()` on `organizationMemberId` field (D-10: add by `organizationMemberId`, not email). Add `@IsOptional() @IsString() @MaxLength(50) roleName?` field for optional free-form role label.

---

### `src/project/api/dto/project-member-response.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/member-response.dto.ts`

**Full file pattern** (lines 1–28):
```typescript
import { OrganizationMember } from '@repo/database';

export class MemberResponseDto {
  id!: string;
  organizationId!: string;
  userId!: string;
  status!: string;
  joinedAt!: Date | null;
  createdAt!: Date;

  static from(member: OrganizationMember): MemberResponseDto {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      status: member.status,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    };
  }
}
```

**Apply:** Import `ProjectMember` from `@repo/database`. Expose: `id`, `organizationId`, `projectId`, `organizationMemberId`, `roleName`, `status`, `joinedAt`, `createdAt`. Never expose audit columns.

---

### `src/project/api/project.controller.ts` (controller, request-response)

**Analog:** `src/organization/api/organization.controller.ts`

**Imports pattern** (lines 1–11):
```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.type';
import { NoTenantScope } from '../../tenancy/decorators/no-tenant-scope.decorator';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { OrganizationService } from '../application/organization.service';
import { MemberService } from '../application/member.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { MemberResponseDto } from './dto/member-response.dto';
```

**Controller class and route pattern** (lines 26–80):
```typescript
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly memberService: MemberService,
  ) {}

  @Post('/')
  @NoTenantScope()
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @GetCurrentUser() user: CurrentUser,
  ): Promise<OrganizationResponseDto> { ... }

  @Get('/:id')
  @RequirePermissions('organization:read')
  async getOrganization(@Param('id') id: string): Promise<OrganizationResponseDto> { ... }

  @Post('/:id/members')
  @RequirePermissions('organization:manage')
  async addMember(@Param('id') id: string, @Body() dto: AddMemberDto): Promise<MemberResponseDto> { ... }

  @Get('/:id/members')
  @RequirePermissions('organization:read')
  async listMembers(@Param('id') id: string): Promise<MemberResponseDto[]> { ... }

  @Delete('/:id/members/:memberId')
  @RequirePermissions('organization:manage')
  @HttpCode(204)
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) { ... }
}
```

**Apply for ProjectController:**
- `@Controller({ path: 'organizations/:orgId/projects', version: '1' })` — org-scoped resource, NO `@NoTenantScope` routes (projects always require tenant context).
- `@RequirePermissions('project:read')` for GET, `'project:manage'` for POST/PATCH/DELETE.
- No `@NoTenantScope` — all project routes require ACTIVE org membership.
- Add `@Param('orgId') orgId: string` to every handler; delegate to `this.projectService.*(orgId, ...)`.
- List endpoint: `@Get('/') async listProjects(@Param('orgId') orgId, @Query() query: CursorPaginationDto): Promise<PaginatedResult<ProjectResponseDto>>`.
- Member sub-routes: `/:projectId/members` mirroring the `/:id/members` pattern.

---

### `src/project/application/project.service.ts` (service, CRUD)

**Analog:** `src/organization/application/organization.service.ts`

**Imports + constructor pattern** (lines 1–23):
```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, PrismaService } from '@repo/database';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TENANT_ERROR_CODES } from '../../tenancy/tenancy-error-codes';
import { CreateOrganizationDto } from '../api/dto/create-organization.dto';
import { OrganizationRepository } from '../persistence/organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}
```

**Atomic transaction pattern — createOrganization** (lines 47–61):
```typescript
return this.prisma.$transaction(async (tx) => {
  const org = await tx.organization.create({
    data: { name: dto.name, slug: dto.slug, createdBy: user.id },
  });
  await tx.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      status: 'ACTIVE',
      joinedAt: new Date(),
      createdBy: user.id,
    },
  });
  return org;
});
```

**IDOR guard pattern** (lines 88–104):
```typescript
async findById(id: string): Promise<Organization> {
  const ctxOrgId = this.ctx.getOrganizationId();
  if (id !== ctxOrgId) {
    throw new ForbiddenException({
      errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
      message: 'Access denied.',
    });
  }
  const org = await this.orgRepo.findById(id);
  if (!org) {
    throw new NotFoundException({
      errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
      message: 'Organization not found.',
    });
  }
  return org;
}
```

**Apply for ProjectService:**
- Constructor: `(projectRepo, projectMemberRepo, prisma: PrismaService, ctx: TenantContextService)`.
- `createProject(orgId, dto)`: call `assertPathMatchesContext(orgId)`, then `this.prisma.$transaction(async tx => { ... })` creating `project` + `projectMember` (status `ACTIVE`, `roleName: 'OWNER'`, `organizationId` explicit in both creates).
- `findById(orgId, projectId)`: call `assertPathMatchesContext(orgId)`, then `this.projectRepo.findById(projectId)`.
- `listProjects(orgId, query: CursorPaginationDto)`: call `assertPathMatchesContext(orgId)`, then `this.projectRepo.findMany(query)`.
- `updateProject(orgId, projectId, dto)`: call `assertPathMatchesContext(orgId)`, then repo update.
- `softDeleteProject(orgId, projectId)`: call `assertPathMatchesContext(orgId)`, then `this.projectRepo.softDelete(projectId)`.
- Private `assertPathMatchesContext(orgId)` mirrors lines 88–95 (compare `orgId` against `this.ctx.getOrganizationId()`), throw `PROJECT_ERROR_CODES.ACCESS_DENIED`.

---

### `src/project/application/project.service.spec.ts` (test, CRUD)

**Analog:** `src/organization/application/organization.service.spec.ts`

**Mock setup pattern** (lines 1–37):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from './organization.service';

const mockOrgRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByMemberUserId: vi.fn(),
};

const mockTx = {
  organization: { create: vi.fn() },
  organizationMember: { create: vi.fn() },
};

const mockPrisma = {
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

const mockCtx = {
  getOrganizationId: vi.fn(),
  getUserId: vi.fn(),
  getOrganizationMemberId: vi.fn(),
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    service = new OrganizationService(mockOrgRepo as never, mockPrisma as never, mockCtx as never);
  });
```

**Transaction test pattern** (lines 52–68):
```typescript
it('createOrganization — user found → $transaction creates org; organizationMember.create called with status:ACTIVE and Date joinedAt', async () => {
  mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  mockTx.organization.create.mockResolvedValue({ id: 'org-1', name: 'X', slug: 'x' });

  const result = await service.createOrganization('creator@test.com', { name: 'X', slug: 'x' } as never);

  expect(result).toMatchObject({ id: 'org-1' });
  expect(mockTx.organizationMember.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', status: 'ACTIVE' }),
    }),
  );
  expect(mockTx.organizationMember.create.mock.calls[0]![0].data.joinedAt).toBeInstanceOf(Date);
});
```

**Apply for project.service.spec.ts:**
- `mockProjectRepo`: `{ findMany: vi.fn(), findById: vi.fn(), update: vi.fn(), softDelete: vi.fn() }`.
- `mockProjectMemberRepo`: `{ upsertMember: vi.fn(), findManyByProject: vi.fn(), softRemove: vi.fn() }`.
- `mockTx`: `{ project: { create: vi.fn() }, projectMember: { create: vi.fn() } }`.
- `mockPrisma`: `{ $transaction: vi.fn() }` re-armed in `beforeEach`.
- `mockCtx`: `{ getOrganizationId: vi.fn(), getUserId: vi.fn(), getOrganizationMemberId: vi.fn() }`.
- Test cases per RESEARCH.md Validation Architecture: duplicate key → `PROJECT.KEY_DUPLICATE` or 409, creator auto-added, IDOR guard.

---

### `src/project/application/project-member.service.ts` (service, CRUD)

**Analog:** `src/organization/application/member.service.ts`

**Full file pattern** (lines 1–117): The MemberService is the exact template. Key differences:
- Constructor: `(projectMemberRepo, prisma: PrismaService, ctx: TenantContextService)`.
- `addMember(orgId, projectId, dto)`: call `assertPathMatchesContext(orgId)`, validate `organizationMemberId` is ACTIVE in org via `this.scopedPrisma.client.organizationMember.findFirst({ where: { id: dto.organizationMemberId, status: 'ACTIVE' } })` — because `organizationMember` IS in `ORG_SCOPED_MODELS`, this auto-scopes + filters `deletedAt: null`. Throw `PROJECT_ERROR_CODES.MEMBER_NOT_ORG_MEMBER` if null. Then `this.projectMemberRepo.upsertMember(organizationId, projectId, dto.organizationMemberId, dto.roleName ?? null, actorUserId)`.
- `removeMember(orgId, projectId, memberId)`: soft-delete via `prisma.$transaction` (no last-member guardrail for projects, unlike org).
- `assertPathMatchesContext` pattern (lines 107–116) — identical structure, throws `PROJECT_ERROR_CODES.ACCESS_DENIED`.

**addMember / assertPathMatchesContext** (lines 33–48 for addMember, 107–116 for assert):
```typescript
async addMember(id: string, email: string): Promise<OrganizationMember> {
  const organizationId = this.assertPathMatchesContext(id);
  const user = await this.prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundException({
      errorCode: TENANT_ERROR_CODES.USER_NOT_FOUND,
      message: 'No user found with that email address.',
    });
  }
  const actorUserId = this.ctx.getUserId()!;
  return this.memberRepo.upsertMember(organizationId, user.id, actorUserId);
}

private assertPathMatchesContext(id: string): string {
  const organizationId = this.ctx.getOrganizationId();
  if (id !== organizationId) {
    throw new ForbiddenException({
      errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,
      message: 'Access denied.',
    });
  }
  return organizationId;
}
```

---

### `src/project/application/project-member.service.spec.ts` (test, CRUD)

**Analog:** `src/organization/application/member.service.spec.ts`

**Mock + describe pattern** (lines 1–36):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberService } from './member.service';

const mockMemberRepo = {
  findManyByOrg: vi.fn(),
  upsertMember: vi.fn(),
  findById: vi.fn(),
};

const mockTx = {
  organizationMember: { count: vi.fn(), updateMany: vi.fn() },
};

const mockPrisma = {
  user: { findFirst: vi.fn() },
  $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
};

const mockCtx = {
  getOrganizationId: vi.fn().mockReturnValue('org-123'),
  getUserId: vi.fn().mockReturnValue('caller-user-id'),
  getOrganizationMemberId: vi.fn(),
};
```

**Apply:** Replace `mockMemberRepo` with `mockProjectMemberRepo`. Add `mockScopedPrisma` for the ACTIVE org-member validation call. Test: (1) non-existent `organizationMemberId` → `MEMBER_NOT_ORG_MEMBER`, (2) re-add reactivates (upsert path), (3) soft-remove sets `status=REMOVED + deletedAt`.

---

### `src/project/persistence/project.repository.ts` (repository, CRUD)

**Analog:** `src/organization/persistence/member.repository.ts`

**Class declaration + constructor** (lines 1–23):
```typescript
import { Injectable } from '@nestjs/common';
import { OrganizationMember, PrismaService } from '@repo/database';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from '../../tenancy/base-repository';
import { TenantedPrismaService } from '../../tenancy/tenanted-prisma.service';

@Injectable()
export class MemberRepository extends BaseRepository {
  constructor(
    scopedPrisma: TenantedPrismaService,
    cls: ClsService,
    private readonly prisma: PrismaService,
  ) {
    super(scopedPrisma, cls);
  }
```

**findFirst / findMany pattern** (lines 25–31):
```typescript
findManyByOrg(): Promise<OrganizationMember[]> {
  return this.scopedPrisma.client.organizationMember.findMany();
}

findById(id: string): Promise<OrganizationMember | null> {
  return this.scopedPrisma.client.organizationMember.findFirst({ where: { id } });
}
```

**Apply for ProjectRepository:**
- Extends `BaseRepository`; constructor takes `(scopedPrisma, cls)` — no raw `PrismaService` needed (project is in `ORG_SCOPED_MODELS`; no upsert needed here).
- `findMany(query?: CursorPaginationDto): Promise<Project[]>` — uses `this.scopedPrisma.client.project.findMany({ ... cursor pagination ... })`.
- `findById(id: string)` — uses `this.scopedPrisma.client.project.findFirst({ where: { id } })` (NEVER `findUnique`).
- `create(data)` — uses `this.scopedPrisma.client.project.create` only if called outside a transaction; otherwise create is done inline in the `$transaction` in ProjectService.
- `update(id, data)` — `this.scopedPrisma.client.project.updateMany({ where: { id }, data })`.
- `softDelete(id)` — `this.scopedPrisma.client.project.updateMany({ where: { id }, data: { ...this.getSoftDeleteData(), status: 'ARCHIVED' } })`.

---

### `src/project/persistence/project-member.repository.ts` (repository, CRUD + upsert)

**Analog:** `src/organization/persistence/member.repository.ts`

**Upsert pattern — raw PrismaService** (lines 45–66):
```typescript
upsertMember(
  organizationId: string,
  userId: string,
  actorUserId: string,
): Promise<OrganizationMember> {
  return this.prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      status: 'ACTIVE',
      joinedAt: new Date(),
      createdBy: actorUserId,
    },
    update: {
      status: 'ACTIVE',
      deletedAt: null,
      joinedAt: new Date(),
      updatedBy: actorUserId,
    },
  });
}
```

**Apply for ProjectMemberRepository:**
- Extends `BaseRepository`; constructor takes `(scopedPrisma, cls, private readonly prisma: PrismaService)` — raw `prisma` needed for upsert.
- `findManyByProject(projectId)` — `this.scopedPrisma.client.projectMember.findMany({ where: { projectId } })`.
- `findById(id)` — `this.scopedPrisma.client.projectMember.findFirst({ where: { id } })`.
- `upsertMember(organizationId, projectId, organizationMemberId, roleName, actorUserId)` — raw `this.prisma.projectMember.upsert` using `@@unique` key `{ projectId_organizationMemberId: { projectId, organizationMemberId } }`. Create data must include explicit `organizationId`. Update data: `status: 'ACTIVE', deletedAt: null, joinedAt: new Date(), roleName, updatedBy: actorUserId`.
- `softRemove(id, actorUserId)` — `this.scopedPrisma.client.projectMember.updateMany({ where: { id }, data: { status: 'REMOVED', ...this.getSoftDeleteData() } })`.

---

### `src/project/project.module.ts` (module)

**Analog:** `src/organization/organization.module.ts`

**Full file pattern** (lines 1–21):
```typescript
import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { OrganizationController } from './api/organization.controller';
import { OrganizationService } from './application/organization.service';
import { MemberService } from './application/member.service';
import { OrganizationRepository } from './persistence/organization.repository';
import { MemberRepository } from './persistence/member.repository';

@Module({
  imports: [TenancyModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, MemberService, OrganizationRepository, MemberRepository],
})
export class OrganizationModule {}
```

**Apply:** `imports: [TenancyModule]`. `controllers: [ProjectController]`. `providers: [ProjectService, ProjectMemberService, ProjectRepository, ProjectMemberRepository]`. No exports needed (domain-internal providers).

---

### `src/team/api/dto/create-team.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/create-organization.dto.ts` (lines 1–16)

**Apply:** Fields: `@IsString() @MinLength(2) @MaxLength(100) name!: string`, `@IsOptional() @IsString() @MaxLength(500) description?`, `@IsOptional() @IsEnum(TeamType) type?`. Import `TeamType` enum from `@repo/database` if using enum validation, or use `@IsString() @IsIn([...])` with the string values.

---

### `src/team/api/dto/team-response.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/organization-response.dto.ts` (lines 1–28)

**Apply:** Import `Team` from `@repo/database`. Expose: `id`, `organizationId`, `name`, `description`, `type`, `createdAt`, `createdBy`. Never expose `deletedAt`, `deletedBy`, `updatedBy`, `updatedAt`.

---

### `src/team/api/dto/add-team-member.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/add-member.dto.ts` (lines 1–6)

**Apply:** Single field `@IsString() @IsUUID() organizationMemberId!: string`. No `roleName` field — `TeamMember` has no `roleName` in the schema (D-04).

---

### `src/team/api/dto/team-member-response.dto.ts` (dto, request-response)

**Analog:** `src/organization/api/dto/member-response.dto.ts` (lines 1–28)

**Apply:** Import `TeamMember` from `@repo/database`. Expose: `id`, `teamId`, `organizationMemberId`, `joinedAt`, `createdAt`. No `status` field — `TeamMember` has no `status` column in the frozen schema.

---

### `src/team/api/team.controller.ts` (controller, request-response)

**Analog:** `src/organization/api/organization.controller.ts` (lines 1–80)

**Apply:** `@Controller({ path: 'organizations/:orgId/teams', version: '1' })`. No `@NoTenantScope` routes. Use `'organization:read'` / `'organization:manage'` permissions (A-02 in RESEARCH.md — team-specific permission codes deferred to later RBAC phase). Routes: `POST /`, `GET /`, `GET /:teamId`, `PATCH /:teamId`, `DELETE /:teamId`, `POST /:teamId/members`, `GET /:teamId/members`, `DELETE /:teamId/members/:memberId`. All accept `@Param('orgId') orgId: string`.

---

### `src/team/application/team.service.ts` (service, CRUD)

**Analog:** `src/organization/application/organization.service.ts` (lines 1–105)

**Apply:** Constructor: `(teamRepo: TeamRepository, ctx: TenantContextService)` — no `prisma` needed unless a transaction is used (team create does NOT auto-add creator as member per D-05). All methods call `assertPathMatchesContext(orgId)` first. `createTeam`, `listTeams`, `findTeamById`, `updateTeam`, `softDeleteTeam`. `assertPathMatchesContext` throws `TEAM_ERROR_CODES.ACCESS_DENIED`.

---

### `src/team/application/team.service.spec.ts` (test, CRUD)

**Analog:** `src/organization/application/organization.service.spec.ts` (lines 1–89)

**Apply:** `mockTeamRepo` with `{ create, findMany, findById, update, softDelete }` vi.fn(). `mockCtx`. Tests: IDOR guard (path mismatch → `TEAM.ACCESS_DENIED`), happy-path create, soft-delete sets `deletedAt + deletedBy`.

---

### `src/team/application/team-member.service.ts` (service, CRUD)

**Analog:** `src/organization/application/member.service.ts` (lines 1–117)

**Apply:** Constructor: `(teamMemberRepo: TeamMemberRepository, scopedPrisma: TenantedPrismaService, ctx: TenantContextService)`. The `scopedPrisma` is needed to validate that `organizationMemberId` is an ACTIVE org member before upsert (same Pitfall 6 guard as ProjectMemberService). The `teamMemberRepo` uses raw `PrismaService` internally for upsert and explicit org filtering. `assertPathMatchesContext(orgId)` throws `TEAM_ERROR_CODES.ACCESS_DENIED`. No last-member guardrail (D-05).

---

### `src/team/application/team-member.service.spec.ts` (test, CRUD)

**Analog:** `src/organization/application/member.service.spec.ts` (lines 1–106)

**Apply:** `mockTeamMemberRepo` with `{ upsertMember, findManyByTeam, softRemove }`. `mockScopedPrisma` for the ACTIVE-member validation. Tests: non-ACTIVE `organizationMemberId` → `TEAM.MEMBER_NOT_ORG_MEMBER`, re-add reactivates (upsert path), soft-remove (no Serializable transaction needed — no last-member guardrail).

---

### `src/team/persistence/team.repository.ts` (repository, CRUD)

**Analog:** `src/organization/persistence/member.repository.ts` (lines 1–31)

**Apply:** Extends `BaseRepository`; constructor `(scopedPrisma, cls)`. All methods use `this.scopedPrisma.client.team.*`. `findMany()`, `findById(id)` uses `findFirst` (NEVER `findUnique`), `create(data)`, `update(id, data)` via `updateMany`, `softDelete(id)` via `updateMany({ where: { id }, data: { ...this.getSoftDeleteData() } })`. `team` is in `ORG_SCOPED_MODELS` (confirmed line 35 of `tenanted-prisma.service.ts`).

---

### `src/team/persistence/team-member.repository.ts` (repository, CRUD — CRITICAL: raw PrismaService)

**Analog:** `src/organization/persistence/organization.repository.ts` + upsert pattern from `member.repository.ts`

**Raw PrismaService constructor pattern from `organization.repository.ts`** (lines 1–13):
```typescript
import { Injectable } from '@nestjs/common';
import { Organization, PrismaService } from '@repo/database';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}
```

**Upsert pattern from `member.repository.ts`** (lines 50–66):
```typescript
return this.prisma.organizationMember.upsert({
  where: { organizationId_userId: { organizationId, userId } },
  create: { organizationId, userId, status: 'ACTIVE', joinedAt: new Date(), createdBy: actorUserId },
  update: { status: 'ACTIVE', deletedAt: null, joinedAt: new Date(), updatedBy: actorUserId },
});
```

**Apply — CRITICAL DEVIATION from BaseRepository pattern:**
`TeamMemberRepository` does NOT extend `BaseRepository`. It uses raw `PrismaService` + `ClsService` only. `teamMember` is absent from `ORG_SCOPED_MODELS` (confirmed `tenanted-prisma.service.ts` lines 31–38). Every query MUST include explicit `team: { organizationId, deletedAt: null }` nested filter to prevent cross-tenant reads.

```typescript
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
      where: { teamId, deletedAt: null, team: { organizationId, deletedAt: null } },
    });
  }

  upsertMember(teamId, organizationMemberId, actorUserId): Promise<TeamMember> {
    // Uses raw prisma — same RESEARCH A3 reason as MemberRepository
    return this.prisma.teamMember.upsert({
      where: { teamId_organizationMemberId: { teamId, organizationMemberId } },
      create: { teamId, organizationMemberId, joinedAt: new Date(), createdBy: actorUserId },
      update: { deletedAt: null, joinedAt: new Date(), updatedBy: actorUserId },
    });
  }

  softRemove(id, teamId, actorUserId): Promise<void> {
    const organizationId = this.getOrgId();
    return this.prisma.teamMember.updateMany({
      where: { id, teamId, deletedAt: null, team: { organizationId, deletedAt: null } },
      data: { deletedAt: new Date(), deletedBy: actorUserId },
    });
  }
}
```

Note on `TeamMember.upsert` create block: `TeamMember` has no `organizationId` field and no `status` field in the frozen schema. Do not add them. The `joinedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` columns exist. `TeamMember.onDelete: Cascade` — soft-deleting the parent `Team` does not cascade `deletedAt`; only hard-deleting would cascade, which the soft-delete pattern avoids.

---

### `src/team/team.module.ts` (module)

**Analog:** `src/organization/organization.module.ts` (lines 1–21)

**Apply:** `imports: [TenancyModule]`. `controllers: [TeamController]`. `providers: [TeamService, TeamMemberService, TeamRepository, TeamMemberRepository]`. No exports needed.

---

### `src/organization/application/organization-port.adapter.ts` (service/adapter, request-response — NEW)

**Analog:** `src/organization/persistence/organization.repository.ts` (raw PrismaService pattern, lines 1–35)

**Raw PrismaService constructor pattern** (lines 1–13):
```typescript
@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}
```

**Apply:** `@Injectable()` class `OrganizationPortAdapter implements OrganizationPort`. Constructor: `(private readonly prisma: PrismaService)` — raw PrismaService only, never `TenantedPrismaService`. Implement three methods:

1. `getOrganizationSummary(orgId)` — `this.prisma.organization.findUnique({ where: { id: orgId, deletedAt: null }, select: { id, name, slug, status } })`. Return mapped `OrganizationSummaryDto` or `null`.
2. `getProjectSummary(projectId)` — `this.prisma.project.findUnique({ where: { id: projectId, deletedAt: null }, select: { id, name, key, status, organizationId } })`. Return mapped `ProjectSummaryDto` or `null`.
3. `isActiveMember(orgId, userId)` — `this.prisma.organizationMember.findFirst({ where: { organizationId: orgId, userId, status: 'ACTIVE', deletedAt: null }, select: { id: true } })`. Return `member !== null`.

All three methods use raw `PrismaService` — the port may be called by future cross-org consumers (CONTEXT.md D-12). The explicit `deletedAt: null` check on each query ensures soft-deleted records never surface. Return types use the `OrganizationSummaryDto` and `ProjectSummaryDto` interfaces from `src/contracts/organization/` — not Prisma entity types.

---

### `src/organization/organization.module.ts` (module — UPDATED)

**Analog:** `src/organization/organization.module.ts` (lines 1–21, self-reference — existing file to modify)

**Current providers list** (line 19):
```typescript
providers: [OrganizationService, MemberService, OrganizationRepository, MemberRepository],
```

**Apply (add):** Import `OrganizationPortAdapter` and `ORGANIZATION_PORT` token. Add to `providers`:
```typescript
{ provide: ORGANIZATION_PORT, useClass: OrganizationPortAdapter },
OrganizationPortAdapter,
```
Add `ORGANIZATION_PORT` to `exports`:
```typescript
exports: [ORGANIZATION_PORT],
```
Downstream modules (`ProjectModule`, `TeamModule`, and Phase 8/9 modules) will import `OrganizationModule` and inject `@Inject(ORGANIZATION_PORT) private readonly orgPort: OrganizationPort`.

---

### `src/app.module.ts` (config — UPDATED)

**Analog:** `src/app.module.ts` (lines 26, 97 — existing file to modify)

**Current import line** (line 26):
```typescript
import { OrganizationModule } from './organization/organization.module';
```

**Current module imports array** (line 97):
```typescript
OrganizationModule,
```

**Apply:** Add two new import statements + two new entries in the `imports` array:
```typescript
import { ProjectModule } from './project/project.module';
import { TeamModule } from './team/team.module';
// ... inside imports array:
ProjectModule,
TeamModule,
```

---

## Contracts Directory — Greenfield (No Analog)

The `src/contracts/organization/` directory introduces a pattern that does not exist anywhere in the codebase. The files below are greenfield. Use RESEARCH.md Patterns 7 and 8, and CONTEXT.md D-11/D-12/D-13 as the specification. There are no in-codebase excerpts to copy.

### `src/contracts/organization/organization.port.ts` (port-interface, greenfield)

No analog. Derive from RESEARCH.md Pattern 7:

```typescript
// packages/backend/src/contracts/organization/organization.port.ts
export const ORGANIZATION_PORT = Symbol('ORGANIZATION_PORT');

export interface OrganizationSummaryDto { ... }
export interface ProjectSummaryDto { ... }
export interface OrganizationPort {
  getOrganizationSummary(orgId: string): Promise<OrganizationSummaryDto | null>;
  getProjectSummary(projectId: string): Promise<ProjectSummaryDto | null>;
  isActiveMember(orgId: string, userId: string): Promise<boolean>;
}
```

**Constraint:** Zero imports from any domain module or `@repo/database`. Plain TypeScript interfaces only. The DI Symbol and all interfaces must live in a single file or split across `organization.port.ts` (Symbol + interface) and `organization-summary.dto.ts` (DTOs).

### `src/contracts/organization/organization-summary.dto.ts` (dto, greenfield)

No analog. Plain TypeScript `readonly` interface fields: `id`, `name`, `slug`, `status` for `OrganizationSummaryDto`; `id`, `name`, `key`, `status`, `organizationId` for `ProjectSummaryDto`. No Prisma types, no `deletedAt`, no internal fields.

### `src/contracts/organization/index.ts` (barrel, greenfield)

No analog. Single-purpose barrel: `export * from './organization.port'; export * from './organization-summary.dto';`.

---

## Shared Patterns

### IDOR Guard (`assertPathMatchesContext`)

**Source:** `src/organization/application/member.service.ts` lines 107–116
**Apply to:** All service files that accept an `orgId` path parameter: `ProjectService`, `ProjectMemberService`, `TeamService`, `TeamMemberService`

```typescript
private assertPathMatchesContext(id: string): string {
  const organizationId = this.ctx.getOrganizationId();
  if (id !== organizationId) {
    throw new ForbiddenException({
      errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED,  // replace with domain-specific code
      message: 'Access denied.',
    });
  }
  return organizationId;
}
```

Use `PROJECT_ERROR_CODES.ACCESS_DENIED` in project services, `TEAM_ERROR_CODES.ACCESS_DENIED` in team services.

---

### Soft-Delete Data Helper

**Source:** `src/tenancy/base-repository.ts` lines 37–42
**Apply to:** All repositories that extend `BaseRepository` (ProjectRepository, ProjectMemberRepository, TeamRepository)

```typescript
protected getSoftDeleteData(): { deletedAt: Date; deletedBy: string | null } {
  return {
    deletedAt: new Date(),
    deletedBy: this.cls.get<string>('userId') ?? null,
  };
}
```

`TeamMemberRepository` does NOT extend BaseRepository; it must read `deletedBy` from CLS manually via `this.cls.get<string>('userId') ?? null`.

---

### Error Envelope

**Source:** `src/common/error-catalog/create-error-catalog.ts` lines 1–16; `src/common/exceptions/global-exception.filter.ts` (registered globally)
**Apply to:** All service throw sites

All thrown exceptions use the `{ errorCode, message }` response object format (the filter wraps this into `{ success: false, errorCode, message, traceId }`). Never throw a plain string.

---

### findFirst over findUnique (Scoped Models)

**Source:** `src/tenancy/base-repository.ts` lines 11–14 (comment); `src/organization/persistence/member.repository.ts` line 30
**Apply to:** `ProjectRepository.findById`, `ProjectMemberRepository.findById`, `TeamRepository.findById`

```typescript
findById(id: string): Promise<OrganizationMember | null> {
  return this.scopedPrisma.client.organizationMember.findFirst({ where: { id } });
}
```

Never call `findUnique` on an org-scoped model through the scoped client.

---

### Raw PrismaService for Upsert (Re-add / Reactivation)

**Source:** `src/organization/persistence/member.repository.ts` lines 50–66; comment at line 13
**Apply to:** `ProjectMemberRepository.upsertMember`, `TeamMemberRepository.upsertMember`

Both must use raw `this.prisma.<model>.upsert(...)` — the `$extends` where-injection conflicts with upsert's unique-key argument (RESEARCH A3). The `organizationId` must be passed explicitly in the `create` block for `ProjectMember` (which has an `organizationId` FK). `TeamMember` has no `organizationId` FK — do not add it to the create block.

---

### DTO Static `from()` Mapping

**Source:** `src/organization/api/dto/organization-response.dto.ts` lines 18–27; `member-response.dto.ts` lines 18–27
**Apply to:** All response DTOs (`ProjectResponseDto`, `ProjectMemberResponseDto`, `TeamResponseDto`, `TeamMemberResponseDto`)

Every response DTO uses a `static from(entity): ResponseDto` method that explicitly lists only allowed fields. Never spread `...entity` — that risks leaking `deletedAt`, `deletedBy`, `updatedBy`.

---

### Paginated List Return Shape

**Source:** `src/common/pagination/cursor-pagination.dto.ts`; `src/common/pagination/pagination-meta.interface.ts`
**Apply to:** `ProjectController.listProjects`, `TeamController.listTeams`, `ProjectController.listProjectMembers`, `TeamController.listTeamMembers`

```typescript
// Query param DTO
@Query() query: CursorPaginationDto

// Return type
Promise<PaginatedResult<ProjectResponseDto>>

// Return value
return { data: items.map(ProjectResponseDto.from), meta: { nextCursor, hasNextPage } };
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/contracts/organization/organization.port.ts` | port-interface | N/A | First `contracts/<domain>/` port in the codebase — no prior port pattern |
| `src/contracts/organization/organization-summary.dto.ts` | dto | N/A | Plain TS interfaces with no domain imports — no equivalent exists yet |
| `src/contracts/organization/index.ts` | barrel | N/A | First contracts barrel — trivial `export *` with no analog needed |

For these three files, use the specifications in RESEARCH.md Patterns 7 and 8 and CONTEXT.md D-11/D-12/D-13 directly.

---

## Metadata

**Analog search scope:** `packages/backend/src/organization/`, `packages/backend/src/tenancy/`, `packages/backend/src/common/`
**Files scanned:** 12 (organization module: 12), 9 (tenancy), 19 (common) = 40 total
**Schema verified:** `packages/database/prisma/schema/organization.prisma` — Project, ProjectMember, Team, TeamMember exact fields and constraints
**Pattern extraction date:** 2026-07-03
