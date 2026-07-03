# Phase 6: Tenancy & Organization Foundation - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 25 (20 new, 5 modified)
**Analogs found:** 22 / 25

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/tenancy/tenant.guard.ts` | guard | request-response | `src/authorization/permissions.guard.ts` | exact |
| `src/tenancy/decorators/no-tenant-scope.decorator.ts` | utility/decorator | request-response | `src/auth/decorators/public.decorator.ts` | exact |
| `src/tenancy/tenanted-prisma.service.ts` | service | CRUD | `src/authorization/permission-resolver.service.ts` | role-match |
| `src/tenancy/tenant-context.service.ts` | service | request-response | `src/authorization/permission-resolver.service.ts` | role-match |
| `src/tenancy/base-repository.ts` | utility/abstract | CRUD | — | no analog |
| `src/tenancy/tenancy-error-codes.ts` | utility/config | request-response | `src/authorization/authorization-error-codes.ts` | exact |
| `src/tenancy/tenancy.module.ts` | module/config | — | `src/authorization/authorization.module.ts` | exact |
| `src/tenancy/tenant.guard.spec.ts` | test | — | `src/authorization/permissions.guard.spec.ts` | exact |
| `src/tenancy/tenanted-prisma.service.spec.ts` | test | — | `src/authorization/permission-resolver.service.spec.ts` | role-match |
| `src/organization/organization.module.ts` | module/config | — | `src/authorization/authorization.module.ts` | role-match |
| `src/organization/api/organization.controller.ts` | controller | request-response | `src/health/health.controller.ts` | partial |
| `src/organization/api/dto/create-organization.dto.ts` | utility/DTO | transform | `src/common/pagination/cursor-pagination.dto.ts` | role-match |
| `src/organization/api/dto/organization-response.dto.ts` | utility/DTO | transform | `src/common/pagination/cursor-pagination.dto.ts` | role-match |
| `src/organization/api/dto/add-member.dto.ts` | utility/DTO | transform | `src/common/pagination/cursor-pagination.dto.ts` | role-match |
| `src/organization/api/dto/member-response.dto.ts` | utility/DTO | transform | `src/common/pagination/cursor-pagination.dto.ts` | role-match |
| `src/organization/application/organization.service.ts` | service | CRUD | `src/authorization/permission-resolver.service.ts` | role-match |
| `src/organization/application/member.service.ts` | service | CRUD | `src/authorization/permission-resolver.service.ts` | role-match |
| `src/organization/application/member.service.spec.ts` | test | — | `src/authorization/permission-resolver.service.spec.ts` | role-match |
| `src/organization/persistence/organization.repository.ts` | repository | CRUD | `src/authorization/permission-resolver.service.ts` | partial |
| `src/organization/persistence/member.repository.ts` | repository | CRUD | `src/authorization/permission-resolver.service.ts` | partial |
| `src/auth/auth-audit-context-provider.ts` *(modify)* | service | request-response | itself (current file) | exact |
| `src/app.module.ts` *(modify)* | config | — | itself (current file) | exact |
| `src/app.integration.spec.ts` *(modify)* | test | — | itself (existing RBAC block) | exact |
| `.github/workflows/ci.yml` *(modify)* | config | — | itself (existing RBAC env var) | exact |
| `docs/adr/ADR-001-tenant-enforcement-mechanism.md` | documentation | — | — | no analog |

---

## Pattern Assignments

### `src/tenancy/tenant.guard.ts` (guard, request-response)

**Analog:** `packages/backend/src/authorization/permissions.guard.ts`

**Imports pattern** (lines 1-7):
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { AUTHZ_ERROR_CODES } from './authorization-error-codes';
import { PermissionResolverService } from './permission-resolver.service';
import { CurrentUser } from '../auth/current-user.type';
```
Copy this shape. Replace AUTHZ imports with tenancy imports. Add `ClsService` from `nestjs-cls` and `PrismaService` from `@repo/database`. Import `IS_NO_TENANT_SCOPE_KEY` from the new decorator file.

**Opt-out bypass pattern** (lines 37-41 of permissions.guard.ts — the `@Public()` check):
```typescript
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;
```
`TenantGuard` must check `isPublic` first (no principal to scope), then check `isNoTenantScope` with the same `getAllAndOverride([handler, class])` pattern.

