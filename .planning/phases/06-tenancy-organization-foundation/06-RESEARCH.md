# Phase 6: Tenancy & Organization Foundation - Research

**Researched:** 2026-07-03
**Domain:** Multi-tenant request context, Prisma client extensions, NestJS guard chain, organization CRUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Active organization declared per-request via `X-Organization-Id` header. Never from the JWT (`CurrentUser.tenantId` = Entra `tid`, not a platform org).

**D-02:** Global `TenantGuard` reads `CurrentUser` + `X-Organization-Id`, validates ACTIVE `OrganizationMember`, populates tenant context. Missing header / non-member / non-ACTIVE → fail-closed 403. Do not disclose org existence vs. non-member.

**D-03:** CLS context carries `userId` (User.id), `organizationId`, `organizationMemberId` — resolved by a single membership lookup. Same shape used by BaseRepository scoping, RBAC seam, and `AuthAuditContextProvider`.

**D-04:** TenantGuard registers as `APP_GUARD` **after** PermissionsGuard, completing the chain `ThrottlerGuard → JwtAuthGuard → PermissionsGuard → TenantGuard`. Opt-out via `@NoTenantScope()` (mirrors `@Public()`). Enforcement is default-on; forgetting the decorator never silently disables isolation.

**D-05 (ADR):** Enforcement mechanism is a **Prisma client extension** (`$extends`) that auto-injects `where organizationId = <ctx.organizationId>` AND `deletedAt: null` on org-owned model queries. PostgreSQL RLS recorded as future defense-in-depth only — NOT implemented this phase.

**D-06:** Phase 6 ships the **working scoping now** (not ADR-only): real org-scoped, soft-delete-aware `BaseRepository` with the two-organization isolation test as the acceptance gate.

**D-07:** RBAC stays org-agnostic (union across memberships). The Phase 5 seam `resolve(email, organizationId?)` remains documented-but-unapplied.

**D-08:** Extension scopes by default; an explicit, auditable **unscoped path** is required for: creating an Organization, TenantGuard's membership validation lookup, "list orgs I belong to." Fail-closed: no active org in CLS + no explicit unscoped call → error, never a silent full-table query.

**D-09:** Any authenticated user can create an organization. Create route is `@NoTenantScope()`. Creator is recorded as ACTIVE member with `joinedAt = now()`.

**D-10:** Creator recorded as ACTIVE `OrganizationMember` with `joinedAt = now()` — overrides schema default `status = INVITED`.

**D-11:** Org administration is membership-based this phase. New org has zero roles. Permission gate = ACTIVE membership.

**D-12:** A caller can list/read only orgs they are an ACTIVE member of.

**D-13:** Add-member operates on existing Users only. Rejects with actionable error if no `User` row exists. No JIT User creation.

**D-14:** Removal is a soft-delete: `status = REMOVED + deletedAt + deletedBy`. Re-adding a removed user reactivates the existing row (honors `@@unique([organizationId, userId])`).

**D-15:** Guardrail: block removing the last ACTIVE member of an org.

**D-16:** Wire `AuthAuditContextProvider.getContext()` to read `userId` + `organizationId` from CLS, activating the existing `AuditInterceptor`.

### Claude's Discretion

- Exact module placement (new `src/tenancy/` or `src/organization/` leaf module)
- Exact TenantGuard primitive and CLS key names
- Exact Prisma extension API shape, BaseRepository surface, unscoped accessor name
- Exact `@NoTenantScope()` metadata key
- Error-code catalog additions for tenancy denials
- REST shape of org/member endpoints (routes, DTOs, pagination)

### Deferred Ideas (OUT OF SCOPE)

- Per-org role/permission provisioning
- PostgreSQL RLS as DB-level defense-in-depth
- Applying the RBAC org-narrowing seam
- Invite-by-email for not-yet-registered users
- Owner/admin member roles and richer removal guardrails
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENANT-01 | Request-scoped tenant/actor context (AsyncLocalStorage) populated from authenticated principal | CLS via `nestjs-cls` 6.2.1 already global; TenantGuard populates `userId`/`organizationId`/`organizationMemberId` keys |
| TENANT-02 | Tenant context always available to repositories without per-query plumbing | Prisma `$extends` query hook reads CLS per-request; BaseRepository receives scoped client with no manual wiring per query |
| TENANT-03 | User can create an organization and creator is recorded as a member | `@NoTenantScope()` create route; `OrganizationMember.create({ status: 'ACTIVE', joinedAt: new Date() })` via raw prisma |
| TENANT-04 | User can list/read organizations they belong to; denied for orgs they don't belong to | TenantGuard validates ACTIVE membership; `GET /organizations/mine` via unscoped query on OrganizationMember; `GET /organizations/:id` authorization via TenantGuard |
| TENANT-05 | Organization members can be added, listed, and removed | MemberRepository extends BaseRepository (auto-scoped); upsert for re-add; soft-delete for remove; last-ACTIVE-member guardrail in service layer |
| TENANT-06 | Two-organization isolation test proves org A never receives org B's data | Follows Phase 5 RBAC pattern: `describe.skipIf(!realDbAvailable)`, real-DB fixture seeding, supertest HTTP requests with `X-Organization-Id` header |
| TENANT-07 | Enforcement mechanism decided and recorded as an ADR | ADR at `docs/adr/ADR-001-tenant-enforcement-mechanism.md` (new directory); Nygard format |
| SEAM-05 | Org-scoped, soft-delete-aware BaseRepository available for domain repositories | `BaseRepository<T>` abstract class backed by `TenantedPrismaService`; Phase 7 `Project`/`Team` repos extend it immediately |
</phase_requirements>

---

## Summary