**Fail-closed principal check** (lines 51-57):
```typescript
const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
if (!request.user) {
  throw new ForbiddenException({
    errorCode: AUTHZ_ERROR_CODES.PERMISSION_DENIED,
    message: 'You do not have permission to perform this action.',
  });
}
```
`TenantGuard` mirrors this exact structure for the missing-user case. Replace `AUTHZ_ERROR_CODES.PERMISSION_DENIED` with `TENANT_ERROR_CODES.NO_ORG_CONTEXT` and keep the generic message (D-02: never disclose org existence vs. non-membership).

**ClsService write pattern** — copy from `src/auth/jwt-auth.guard.ts` lines 55-56:
```typescript
request.user = currentUser;
this.cls.set('user', currentUser);
```
In `TenantGuard`, after successful membership lookup, set three CLS keys:
```typescript
this.cls.set('organizationId', organizationId);
this.cls.set('organizationMemberId', member.id);
this.cls.set('userId', member.userId);
```

**Header extraction pattern** — from `src/auth/jwt-auth.guard.ts` lines 39-42 (same array-header guard):
```typescript
const devUser = request.headers['x-dev-user'];
rawToken = Array.isArray(devUser) ? devUser[0] : devUser;
```
Apply the same `Array.isArray(rawHeader) ? rawHeader[0] : rawHeader` pattern for `X-Organization-Id`.

---

### `src/tenancy/decorators/no-tenant-scope.decorator.ts` (utility/decorator, request-response)

**Analog:** `packages/backend/src/auth/decorators/public.decorator.ts` (lines 1-6)

**Exact pattern to replicate** (copy verbatim, rename only):
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
```
Becomes:
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_NO_TENANT_SCOPE_KEY = 'isNoTenantScope';

export const NoTenantScope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_NO_TENANT_SCOPE_KEY, true);
```
No additional logic. The `MethodDecorator & ClassDecorator` union is load-bearing — it allows the decorator on both method and class level (same as `@Public()`).

---

### `src/tenancy/tenanted-prisma.service.ts` (service, CRUD)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts`

**Constructor DI pattern** (lines 29-32 of permission-resolver.service.ts):
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly cls: ClsService,
) {}
```
`TenantedPrismaService` uses the same two collaborators (PrismaService + ClsService). The `$extends` pattern itself has no codebase analog — use RESEARCH.md Pattern 1 directly.

**CLS read pattern** (lines 47-50 of permission-resolver.service.ts):
```typescript
const cacheKey = `${PERMISSIONS_CLS_KEY}:${email}:${organizationId ?? ''}`;
const cached = this.cls.get<Set<string>>(cacheKey);
if (cached !== undefined) {
  return cached;
}
```
In `TenantedPrismaService`, the CLS read happens inside the `$extends` closure at query execution time (not at construction time). The type-param pattern `this.cls.get<string>('organizationId')` follows the same generic form.

**Injectable decorator and `@Injectable()` pattern** (line 28): class is decorated with `@Injectable()` and depends only on globally-available providers (PrismaService is global via PrismaModule, ClsService via ClsModule.forRoot).

**Critical: no codebase analog for `$extends`** — use RESEARCH.md Pattern 1 code block verbatim for the extension body including `ORG_SCOPED_MODELS`, `NO_WHERE_OPERATIONS`, `UNIQUE_OPERATIONS`, and the fail-closed `ForbiddenException` when `orgId` is missing.

---

### `src/tenancy/tenant-context.service.ts` (service, request-response)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts`

This is a thin wrapper exposing typed getters for the three CLS keys set by `TenantGuard`. Follow the same `@Injectable()` + single-dependency constructor pattern:

```typescript
// From permission-resolver.service.ts lines 28-32
@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}
```

`TenantContextService` only needs `ClsService`:
```typescript
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  getUserId(): string | undefined { return this.cls.get<string>('userId'); }
  getOrganizationId(): string | undefined { return this.cls.get<string>('organizationId'); }
  getOrganizationMemberId(): string | undefined { return this.cls.get<string>('organizationMemberId'); }
}
```

---

### `src/tenancy/tenancy-error-codes.ts` (utility/config)

**Analog:** `packages/backend/src/authorization/authorization-error-codes.ts` (line 1-3)