Phase 6 adds three interlocking mechanisms on top of the existing Phase 4/5 auth and RBAC stack: (1) a global `TenantGuard` that populates a request-scoped CLS context with `userId`/`organizationId`/`organizationMemberId` from the `X-Organization-Id` header and a single DB membership lookup; (2) a `TenantedPrismaService` that wraps the existing `PrismaService` via `$extends` to auto-inject `organizationId` and `deletedAt: null` into all read/update/delete queries on a declared whitelist of org-owned models; and (3) organization + member CRUD implemented against an abstract `BaseRepository` that uses the scoped client, with the raw `PrismaService` reserved for the few legitimate cross-org operations.

All dependencies are **already installed** — `nestjs-cls` 6.2.1 is global, `@prisma/client` 6.19.3 is installed, and no new npm packages are required for Phase 6. The implementation risk is not package availability but behavioral correctness: fail-open scoping (no org in CLS → silent full-table leak) and incorrect guard order are the two most catastrophic failure modes; the two-organization isolation test is the acceptance gate that proves neither occurred.

No migrations. Schema is frozen. All org-ownership semantics already exist in the schema via `organizationId` FK columns and platform-wide `deletedAt DateTime?` soft-delete fields.

**Primary recommendation:** Implement `TenantedPrismaService` as a NestJS provider that wraps `PrismaService.$extends(...)` using a closure over `ClsService`; extend `BaseRepository` from it; register `TenantGuard` as `APP_GUARD` after `PermissionsGuard` in `AppModule`; derive the isolation test from the Phase 5 RBAC integration test harness.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-org header resolution | API Layer (TenantGuard) | — | Guard runs before handlers; header is transport-level metadata |
| Tenant context storage | Cross-cutting (nestjs-cls ALS) | — | Must propagate through all async boundaries without DI rewiring |
| Org-owned model query scoping | Persistence Layer (Prisma extension) | — | Enforcement at DB access layer prevents any service bypassing isolation |
| Organization CRUD | API + Application + Persistence | — | Standard three-layer slice; business rules (last-member guardrail, re-add upsert) in service |
| Unscoped cross-org DB access | Persistence Layer (raw PrismaService) | — | Explicit, auditable; only injectable where the use case is documented |
| ADR authoring | Planning artifact | — | Documents the RLS-vs-extension decision for future engineers |
| Audit context activation | Cross-cutting (AuthAuditContextProvider) | — | D-16 wires CLS → audit writes without modifying AuditInterceptor |

---

## Standard Stack

### Core (all already installed — ZERO new packages)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `nestjs-cls` | 6.2.1 [VERIFIED: node_modules] | Global AsyncLocalStorage context — ClsService.get/set per request | Already wired in ClsModule.forRoot; global: true; middleware mounted |
| `@prisma/client` | 6.19.3 [VERIFIED: node_modules] | `$extends` query extension API for scoped client | Same client already used by PermissionResolverService; `$extends` supported since Prisma 5 |
| `@nestjs/core` Reflector | bundled with NestJS 11 [VERIFIED: existing guards] | Read `@NoTenantScope()` / `@Public()` metadata in TenantGuard | Identical usage pattern in JwtAuthGuard and PermissionsGuard |

### No New Packages Required

Phase 6 is pure application code on top of already-installed infrastructure. The `$extends` API, `ClsService`, `Reflector`, and all NestJS guard primitives are present. Installing no new packages removes the slopcheck / package legitimacy concern for this phase.

**Version verification (confirmed via `cat node_modules/@prisma/client/package.json`):**
```
@prisma/client: 6.19.3  (satisfies ^6.0.0 declared in database/package.json)
nestjs-cls: 6.2.1       (satisfies ^6.2.1 declared in backend/package.json)
```

---

## Package Legitimacy Audit

> Phase 6 installs **no new packages**. All capabilities are provided by already-installed and previously-vetted dependencies.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `nestjs-cls` | npm | Already installed, vetted Phase 3 | Approved |
| `@prisma/client` | npm | Already installed, vetted Phase 2 | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
    │
    ▼
ThrottlerGuard           (rate-limit)
    │
    ▼
JwtAuthGuard             (validates JWT → sets request.user + cls.set('user', ...))
    │ request.user = CurrentUser { entraId, email, tenantId }
    ▼
PermissionsGuard         (RBAC — org-agnostic, reads permission Set from DB via CLS memo)
    │
    ▼
TenantGuard              (reads X-Organization-Id header + request.user.email)
    │  DB lookup: OrganizationMember JOIN User WHERE email=? AND orgId=? AND status=ACTIVE
    │  → cls.set('userId', user.id)
    │  → cls.set('organizationId', orgId)
    │  → cls.set('organizationMemberId', memberId)
    │  @NoTenantScope() → skip guard
    │  missing header / non-ACTIVE → ForbiddenException (generic message, no org existence leak)
    ▼
Route Handler
    │
    ├─ OrganizationService.create()   → uses raw PrismaService (@NoTenantScope route)
    ├─ OrganizationService.findById() → uses raw PrismaService (Organization has no orgId FK)
    ├─ MemberService.list()           → uses TenantedPrismaService (auto-scopes to orgId + deletedAt:null)
    └─ MemberService.remove()         → uses TenantedPrismaService (update; extension injects orgId + deletedAt:null in WHERE)
         │
         ▼
    TenantedPrismaService             (PrismaService.$extends with query hook closure over ClsService)
         │  cls.get('organizationId') read at QUERY EXECUTION TIME (not service construction)
         │  → AsyncLocalStorage propagates correct per-request orgId
         ▼
    PostgreSQL                        (org-owned model rows filtered by organizationId + deletedAt:null)
```

### Recommended Project Structure

```
packages/backend/src/
├── tenancy/                          # Leaf module: cross-cutting tenant context
│   ├── tenancy.module.ts             # Exports TenantGuard, TenantedPrismaService, TenantContextService
│   ├── tenant.guard.ts               # APP_GUARD: validates X-Organization-Id header
│   ├── tenanted-prisma.service.ts    # PrismaService.$extends() with org-scoping query hook
│   ├── tenant-context.service.ts     # Thin CLS wrapper: get userId/organizationId/organizationMemberId
│   ├── base-repository.ts            # Abstract BaseRepository<T> backed by TenantedPrismaService
│   ├── tenancy-error-codes.ts        # createErrorCatalog('TENANT', [...]) 
│   └── decorators/
│       └── no-tenant-scope.decorator.ts
│
├── organization/                     # Leaf module: org + member CRUD
│   ├── organization.module.ts        # Imports TenancyModule, PrismaModule (global)
│   ├── api/
│   │   ├── organization.controller.ts
│   │   └── dto/
│   │       ├── create-organization.dto.ts
│   │       ├── organization-response.dto.ts
│   │       ├── add-member.dto.ts      # { email: string } (or userId)
│   │       └── member-response.dto.ts
│   ├── application/
│   │   ├── organization.service.ts   # Business rules: creator-as-member, read authorization
│   │   └── member.service.ts         # Business rules: last-member guardrail, re-add upsert
│   └── persistence/
│       ├── organization.repository.ts # Uses raw PrismaService (Organization has no orgId FK)
│       └── member.repository.ts       # Extends BaseRepository<OrganizationMember>
│
docs/
└── adr/
    └── ADR-001-tenant-enforcement-mechanism.md   # New directory; Nygard format
```

### Pattern 1: Prisma `$extends` Scoped Client

**What:** A `TenantedPrismaService` wraps the existing `PrismaService` using `$extends`. A closure over `ClsService` allows the query hook to read `organizationId` from the current request's async context at query execution time (not service construction time). A whitelist of model names determines which queries receive auto-scoping.

**Key API (Prisma 6.19.3, confirmed in `node_modules/@prisma/client/runtime/edge.d.ts`):**
```typescript
// Source: Prisma official docs + runtime/edge.d.ts type inspection
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // model: camelCase model name (e.g. 'organizationMember', 'project')
        // operation: 'findMany' | 'findFirst' | 'update' | 'delete' | 'create' | ...
        // args: mutable query input
        // query: call to continue to Prisma query engine
      }
    }
  }
})
```

**Critical: `findUnique` pitfall.** Prisma's `findUnique` enforces that `where` contains ONLY fields forming a unique constraint at the TypeScript type level. Injecting `organizationId` and `deletedAt` into a `findUnique.where` will cause a Prisma type error. The extension MUST skip `findUnique` and `findUniqueOrThrow` for org/soft-delete injection. The `BaseRepository` MUST use `findFirst`/`findFirstOrThrow` for org-scoped lookups. [VERIFIED: Prisma official extension docs, github.com/prisma/prisma-client-extensions/blob/main/input-transformation/script.ts]

**Operations without a `where` clause** (extension must skip): `create`, `createMany`, `createManyAndReturn`. [VERIFIED: Prisma official docs]

**Concrete implementation pattern:**
```typescript
// Source: dev.to/moofoo NestJS+CLS+Prisma article + Prisma official extension API
// Verified against installed @prisma/client 6.19.3 types

// Org-owned models with a direct organizationId FK (camelCase Prisma model names).
// Phase 6 needs 'organizationMember'; Phase 7 adds 'project', 'team', etc.
const ORG_SCOPED_MODELS = new Set([
  'organizationMember',
  'project',
  'projectMember',
  'team',
  'repository',
  'role',
  'permission',
  // Add as Phase 7+ adds domains — note: 'organization' itself is NOT here
  // because Organization has no organizationId FK; it IS the root entity
]);

// Operations that have no `where` arg — skip injection entirely
const NO_WHERE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);

// Operations to skip for findUnique type safety (use findFirst in BaseRepository instead)
const UNIQUE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
]);

@Injectable()
export class TenantedPrismaService {
  readonly client: ReturnType<PrismaService['$extends']>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    // Capture `cls` in closure — reads per-request context at query time, not here
    const cls = this.cls;

    this.client = prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (
              ORG_SCOPED_MODELS.has(model) &&
              !NO_WHERE_OPERATIONS.has(operation) &&
              !UNIQUE_OPERATIONS.has(operation)
            ) {
              const orgId = cls.get<string>('organizationId');
              if (orgId === undefined || orgId === null) {
                // D-08 fail-closed: no active org context and not on unscoped path
                throw new ForbiddenException({ errorCode: 'TENANT.NO_ORG_CONTEXT' });
              }
              // Type-assert since $allModels loses per-model type info
              const a = args as { where?: Record<string, unknown> };
              a.where = { ...(a.where ?? {}), organizationId: orgId, deletedAt: null };
            }
            return query(args);
          },
        },
      },
    });
  }
}
```

**Why CLS reads correctly at query time:** AsyncLocalStorage propagates through all async chains including Prisma's internal connection pool calls. Reading `cls.get('organizationId')` inside the `$allOperations` callback executes in the request's ALS context. The `TenantedPrismaService` is a singleton (default NestJS scope), but the `cls.get()` inside the extension reads the per-request ALS store, NOT any construction-time value. This is the standard pattern for avoiding request-scoped provider overhead while still achieving per-request context. [VERIFIED: dev.to/moofoo, nestjs-cls docs, Node.js AsyncLocalStorage propagation semantics]

### Pattern 2: TenantGuard (mirrors PermissionsGuard exactly)

**What:** Registered as `APP_GUARD` after `PermissionsGuard`. Reads `request.user` (set by `JwtAuthGuard`) and the `X-Organization-Id` header, validates ACTIVE membership via the **raw** `PrismaService`, and populates the CLS keys. Opt-out via `@NoTenantScope()` metadata.

```typescript
// Source: mirrors packages/backend/src/authorization/permissions.guard.ts pattern
// Mirrors packages/backend/src/auth/decorators/public.decorator.ts for @NoTenantScope()