**Exact pattern** (copy verbatim, rename only):
```typescript
import { createErrorCatalog } from '../common/error-catalog/create-error-catalog';

export const AUTHZ_ERROR_CODES = createErrorCatalog('AUTHZ', ['PERMISSION_DENIED'] as const);
```
Becomes:
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
The `as const` assertion is load-bearing — it narrows the type to a literal union, enabling the `createErrorCatalog` return type inference (see `create-error-catalog.ts` line 9-16 for the generic).

---

### `src/tenancy/tenancy.module.ts` (module/config)

**Analog:** `packages/backend/src/authorization/authorization.module.ts` (lines 1-24)

**Module structure to replicate** (exact leaf-module pattern):
```typescript
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PermissionsGuard } from './permissions.guard';
import { PermissionResolverService } from './permission-resolver.service';

@Module({
  imports: [AppConfigModule],
  providers: [PermissionsGuard, PermissionResolverService],
  exports: [PermissionsGuard, PermissionResolverService],
})
export class AuthorizationModule {}
```

The comment in `authorization.module.ts` is the authoritative rule (lines 8-17):
> CRITICAL: imports only AppConfigModule. PrismaModule and ClsModule are registered as @Global() in AppModule, so their providers (PrismaService, ClsService) are available here without explicit import.

`TenancyModule` follows the same constraint: no PrismaModule or ClsModule import in the module `imports[]` — they are already global. Only import `AppConfigModule` if configuration is needed.

Providers to register: `TenantGuard`, `TenantedPrismaService`, `TenantContextService`.
Exports: `TenantGuard` (used by AppModule APP_GUARD), `TenantedPrismaService` (used by Organization repositories), `TenantContextService` (used by D-16 and repositories).

---

### `src/tenancy/tenant.guard.spec.ts` (test)

**Analog:** `packages/backend/src/authorization/permissions.guard.spec.ts` (lines 1-119)

**Mock setup pattern** (lines 9-10):
```typescript
const mockReflector = { getAllAndOverride: vi.fn() };
const mockResolver = { resolve: vi.fn() };
```
For `TenantGuard`: mock reflector, mock prisma (with `organizationMember: { findFirst: vi.fn() }`), and mock cls (with `get: vi.fn()`, `set: vi.fn()`).

**Mock context factory** (lines 13-24): copy `buildMockContext()` verbatim. Add `headers` to the request mock to support `X-Organization-Id` header testing:
```typescript
function buildMockContext(user?: CurrentUser, headers: Record<string, string | string[] | undefined> = {}): {
  mockContext: ExecutionContext;
  mockRequest: { user?: CurrentUser; headers: Record<string, string | string[] | undefined> };
} {
  const mockRequest = { user, headers };
  const mockContext = {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { mockContext, mockRequest };
}
```

**Reflector setup helper** (lines 29-35): copy `setupReflector()` pattern, extended to handle the two metadata keys (`IS_PUBLIC_KEY` and `IS_NO_TENANT_SCOPE_KEY`).

**Test case structure** (lines 45-118): mirror the existing test case categories:
- `@Public()` → returns true immediately (same)
- `@NoTenantScope()` → returns true immediately (new)
- Missing `X-Organization-Id` header → `ForbiddenException` with `TENANT.MISSING_ORG_HEADER`
- No principal (request.user undefined) → `ForbiddenException` with `TENANT.NO_ORG_CONTEXT`
- Non-ACTIVE membership (findFirst returns null) → `ForbiddenException` with `TENANT.ORG_ACCESS_DENIED`
- ACTIVE membership found → returns true, cls.set called with three keys
- Array header value → takes first element only

**beforeEach pattern** (lines 41-43):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  guard = new PermissionsGuard(mockReflector as never, mockResolver as never);
});
```
Use `vi.clearAllMocks()` + constructor instantiation. Do NOT use `Test.createTestingModule` for guard unit tests (creates unnecessary DI overhead).

---

### `src/tenancy/tenanted-prisma.service.spec.ts` (test)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.spec.ts` (lines 1-183)