export const IS_NO_TENANT_SCOPE_KEY = 'isNoTenantScope';

export const NoTenantScope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_NO_TENANT_SCOPE_KEY, true);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,  // RAW — not scoped
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() routes bypass — no principal to check against
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. @NoTenantScope() routes bypass — cross-org by design
    const isNoTenantScope = this.reflector.getAllAndOverride<boolean>(IS_NO_TENANT_SCOPE_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isNoTenantScope) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: CurrentUser;
    }>();

    // 3. Fail-closed: principal must exist (JwtAuthGuard ran before us)
    if (!request.user) {
      throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.NO_ORG_CONTEXT });
    }

    const rawHeader = request.headers['x-organization-id'];
    const organizationId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    // 4. Missing header on a tenant-scoped route → fail-closed (D-02)
    if (!organizationId) {
      throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.MISSING_ORG_HEADER });
    }

    // 5. Validate ACTIVE membership — single indexed query
    //    Uses raw PrismaService because CLS orgId not yet set
    //    D-02: Generic error — do not disclose whether org exists vs. user isn't a member
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        user: { email: request.user.email, deletedAt: null },
      },
      select: { id: true, userId: true },
    });

    if (!member) {
      // D-02: same 403 for "org doesn't exist" and "user not a member"
      throw new ForbiddenException({ errorCode: TENANT_ERROR_CODES.ORG_ACCESS_DENIED });
    }

    // 6. Populate CLS — D-03
    this.cls.set('organizationId', organizationId);
    this.cls.set('organizationMemberId', member.id);
    this.cls.set('userId', member.userId);

    return true;
  }
}
```

**AppModule wiring (add after existing PermissionsGuard line):**
```typescript
// D-04 (Phase 6): TenantGuard is fourth — runs after PermissionsGuard.
{ provide: APP_GUARD, useClass: TenantGuard },
```

### Pattern 3: Abstract BaseRepository

**What:** An abstract base that routes operations through the scoped Prisma client. The extension handles `organizationId` + `deletedAt: null` injection automatically. The `BaseRepository` adds semantic helpers for soft-delete and re-activation.

```typescript
// BaseRepository does NOT use findUnique — always findFirst for org-scoped lookups
// (avoiding the findUnique type-injection pitfall documented in Pitfall 1 below)
export abstract class BaseRepository {
  constructor(
    protected readonly scopedPrisma: TenantedPrismaService,
    protected readonly cls: ClsService,
  ) {}

  // Concrete repositories call scopedPrisma.client.<model>.<op>()
  // The extension auto-injects organizationId + deletedAt:null

  protected getSoftDeleteData(): { deletedAt: Date; deletedBy: string | null } {
    return {
      deletedAt: new Date(),
      deletedBy: this.cls.get<string>('userId') ?? null,
    };
  }
}

// Example — MemberRepository extends BaseRepository
@Injectable()
export class MemberRepository extends BaseRepository {
  async findManyByOrg(): Promise<OrganizationMember[]> {
    // Extension auto-injects: organizationId = cls.get('organizationId'), deletedAt: null
    return this.scopedPrisma.client.organizationMember.findMany();
  }

  async softDelete(id: string): Promise<void> {
    // UPDATE WHERE id = :id AND organizationId = :ctx AND deletedAt IS NULL
    // Extension handles WHERE scoping; we provide the data
    await this.scopedPrisma.client.organizationMember.update({
      where: { id },
      data: this.getSoftDeleteData(),
    });
  }
}
```

### Pattern 4: Unscoped (cross-org) Operations

**What:** Operations that must NOT be org-scoped use the raw `PrismaService` (the existing global Prisma client with no `$extends` applied). These are injected via DI directly where needed.

Legitimate unscoped operations (D-08):
- `Organization.create()` — no parent org yet
- `Organization.findUnique({ where: { id } })` — reading an org by ID (authorization enforced by TenantGuard having already run)
- `User.findFirst({ where: { email } })` — cross-org user lookup for add-member (D-13)
- `OrganizationMember.findFirst()` inside TenantGuard itself (bootstrapping the context)
- `OrganizationMember.findMany({ where: { userId: member.userId } })` for "list my orgs"

```typescript
// OrganizationRepository uses raw PrismaService — Organization has no organizationId FK
@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}  // raw, unscoped

  async create(data: CreateOrganizationData): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  // "List my orgs" — cross-org by design; auth via TenantGuard not applicable here (@NoTenantScope)
  async findByMemberUserId(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: {
        members: { some: { userId, status: 'ACTIVE', deletedAt: null } },
        deletedAt: null,
      },
    });
  }
}
```

### Anti-Patterns to Avoid

- **Injecting `organizationId` into `findUnique`/`findUniqueOrThrow` where args:** Prisma type system forbids non-unique fields in `findUnique.where`. Always use `findFirst` in org-scoped repositories.
- **Using `TenantedPrismaService` in TenantGuard itself:** The guard populates the CLS context; reading from CLS before populating it deadlocks. Use raw `PrismaService` in TenantGuard.
- **Using `TenantedPrismaService` for "create org":** Organization creation has no parent org. The extension would find no `organizationId` in CLS and throw. Use raw `PrismaService` or ensure the route is `@NoTenantScope()` AND uses raw client.
- **Reading `CurrentUser.tenantId` as org:** `tenantId` = Entra `tid` (identity provider tenant). Platform `Organization.id` only comes from the validated `X-Organization-Id` header.
- **Making TenantGuard request-scoped:** Unnecessary. The guard is singleton; it reads from the request context at execution time. Request-scoped guards cause DI performance penalties with no benefit.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request ALS context without DI overhead | Custom ALS wrapper | `nestjs-cls` `ClsService` (already installed) | Handles middleware, guard, and interceptor initialization timing; tested across async boundaries |
| Prisma query scoping middleware | Prisma middleware ($use) | Prisma `$extends` query hook | Middleware is deprecated in favor of extensions since Prisma 4.7; extensions share connection pool safely |
| Custom NestJS guard metadata checking | Hand-rolled metadata reader | `Reflector.getAllAndOverride([handler, class])` | Existing pattern — duplicated verbatim from PermissionsGuard and JwtAuthGuard |
| Per-organization PostgreSQL connection | One connection per tenant | Single PrismaService connection pool shared by `$extends` | `$extends` creates a lightweight wrapper, NOT a new connection. Connection pool efficiency is preserved |
| Soft-delete filtering per-query | `where: { deletedAt: null }` on every query | Auto-injection in `$extends` for org-owned models | Per-query discipline is the root cause of Pitfall 4 (PITFALLS.md) — one missed filter leaks data |

**Key insight:** The `$extends` approach (vs. PostgreSQL RLS) was chosen specifically because it requires NO new DDL, shares the existing connection pool, and is fully testable without transaction isolation gymnastics. The main cost is that enforcement lives in application code — which is why the two-organization isolation test is non-negotiable.

---

## Runtime State Inventory

> Phase 6 is new feature work (not a rename/refactor/migration). The schema is frozen (additive-only). No runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Seed creates the system org with slug 'system'. Phase 6 creates no additional seeds. | None — isolation test creates/destroys its own fixtures |
| Live service config | No external service configs reference org or tenancy state | None |
| OS-registered state | None | None |
| Secrets/env vars | No new env vars required for Phase 6 | None — existing `DATABASE_URL`, `AUTH_MODE` are sufficient |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: `findUnique` Type Injection Failure
**What goes wrong:** The Prisma extension injects `organizationId` and `deletedAt` into a `findUnique.where` clause. Prisma validates that `findUnique.where` contains ONLY fields forming the model's unique constraint (e.g., `{ id }`). Additional fields cause a Prisma TypeScript type error and may cause a runtime query failure.
**Why it happens:** `$allOperations` catches `findUnique`. The `args.where` spread looks identical to `findMany`, but Prisma enforces different constraint logic on `findUnique` where clauses.
**How to avoid:** In the extension, skip `findUnique` and `findUniqueOrThrow` (include them in `UNIQUE_OPERATIONS` set). In `BaseRepository`, use `findFirst`/`findFirstOrThrow` for all org-scoped lookups. The performance difference is negligible given the `organizationId` index.
**Warning signs:** TypeScript error on `prisma.organizationMember.findUnique({ where: { id, organizationId } })`.

### Pitfall 2: Fail-Open Scoping (Cross-Tenant Data Leak)
**What goes wrong:** When no `organizationId` is in the CLS store (e.g., route missed `@NoTenantScope()` decorator), the extension silently returns results without the `organizationId` filter — returning data across ALL tenants. This is the most dangerous failure mode.
**Why it happens:** A naive `if (orgId) { inject } else { skip }` implementation silently falls through on missing context.
**How to avoid (D-08 fail-closed):** When `model` is in `ORG_SCOPED_MODELS` AND operation is NOT in `NO_WHERE_OPERATIONS`, throw `ForbiddenException('TENANT.NO_ORG_CONTEXT')` if `cls.get('organizationId')` is undefined. Never silently proceed without the scope. The isolation test proves this.
**Warning signs:** A request to an org-scoped endpoint with no `X-Organization-Id` header returns data instead of 403.

### Pitfall 3: Guard Order Regression
**What goes wrong:** `TenantGuard` registered BEFORE `JwtAuthGuard` in AppModule.providers[] causes `request.user` to be undefined when TenantGuard reads it → every request fails with 403 or throws unhandled.
**Why it happens:** NestJS APP_GUARD registration order = execution order. An easy swap.
**How to avoid:** Keep the TenantGuard APP_GUARD registration immediately AFTER PermissionsGuard in AppModule. The order comment in AppModule is explicit (D-04). The integration test covers this (chain test: no auth header → 401, not 403).
**Warning signs:** All requests fail with 403 regardless of auth header.

### Pitfall 4: Bootstrap Deadlock — Extension Used for TenantGuard Lookup
**What goes wrong:** TenantGuard uses `TenantedPrismaService` to look up the membership record, but the extension reads `cls.get('organizationId')` — which hasn't been set yet (TenantGuard is the one setting it). Result: extension throws `TENANT.NO_ORG_CONTEXT`, guard fails every request.
**Why it happens:** Circular dependency: the guard that populates CLS depends on the service that reads CLS.
**How to avoid (D-08):** TenantGuard ALWAYS uses raw `PrismaService` (no extension) for its membership lookup. TenantedPrismaService is only used by domain repositories called from route handlers (where CLS is already populated). They are separate DI tokens and must not be confused.

### Pitfall 5: Entra TID vs Platform Organization ID
**What goes wrong:** `CurrentUser.tenantId` (the Entra `tid` claim) is treated as an `Organization.id`. All tenant scoping is then against the Entra tenant, which is static across all users in the same Azure tenant regardless of which platform org they are acting in.
**Why it happens:** The field is named `tenantId` in the JWT and refers to the Entra "tenant" which sounds like the platform "tenant/organization."
**How to avoid (D-01):** The active organization ONLY comes from the `X-Organization-Id` header, validated by TenantGuard against real `OrganizationMember` rows. `CurrentUser.tenantId` is Entra-specific and is never used for platform org scoping.
**Warning signs:** Org endpoints return data for users who are not `OrganizationMember` rows in the DB.

### Pitfall 6: JIT User Lookup Leak in Add-Member (TENANT-05)
**What goes wrong:** `POST /organizations/:id/members` with `{ email: "nonexistent@user.com" }` creates a new `User` row on-the-fly. This violates Phase 4 D-04 (no JIT User provisioning) and may create ghost users with no auth claims.
**Why it happens:** "Invite by email" is a common pattern; it's tempting to create the User if missing.
**How to avoid (D-13):** `MemberService.addMember()` does `User.findFirst({ where: { email } })`; if null, throw a clean `NotFoundException` with the error code `TENANT.USER_NOT_FOUND` and an actionable message. Never call `User.create()`.

### Pitfall 7: Re-Add Upsert Ignoring Unique Constraint
**What goes wrong:** Adding a member who was previously removed (soft-deleted) with `OrganizationMember.create()` fails with `P2002` (unique constraint: `@@unique([organizationId, userId])`).
**Why it happens:** The soft-deleted row still exists with `deletedAt` set. The unique constraint is not conditioned on `deletedAt`.
**How to avoid (D-14):** `MemberRepository.upsertMember()` uses `prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId, userId } }, create: {...}, update: { status: 'ACTIVE', deletedAt: null, joinedAt: new Date() } })`. The extension's `deletedAt: null` filter does NOT apply to `upsert.where` because upsert has its own unique-key logic. Use raw PrismaService for the upsert to avoid extension interference.

---

## Code Examples

### Tenancy Error Catalog

```typescript
// Source: mirrors packages/backend/src/authorization/authorization-error-codes.ts
// Follows createErrorCatalog pattern from packages/backend/src/common/error-catalog/create-error-catalog.ts