**Mock setup pattern** (lines 8-9):
```typescript
const mockPrisma = { user: { findFirst: vi.fn() } };
const mockCls = { get: vi.fn(), set: vi.fn() };
```
For `TenantedPrismaService` spec: mock the `$extends` interaction. Since `$extends` runs inside the constructor, mock `PrismaService` as an object with a `$extends` method:
```typescript
const capturedExtension = { query: { $allModels: { $allOperations: null as unknown } } };
const mockPrisma = {
  $extends: vi.fn().mockImplementation((extension) => {
    Object.assign(capturedExtension, extension);
    return { organizationMember: { findMany: vi.fn() } };  // mock scoped client
  }),
};
const mockCls = { get: vi.fn() };
```
This lets each test call `capturedExtension.query.$allModels.$allOperations({ model, operation, args, query })` directly to assert the auto-injection behavior without a real DB.

**Service construction pattern** (line 29):
```typescript
service = new PermissionResolverService(mockPrisma as never, mockCls as never);
```
Same: `service = new TenantedPrismaService(mockPrisma as never, mockCls as never)`.

**Test case categories** (mirror permission-resolver.service.spec.ts structure):
- Org-scoped model + non-where operation → orgId + deletedAt:null injected into args.where
- Org-scoped model + NO_WHERE_OPERATIONS (create) → args NOT mutated
- Org-scoped model + UNIQUE_OPERATIONS (findUnique) → args NOT mutated
- Non-scoped model → args NOT mutated regardless of operation
- Missing orgId in CLS (orgId undefined) → throws ForbiddenException TENANT.NO_ORG_CONTEXT (fail-closed)
- orgId present in CLS → injected correctly into args.where

---

### `src/organization/organization.module.ts` (module/config)

**Analog:** `packages/backend/src/authorization/authorization.module.ts`

Apply the same leaf-module pattern (lines 19-24):
```typescript
@Module({
  imports: [AppConfigModule],
  providers: [PermissionsGuard, PermissionResolverService],
  exports: [PermissionsGuard, PermissionResolverService],
})
export class AuthorizationModule {}
```
`OrganizationModule` imports `TenancyModule` (to access `TenantedPrismaService`). PrismaModule and ClsModule do not need to be listed — they are global.

---

### `src/organization/api/organization.controller.ts` (controller, request-response)

**Analog:** `packages/backend/src/health/health.controller.ts` (lines 1-29)

**Controller scaffold pattern** (lines 9-13):
```typescript
@Controller({ path: 'health', version: '1' })
@RawResponse()
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}
```
For `OrganizationController`:
- Use `@Controller({ path: 'organizations', version: '1' })` (URI versioning)
- Inject `OrganizationService` and `MemberService`
- Do NOT use `@RawResponse()` — use the standard envelope interceptor
- Use `@NoTenantScope()` on the two cross-org methods only: `POST /` (create) and `GET /mine`
- All other routes rely on `TenantGuard` (default-on)

**Route decorator pattern** (lines 18-28 — @Get with named handler):
```typescript
@Get('liveness')
liveness(): { status: string } {
  return { status: 'ok' };
}

@Get('readiness')
@HealthCheck()
readiness() {
  return this.health.check([() => this.prismaIndicator.isHealthy('prisma')]);
}
```
For organization controller, follow the same single-responsibility method structure. Each method has one decorator, one action, typed return. Methods should call the service and return the result — no business logic in the controller (CLAUDE.md §6).

---

### `src/organization/api/dto/*.dto.ts` (utility/DTO, transform)

**Analog:** `packages/backend/src/common/pagination/cursor-pagination.dto.ts` (lines 1-27)

**DTO scaffold pattern** (complete file):
```typescript
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```
Every DTO follows this pattern:
- `class-validator` decorators on every property
- `class-transformer` `@Type()` when coercion is needed (query params only — body fields coerce via global ValidationPipe `transform: true`)
- No `@ApiProperty()` unless a separate Swagger task adds it
- `whitelist: true` is already global (AppModule line 108-113) — unknown fields are stripped/rejected automatically

For `CreateOrganizationDto`: `@IsString()` + `@MinLength(2)` + `@MaxLength(100)` on `name`, same on `slug`.
For `AddMemberDto`: `@IsEmail()` on `email`.
For response DTOs: plain class with typed properties (no validation decorators needed — responses are server-produced). Consider `Exclude` from `class-transformer` to strip `deletedAt`/`deletedBy` from responses.

---

### `src/organization/application/organization.service.ts` (service, CRUD)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts`