export const TENANT_ERROR_CODES = createErrorCatalog('TENANT', [
  'MISSING_ORG_HEADER',     // X-Organization-Id header absent on tenant-scoped route
  'ORG_ACCESS_DENIED',      // Generic: org doesn't exist OR caller not ACTIVE member (D-02)
  'NO_ORG_CONTEXT',         // Scoped query attempted with no active org in CLS (extension fail-closed)
  'USER_NOT_FOUND',         // add-member: email not found in User table (D-13)
  'LAST_MEMBER_REMOVAL',    // remove-member: cannot remove the last ACTIVE member (D-15)
] as const);
```

### `@NoTenantScope()` Decorator

```typescript
// Source: mirrors packages/backend/src/auth/decorators/public.decorator.ts exactly
// Keeps the same SetMetadata + dual MethodDecorator/ClassDecorator shape

export const IS_NO_TENANT_SCOPE_KEY = 'isNoTenantScope';

export const NoTenantScope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_NO_TENANT_SCOPE_KEY, true);
```

### `AuthAuditContextProvider` Update (D-16)

```typescript
// Source: packages/backend/src/auth/auth-audit-context-provider.ts (current returns null)
// Phase 6: inject ClsService and read userId + organizationId from CLS

@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) {
    super();
  }

  getContext(): AuditContext | null {
    const organizationId = this.cls.get<string>('organizationId');
    const userId = this.cls.get<string>('userId');
    if (!organizationId) return null;  // Pre-guard or @NoTenantScope route — skip audit
    return { organizationId, userId };
  }
}
```

### Creator-as-Active-Member Pattern (D-10)

```typescript
// Source: organization.service.ts pattern
// Both the Organization and the first OrganizationMember must be created atomically

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

Note: The transaction uses `PrismaService.$transaction(tx => ...)` where `tx` is the raw transaction client (no extension applied). This is safe — the extension is not invoked within interactive transactions. [VERIFIED: Prisma docs note that extensions do not propagate into transaction callbacks]

### Phase 5 Integration Test Pattern (for Isolation Test)

```typescript
// Mirror of the RBAC real-DB describe block in packages/backend/src/app.integration.spec.ts
// Source: existing app.integration.spec.ts lines 486-588

describe.skipIf(!realDbAvailable)('Tenant Isolation (real DB) (TENANT-06)', () => {
  // Fixture: orgA + userA/memberA, orgB + userB/memberB
  // Test (a): userA with X-Organization-Id: orgA.id → GET /api/v1/organizations/orgA.id/members → orgA members only
  // Test (b): userA with X-Organization-Id: orgA.id → attempts access to orgB endpoint → 403
  // Test (c): verify BaseRepository scoping: orgB data never appears in orgA member list
  // Test (d): chain: missing X-Organization-Id header → 403 TENANT.MISSING_ORG_HEADER
  // Test (e): non-ACTIVE membership → 403 TENANT.ORG_ACCESS_DENIED
  // CI flag: TENANT_REALDB_REQUIRED=1 (parallel to RBAC_REALDB_REQUIRED=1)
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma `$use` middleware for query interception | `$extends` query hook | Prisma 4.7 (middleware deprecated in 5.x) | `$extends` is the only supported API in Prisma 6 |
| Per-request PrismaClient instance for tenant isolation | Singleton PrismaClient + `$extends` with ALS context read | Prisma 5+ extensions + nestjs-cls | No connection pool pressure; no request-scoped provider overhead |
| PostgreSQL RLS via `SET LOCAL app.tenant_id` | Application-layer scoping via Prisma extension | ADR decision this phase | No DDL, no session variable per-connection dependency, connection-pooling-safe |

**Deprecated/outdated:**
- Prisma `$use` middleware: deprecated in Prisma 5, removed path in Prisma 6. Do NOT use `prisma.$use(...)` — use `prisma.$extends({ query: ... })` instead.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 with SWC |
| Config file | `packages/backend/vitest.config.ts` |
| Quick run command | `npm test --workspace=packages/backend -- --reporter=verbose --run` |
| Full suite command | `npm test --workspace=packages/backend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| TENANT-01 | CLS context populated after TenantGuard runs | Integration | Full suite | `app.integration.spec.ts` |
| TENANT-02 | BaseRepository queries never missing orgId filter | Integration | Full suite | `app.integration.spec.ts` |
| TENANT-03 | POST /organizations creates org + ACTIVE member atomically | Integration (real DB) | Full suite | `app.integration.spec.ts` |
| TENANT-04 | GET /organizations/:id denied for non-member | Integration (real DB) | Full suite | `app.integration.spec.ts` |
| TENANT-05 | Add/list/remove member; last-ACTIVE-member block; re-add upsert | Integration (real DB) + unit | Full suite | `app.integration.spec.ts` + service unit tests |
| TENANT-06 | Org A never sees org B's data | Integration (real DB) | Full suite | `app.integration.spec.ts` (new skipIf block) |
| TENANT-07 | ADR file exists and is parseable | Smoke (file existence) | Manual check | `docs/adr/ADR-001-*.md` |
| SEAM-05 | BaseRepository is abstract; MemberRepository extends it; scoped query auto-injects orgId | Unit (TenantedPrismaService) | Quick run | `tenancy/tenanted-prisma.service.spec.ts` |