**Service scaffold pattern** (lines 28-32):
```typescript
@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}
```
`OrganizationService` injects raw `PrismaService` (Organization has no `organizationId` FK — unscoped path per D-08) and `TenantContextService` (to read `userId` for the creator-as-member pattern).

**Transaction pattern** — from RESEARCH.md Code Examples section (Creator-as-Active-Member, D-10):
```typescript
async createOrganization(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
  return this.prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: dto.name, slug: dto.slug, createdBy: userId },
    });
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId,
        status: 'ACTIVE',
        joinedAt: new Date(),
        createdBy: userId,
      },
    });
    return org;
  });
}
```
The `$transaction(async tx => ...)` pattern uses the raw transaction client — the `$extends` scoping does not propagate into interactive transactions (RESEARCH.md A2, confirmed Prisma behavior).

**Prisma query style** (from permission-resolver.service.ts lines 64-97): use `findFirst` (not `findUnique`) for lookups that need soft-delete filtering (`deletedAt: null`). Use `select` projections to avoid over-fetching.

---

### `src/organization/application/member.service.ts` (service, CRUD)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts`

Same scaffold as OrganizationService. `MemberService` injects:
- `MemberRepository` (extends `BaseRepository`, uses `TenantedPrismaService`)
- Raw `PrismaService` (for `User.findFirst` by email — cross-org lookup, D-13)
- `TenantContextService` (for `userId` in soft-delete data)

**Fail-closed user lookup pattern** (mirrors permission-resolver.service.ts lines 64-101 null-return handling):
```typescript
// D-13: reject if User does not exist — never create
const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
if (!user) {
  throw new NotFoundException({ errorCode: TENANT_ERROR_CODES.USER_NOT_FOUND,
    message: 'No user found with that email address.' });
}
```

**Last-member guardrail pattern** (D-15 — business logic in service, not repository):
```typescript
const activeCount = await this.prisma.organizationMember.count({
  where: { organizationId, status: 'ACTIVE', deletedAt: null },
});
if (activeCount <= 1) {
  throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.LAST_MEMBER_REMOVAL });
}
```

---

### `src/organization/application/member.service.spec.ts` (test)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.spec.ts`

**Mock setup** (lines 8-9):
```typescript
const mockPrisma = { user: { findFirst: vi.fn() } };
const mockCls = { get: vi.fn(), set: vi.fn() };
```
For member service: mock `MemberRepository` (with `findManyByOrg`, `upsertMember`, `softDelete`), mock raw `PrismaService` (with `user.findFirst`, `organizationMember.count`), mock `TenantContextService` (returns fixed userId).

**Test structure** (mirror permission-resolver.service.spec.ts):
- `beforeEach(() => { vi.clearAllMocks(); service = new MemberService(...); })`
- Happy path: add member, list members, remove member
- Fail-closed: add non-existent user → NotFoundException TENANT.USER_NOT_FOUND
- Last-member guardrail: count returns 1 → ForbiddenException TENANT.LAST_MEMBER_REMOVAL
- Re-add: upsertMember called (not createMember) for a previously-removed user

---

### `src/organization/persistence/organization.repository.ts` (repository, CRUD)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts` (partial — Prisma query style)

No abstract repository base class exists in the codebase yet. `OrganizationRepository` uses raw `PrismaService` directly (Organization has no `organizationId` FK — unscoped per D-08).

**Prisma query style to copy** (permission-resolver.service.ts lines 64-70):
```typescript
const user = await this.prisma.user.findFirst({
  where: {
    email,
    deletedAt: null,
  },
  select: {
    userRoles: { ... },
  },
});
```
Replicate the `findFirst` + `where: { deletedAt: null }` + `select` projection pattern for all read operations. Use `prisma.organization.create` for writes and `prisma.organization.findMany` for cross-org list-my-orgs queries.

---

### `src/organization/persistence/member.repository.ts` (repository, CRUD)

**Analog:** `packages/backend/src/authorization/permission-resolver.service.ts` (partial — Prisma query style)

This repository EXTENDS the new `BaseRepository` (see "No Analog Found" section below for `BaseRepository` itself). After `BaseRepository` is written, `MemberRepository` follows the pattern from RESEARCH.md Pattern 3:
```typescript
@Injectable()
export class MemberRepository extends BaseRepository {
  async findManyByOrg(): Promise<OrganizationMember[]> {
    return this.scopedPrisma.client.organizationMember.findMany();
  }

  async softDelete(id: string): Promise<void> {
    await this.scopedPrisma.client.organizationMember.update({
      where: { id },
      data: this.getSoftDeleteData(),
    });
  }
}
```
Note: `upsertMember` (re-add pattern, D-14) uses raw `PrismaService` directly — upsert.where may conflict with the extension's scope injection (RESEARCH.md A3, Open Question 1). Use `@InjectToken` or inject raw PrismaService alongside the scoped one.

---

### `src/auth/auth-audit-context-provider.ts` *(modify)* (service, request-response)

**Analog:** current file itself + `src/authorization/permission-resolver.service.ts` (ClsService injection pattern)

**Current file** (lines 1-14 — entire file):
```typescript
import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';

@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  getContext(): AuditContext | null {
    return null;
  }
}
```

**D-16 target** — inject `ClsService` and read the two CLS keys set by `TenantGuard`. Mirror the ClsService constructor injection from `permission-resolver.service.ts` lines 29-32:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly cls: ClsService,
) {}
```
After D-16, the file reads:
```typescript
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';

@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) {
    super();
  }

  getContext(): AuditContext | null {
    const organizationId = this.cls.get<string>('organizationId');
    const userId = this.cls.get<string>('userId');
    if (!organizationId) return null;
    return { organizationId, userId };
  }
}
```
Also update `src/auth/auth.module.ts` to add `ClsService` as a constructor dependency — but `ClsService` is globally provided (no import change needed in the module's `imports[]` array).

---

### `src/app.module.ts` *(modify)* (config)

**Analog:** current file itself (line 124 — the existing PermissionsGuard APP_GUARD line)

**Existing APP_GUARD pattern** (lines 118-124):
```typescript
{ provide: APP_GUARD, useClass: ThrottlerGuard },
// D-09 (Phase 4): JwtAuthGuard is second — ThrottlerGuard runs first to rate-limit all
// requests including unauthenticated attempts before auth processing begins.
{ provide: APP_GUARD, useClass: JwtAuthGuard },
// D-05 (Phase 5): PermissionsGuard is third — JwtAuthGuard must run first to populate
// request.user; PermissionsGuard then enforces @RequirePermissions codes (RBAC-03).
{ provide: APP_GUARD, useClass: PermissionsGuard },
```

**Phase 6 addition** — insert immediately after line 124:
```typescript
// D-04 (Phase 6): TenantGuard is fourth — runs after PermissionsGuard.
// Reads request.user (set by JwtAuthGuard) and X-Organization-Id header.
// @NoTenantScope() opt-out; default-on fail-closed. (TENANT-01, TENANT-02)
{ provide: APP_GUARD, useClass: TenantGuard },
```

Also add `TenancyModule` to `imports[]` and `OrganizationModule` to `imports[]`. Update the comment on line 134:
```typescript
// Audit context provider — Phase 6 supplies userId + organizationId from CLS (D-16).
{ provide: IAuditContextProvider, useClass: AuthAuditContextProvider },
```

---

### `src/app.integration.spec.ts` *(modify)* (test)

**Analog:** existing RBAC block in current file (lines 486-588)

**Block structure to replicate** (lines 486-496 — the skipIf + beforeAll pattern):
```typescript
describe.skipIf(!realDbAvailable)('RBAC Authorization (real DB) (RBAC-02..RBAC-04)', () => {
  let rbacApp: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacTestController],
      // Intentionally NO .overrideModule(PrismaModule).useModule(MockPrismaModule) here.
    }).compile();