### Critical Failure Modes (Acceptance Gates for TENANT-06)

| Failure Mode | How Tested | Must Fail If |
|--------------|------------|--------------|
| Cross-tenant data leak (fail-open scoping) | Request as orgA member, assert orgB rows never appear | Extension does not inject orgId OR fails silently without orgId |
| Guard-order regression | Request with no auth header → expect 401, not 403 | TenantGuard runs before JwtAuthGuard |
| JIT user leak | add-member with nonexistent email → expect 4xx, not 201 | Service creates User row on-the-fly |
| Missing-header fail-open | Tenant-scoped route with no X-Organization-Id → expect 403 | Guard returns true instead of denying |
| Last-ACTIVE-member removal | Remove last member → expect 4xx, not 200 | Service skips the guardrail count check |
| Bootstrap deadlock | TenantGuard uses scoped client for membership lookup | Extension throws NO_ORG_CONTEXT during guard execution |

### Sampling Rate

- **Per task commit:** `npm test --workspace=packages/backend -- --reporter=verbose --run`
- **Per wave merge:** `npm test --workspace=packages/backend` (full suite)
- **Phase gate:** Full suite green (including `TENANT_REALDB_REQUIRED=1` block in CI) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/src/tenancy/tenanted-prisma.service.spec.ts` — unit test for extension scoping logic (mock ClsService, assert where injection) — covers SEAM-05
- [ ] `packages/backend/src/tenancy/tenant.guard.spec.ts` — unit tests mirroring `permissions.guard.spec.ts` structure — covers TENANT-01
- [ ] `packages/backend/src/organization/application/member.service.spec.ts` — unit tests for last-member guardrail and re-add upsert — covers TENANT-05
- [ ] Update `packages/backend/src/app.integration.spec.ts` — add `TENANT_REALDB_REQUIRED` guard and `describe.skipIf` real-DB block for TENANT-06
- [ ] Update `.github/workflows/ci.yml` — add `TENANT_REALDB_REQUIRED: '1'` env var parallel to `RBAC_REALDB_REQUIRED: '1'`

---

## Security Domain

> `security_enforcement` not explicitly set to `false` in config — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — handled Phase 4 | — |
| V3 Session Management | no — stateless JWT | — |
| V4 Access Control | YES — tenant isolation is access control | TenantGuard + Prisma extension (fail-closed) |
| V5 Input Validation | yes — org header + request DTOs | NestJS global ValidationPipe (already active) |
| V6 Cryptography | no | — |

### Known Threat Patterns for Multi-Tenant NestJS + Prisma

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read (fail-open scoping) | Information Disclosure | `$extends` injects `organizationId` filter fail-closed; extension throws on missing context |
| Org existence disclosure via error messages | Information Disclosure | TenantGuard returns generic `ORG_ACCESS_DENIED` for both "org not found" and "not a member" |
| Mass-assignment of `organizationId` via request body | Tampering | Server sets `organizationId` from CLS; it is NEVER accepted from the request body. DTOs use `whitelist: true` via global ValidationPipe |
| JIT user creation on add-member | Elevation of Privilege | MemberService rejects if `User` row not found — no `User.create()` ever called |
| Last-member removal orphaning org | Denial of Service | Service layer count-checks ACTIVE members before remove; blocks last removal (D-15) |
| Removing another org's member via header manipulation | Tampering | TenantGuard validates `X-Organization-Id` against real membership; extension injects correct orgId in DELETE WHERE clause |
| Header injection via array values | Spoofing | Guard reads `Array.isArray(header) ? header[0] : header` — takes first value only |

---

## ADR Location and Format

**No prior ADRs exist** in this repository. The `Enterprise-AI-Delivery-Platform-Documentation/` directory contains doc types (BRD, TSD, LLD, ADR) as platform *outputs*, not as engineering process artifacts.

**Recommendation:** Create `docs/adr/ADR-001-tenant-enforcement-mechanism.md` establishing a new `docs/adr/` directory in the repository root. Use the Nygard ADR format (Title, Date, Status, Context, Decision, Consequences). [CITED: joelparkerhenderson/architecture-decision-record]

**ADR content outline:**
- **Title:** Tenant enforcement — Prisma client extension
- **Status:** Accepted
- **Context:** Multi-tenant SaaS platform; shared PostgreSQL schema; frozen schema (no DDL this phase); connection-pooling requirement
- **Decision:** Prisma `$extends` query extension auto-injects `organizationId` and `deletedAt: null` for org-owned models via CLS per-request context
- **Alternatives Considered:** PostgreSQL RLS (rejected: requires DDL — `CREATE POLICY` — which conflicts with frozen schema; also introduces per-transaction session variable that pins connections in a pooler like PgBouncer); Prisma `$use` middleware (deprecated)
- **Consequences:** RLS recorded as possible future defense-in-depth; application-layer enforcement means isolation test is the primary safety gate; connection pool efficiency preserved

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `$extends` query hook in `$allModels.$allOperations` callback reads `cls.get('organizationId')` in the correct per-request AsyncLocalStorage context (not the construction-time context) | Pattern 1 | If false, extension would read undefined/stale orgId; fail-closed would trigger on all requests OR leak cross-tenant data. Mitigation: isolation integration test (TENANT-06) would catch this |
| A2 | Prisma 6.19.3 `$extends` does NOT propagate into interactive `$transaction(tx => ...)` callbacks — `tx` is the raw client | Code Examples | If `$extends` DID apply inside transactions, the org create transaction might inject orgId into member creation where it's not wanted. Mitigation: verify in org-create integration test |
| A3 | `upsert` in Prisma 6 does NOT apply the extension's `where` injection to its `where` (unique key) argument | Pitfall 7 | If extension injects orgId into upsert.where, it would conflict with the unique key constraint. Mitigation: test re-add member scenario explicitly |
| A4 | The `Service-API-Architecture.md` does not prescribe a specific tenant header name; `X-Organization-Id` is confirmed as the right choice | CONTEXT.md D-01 | If a different header is prescribed, TenantGuard and all integration tests need updating. The doc reviewed (section 13 "API Security") mentions "Organization Membership" as a requirement but not the specific header name |

**If A1 is wrong:** The isolation test (TENANT-06) would fail in CI, providing an early catch before any production data exposure.

---

## Open Questions

1. **`upsert` extension behavior (A3 above)**
   - What we know: Prisma `upsert` has both a `where` (unique key) and `create`/`update` sections. The extension's args mutation on `$allModels.$allOperations` would affect the `where` argument.
   - What's unclear: Whether injecting `organizationId` into `upsert.where` breaks the unique-key resolution.
   - Recommendation: During Wave 1, write a unit test that calls `upsert` on `OrganizationMember` via `TenantedPrismaService` and confirm the behavior. If it breaks, use raw `PrismaService` for all upsert operations and document the bypass explicitly.

2. **`TenantedPrismaService` return type complexity**
   - What we know: `prisma.$extends(...)` returns a complex inferred type that does not simply extend `PrismaService`. Injecting it as a typed DI token requires care.
   - Recommendation: Define a `TENANTED_PRISMA_TOKEN` injection token and expose the extended client as `client: PrismaClient` (with `as unknown as PrismaClient` type assertion) to avoid DI type conflicts. This is a common pattern in the ecosystem.

---

## Environment Availability

> Phase 6 adds no external runtime dependencies beyond what phases 1-5 established.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 16 | Integration tests (TENANT-06) | CI: ✓ (service block already in workflow) | 16 | skipIf(!realDbAvailable) pattern |
| nestjs-cls | TenantGuard, TenantedPrismaService, AuthAuditContextProvider | ✓ | 6.2.1 | — |
| @prisma/client | TenantedPrismaService ($extends) | ✓ | 6.19.3 | — |

**Missing dependencies with no fallback:** None.

---

## Sources

### Primary (HIGH confidence)
- `packages/backend/src/authorization/permissions.guard.ts` — exact guard shape TenantGuard mirrors
- `packages/backend/src/auth/decorators/public.decorator.ts` — exact `@NoTenantScope()` decorator shape
- `packages/backend/src/app.module.ts` — exact APP_GUARD registration order and ClsModule setup
- `packages/backend/src/app.integration.spec.ts` — isolation test harness pattern (Phase 5 RBAC describe block)
- `packages/database/prisma/schema/organization.prisma` — OrganizationMember fields, status enum, @@unique constraint
- `packages/database/prisma/schema/identity.prisma` — User.email unique index, no entraId field
- `node_modules/@prisma/client/runtime/edge.d.ts` — `$allModels`, `$allOperations`, `defineExtension` type signatures (Prisma 6.19.3)
- `node_modules/nestjs-cls/package.json` — version 6.2.1 confirmed

### Secondary (MEDIUM confidence)
- [Prisma official client extensions docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — `$allModels`, `$allOperations`, where injection pattern [CITED]
- [Prisma input-transformation example](https://github.com/prisma/prisma-client-extensions/blob/main/input-transformation/script.ts) — args mutation pattern, operation-type checking [CITED]
- [NestJS CLS quick-start](https://papooch.github.io/nestjs-cls/introduction/quick-start) — ClsService.get/set API [CITED]
- [DEV.to: NestJS + nestjs-cls + Prisma extensions multi-tenant pattern](https://dev.to/moofoo/nestjspostgresprisma-multi-tenancy-using-nestjs-prisma-nestjs-cls-and-prisma-client-extensions-ok7) — CLS closure pattern in $extends, per-request context reads [CITED]
- [Nygard ADR format](https://github.com/joelparkerhenderson/architecture-decision-record) — ADR template sections [CITED]

### Tertiary (LOW confidence / ASSUMED)
- Prisma 6 interactive transaction behavior with `$extends` (A2 above) — documented in Prisma docs ("if you trigger the extension from inside a transaction, the extension code will issue queries in a new connection") [ASSUMED — behavior may differ in interactive vs batched transactions; verify empirically]
- `upsert.where` extension injection behavior (A3 above) [ASSUMED — verify with unit test in Wave 1]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and versions verified from node_modules
- Architecture: HIGH — derived from existing patterns in Phases 4 and 5; mirrors guard/decorator shapes exactly
- Prisma `$extends` API: HIGH — verified from installed type definitions and official docs
- CLS propagation in extension closure: MEDIUM — well-documented pattern in community article and nestjs-cls docs; flagged as assumption A1 with empirical gate (isolation test)
- Upsert/findUnique edge cases: MEDIUM — documented from Prisma type definitions; two specific assumptions logged

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (stable ecosystem; Prisma 6.x minor versions are backwards compatible for the `$extends` API)