```

**Pre-cleanup + fixture seeding pattern** (lines 504-538):
```typescript
// Pre-cleanup: remove any leftover fixtures from a previous failed run to ensure idempotency.
const leftoverUser = await prisma.user.findUnique({ where: { email: 'rbac-allow@test.com' } });
if (leftoverUser) {
  await prisma.userRole.deleteMany({ where: { userId: leftoverUser.id } });
  await prisma.organizationMember.deleteMany({ where: { userId: leftoverUser.id } });
  await prisma.user.delete({ where: { id: leftoverUser.id } });
}
```
For the isolation test: create org A + org B, two users, two ACTIVE memberships with `joinedAt = new Date()`. The afterAll cleans up in dependency order (memberOf → user → org).

**realDbRequired guard pattern** (lines 36-37 + 114-116):
```typescript
const realDbRequired = process.env['RBAC_REALDB_REQUIRED'] === '1';
// ...
it('real-DB RBAC block must actually execute when RBAC_REALDB_REQUIRED is set', () => {
  if (realDbRequired) expect(realDbAvailable).toBe(true);
});
```
Add a parallel `TENANT_REALDB_REQUIRED` variable at line 36-37 and a corresponding guard `it()` immediately after the existing one.

**Supertest assertion pattern** (lines 554-558):
```typescript
it('(a) allow: Developer role holding organization:read returns 200 on the read route (RBAC-02)', async () => {
  const { status } = await request(rbacApp.getHttpServer())
    .get('/api/v1/rbac-test/read')
    .set('x-dev-user', 'rbac-allow@test.com');
  expect(status).toBe(200);
});
```
Isolation test assertions add `.set('x-organization-id', orgA.id)` header. The five test cases map to RESEARCH.md Validation Architecture table: (a) allow, (b) cross-tenant deny, (c) isolation proof, (d) missing header, (e) non-ACTIVE membership.

---

## Shared Patterns

### Authentication Bypass (`@Public()`)
**Source:** `packages/backend/src/auth/decorators/public.decorator.ts` lines 3-6
**Apply to:** `TenantGuard.canActivate()` — check `IS_PUBLIC_KEY` first before `IS_NO_TENANT_SCOPE_KEY`
```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
```

### Reflector.getAllAndOverride Pattern
**Source:** `packages/backend/src/authorization/permissions.guard.ts` lines 37-41
**Apply to:** `TenantGuard` for both `IS_PUBLIC_KEY` and `IS_NO_TENANT_SCOPE_KEY` checks
```typescript
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;
```
Always check `[handler, class]` in that order — method-level takes precedence over class-level (NestJS `getAllAndOverride` semantics).

### Error Envelope (`ForbiddenException` with errorCode)
**Source:** `packages/backend/src/authorization/permissions.guard.ts` lines 51-57 and `packages/backend/src/common/exceptions/global-exception.filter.ts` lines 49-62
**Apply to:** `TenantGuard`, `MemberService`, `OrganizationService`
```typescript
throw new ForbiddenException({
  errorCode: AUTHZ_ERROR_CODES.PERMISSION_DENIED,
  message: 'You do not have permission to perform this action.',
});
```
The `GlobalExceptionFilter` reads `errorCode` from the response object (lines 49-56 of global-exception.filter.ts) and forwards it. Pass `{ errorCode, message }` as the argument to `ForbiddenException`/`NotFoundException`/etc. Never throw bare `new Error()`.

### ClsService Read Pattern
**Source:** `packages/backend/src/authorization/permission-resolver.service.ts` lines 47-50
**Apply to:** `TenantContextService.getOrganizationId()`, `TenantedPrismaService` extension closure, `AuthAuditContextProvider.getContext()`
```typescript
const cached = this.cls.get<Set<string>>(cacheKey);
if (cached !== undefined) {
  return cached;
}
```
Use `cls.get<T>(key)` with explicit generic type parameter. Check `!== undefined` (not falsy) to distinguish "not set" from "set to empty string" — especially relevant for `organizationId`.

### ClsService Write Pattern
**Source:** `packages/backend/src/auth/jwt-auth.guard.ts` lines 55-56
**Apply to:** `TenantGuard.canActivate()` after successful membership lookup
```typescript
request.user = currentUser;
this.cls.set('user', currentUser);
```
Write all three tenant-context keys atomically (no early returns between the three `cls.set` calls once membership is validated).

### Leaf Module (No Cyclic DI)
**Source:** `packages/backend/src/authorization/authorization.module.ts` lines 8-24
**Apply to:** `TenancyModule`, `OrganizationModule`
```typescript
@Module({
  imports: [AppConfigModule],   // only non-domain infrastructure
  providers: [PermissionsGuard, PermissionResolverService],
  exports: [PermissionsGuard, PermissionResolverService],
})
```
Never import domain modules into infrastructure modules. PrismaService and ClsService are globally available — do not list PrismaModule or ClsModule in `imports[]`.

### Soft-Delete Query Filter
**Source:** `packages/backend/src/authorization/permission-resolver.service.ts` lines 64-68
**Apply to:** All Prisma queries in `OrganizationRepository`, `MemberRepository`, `TenantGuard` membership lookup
```typescript
const user = await this.prisma.user.findFirst({
  where: {
    email,
    deletedAt: null,   // exclude soft-deleted entities
  },
```
Every read query on org-owned models must include `deletedAt: null` either via the `$extends` auto-injection (for scoped models) or explicit where-clause (for unscoped / raw queries).

### Vitest Unit Test Structure
**Source:** `packages/backend/src/authorization/permissions.guard.spec.ts` lines 1-10, 37-43
**Apply to:** `tenant.guard.spec.ts`, `tenanted-prisma.service.spec.ts`, `member.service.spec.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReflector = { getAllAndOverride: vi.fn() };
const mockResolver = { resolve: vi.fn() };

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new PermissionsGuard(mockReflector as never, mockResolver as never);
  });
```
Always `vi.clearAllMocks()` in `beforeEach`. Instantiate the class under test via constructor (not `Test.createTestingModule`) for unit tests. Use `as never` for mock type assertions.

### Integration Test `describe.skipIf` + Real-DB Guard
**Source:** `packages/backend/src/app.integration.spec.ts` lines 29-36, 114-116, 486
**Apply to:** Tenant isolation block in `app.integration.spec.ts`
```typescript
const realDbAvailable =
  !!process.env['DATABASE_URL'] && process.env['DATABASE_URL'] !== MOCK_DATABASE_URL;
const realDbRequired = process.env['RBAC_REALDB_REQUIRED'] === '1';

it('real-DB RBAC block must actually execute when RBAC_REALDB_REQUIRED is set', () => {
  if (realDbRequired) expect(realDbAvailable).toBe(true);
});

describe.skipIf(!realDbAvailable)('RBAC Authorization (real DB) (RBAC-02..RBAC-04)', () => {
```
Add a parallel `TENANT_REALDB_REQUIRED` env-var check and a parallel guard `it()`. The isolation block uses `describe.skipIf(!realDbAvailable)`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/tenancy/base-repository.ts` | utility/abstract | CRUD | No abstract repository or base class exists anywhere in the codebase. Use RESEARCH.md Pattern 3 verbatim (`BaseRepository` abstract class backed by `TenantedPrismaService`, `getSoftDeleteData()` helper). |
| `docs/adr/ADR-001-tenant-enforcement-mechanism.md` | documentation | — | No ADRs exist in the repository. Create the `docs/adr/` directory; use the Nygard format (Title, Date, Status, Context, Decision, Consequences) from RESEARCH.md ADR section. |

---

## Metadata

**Analog search scope:** `packages/backend/src/` (all TypeScript source files)
**Files scanned:** 51 source files + 2 Prisma schemas
**Key directories:** `src/auth/`, `src/authorization/`, `src/common/`, `src/health/`, `src/config/`
**Pattern extraction date:** 2026-07-03

**Analog confidence:**
- `tenant.guard.ts` ← `permissions.guard.ts`: HIGH — identical role, data flow, and NestJS primitives; only domain logic differs
- `no-tenant-scope.decorator.ts` ← `public.decorator.ts`: HIGH — verbatim copy with variable rename
- `tenancy-error-codes.ts` ← `authorization-error-codes.ts`: HIGH — one-line pattern, same factory
- `tenancy.module.ts` ← `authorization.module.ts`: HIGH — same leaf-module constraint
- `tenant.guard.spec.ts` ← `permissions.guard.spec.ts`: HIGH — same guard test structure
- `organization.controller.ts` ← `health.controller.ts`: MEDIUM — only controller in codebase; no CRUD controller exists yet; follow health controller scaffold + RESEARCH.md REST shape
- `*.dto.ts` ← `cursor-pagination.dto.ts`: MEDIUM — same DTO class-validator pattern
- `organization.service.ts`, `member.service.ts` ← `permission-resolver.service.ts`: MEDIUM — Prisma + CLS service role matches; domain logic is new
- `base-repository.ts`: LOW — no analog; follow RESEARCH.md Pattern 3 exclusively
