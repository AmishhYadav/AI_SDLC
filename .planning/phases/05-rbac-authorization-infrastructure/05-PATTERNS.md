# Phase 5: RBAC Authorization Infrastructure - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 8 (6 new, 2 modified)
**Analogs found:** 7 / 8 (the permission-resolution Prisma query has no existing analog)

> Layout note: Phase 4 auth code lives **flat** in `src/auth/` (guard at `src/auth/jwt-auth.guard.ts`, decorators under `src/auth/decorators/`). There is **no** `src/auth/guards/` directory. This PATTERNS map assumes RBAC mirrors that flat, leaf-level layout in a sibling `src/authorization/` module (Claude's Discretion in CONTEXT D-50). Planner may keep it in `src/auth/` instead — the analogs are identical either way.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/authorization/decorators/require-permissions.decorator.ts` | decorator | request-response (metadata) | `src/auth/decorators/public.decorator.ts` | exact |
| `src/authorization/permissions.guard.ts` | guard/middleware | request-response | `src/auth/jwt-auth.guard.ts` | exact |
| `src/authorization/permission-resolver.service.ts` | service | CRUD (read) + memoize | `src/auth/entra-token-validator.ts` (async resolve) + `jwt-auth.guard.ts` (CLS) | role-match; query is novel |
| `src/authorization/authorization.module.ts` | config/module | n/a | `src/auth/auth.module.ts` | exact |
| `src/authorization/authorization-error-codes.ts` | config (error catalog) | n/a | `src/common/exceptions/error-codes.ts` + `create-error-catalog.ts` | exact |
| `src/app.module.ts` (**modify**) | config | n/a | `src/app.module.ts` (its own `APP_GUARD` block) | exact |
| `src/authorization/permissions.guard.spec.ts` | test (unit) | n/a | `src/auth/jwt-auth.guard.spec.ts` | exact |
| `src/app.integration.spec.ts` (**modify**) | test (integration) | n/a | `src/app.integration.spec.ts` (Phase 4 describe blocks) | exact |

## Pattern Assignments

### `src/authorization/decorators/require-permissions.decorator.ts` (decorator, metadata)

**Analog:** `src/auth/decorators/public.decorator.ts` (full file)

The `@Public()` decorator is the exact `SetMetadata` shape to mirror. `@RequirePermissions()` is variadic (D-51/spec) and exports a metadata key the guard reads:

```typescript
// public.decorator.ts (verbatim analog)
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
```

RBAC variant (variadic codes, AND semantics per D-02):
- Export a key like `REQUIRE_PERMISSIONS_KEY = 'requiredPermissions'`.
- `export const RequirePermissions = (...codes: string[]): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSIONS_KEY, codes);`
- Store `string[]`; empty/absent metadata ⇒ guard does not gate (D-05).

---

### `src/authorization/permissions.guard.ts` (guard, request-response)

**Analog:** `src/auth/jwt-auth.guard.ts` (full file, 60 lines)

This is the primary pattern. Copy the `CanActivate` shape, the `Reflector.getAllAndOverride([handler, class])` metadata read, the `@Public()` short-circuit, and the `request.user` / CLS access. Adapt the verdict from 401→403.

**Class + DI shape** (lines 16-23):
```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenValidator: TokenValidator,
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
    private readonly cls: ClsService,
  ) {}
```
RBAC guard injects `Reflector`, the `PermissionResolverService`, and (optionally) `ClsService` — resolver owns memoization; keep the guard thin (CLAUDE.md §6: controllers/guards orchestrate, service holds logic).

**Metadata read + short-circuit** (lines 26-31) — mirror twice: once for `@Public()`, once for required-permissions absence:
```typescript
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;
```
RBAC guard: read `IS_PUBLIC_KEY` first (`return true` if public — landmine: public routes have no principal), then read `REQUIRE_PERMISSIONS_KEY`; if absent/empty `return true` (D-05: no decorator ⇒ not gated).

**Reading the principal** (lines 33-36):
```typescript
const request = context.switchToHttp().getRequest<{
  headers: Record<string, string | string[] | undefined>;
  user?: CurrentUser;
}>();
```
RBAC guard reads `request.user` (`CurrentUser`, set by `JwtAuthGuard` — see `current-user.type.ts`, key field is `email`). Landmine: if `request.user` is undefined the guard registration order is wrong; fail-closed to 403 rather than throwing (D-04).

**Verdict + exception** (lines 48-49) — swap `UnauthorizedException` (401) for `ForbiddenException` (403):
```typescript
if (!rawToken) {
  throw new UnauthorizedException('AUTH.MISSING_TOKEN');
}
```
RBAC: after resolving the effective `Set<string>`, if not every required code is present, `throw new ForbiddenException(<AUTHZ error code>)` (see error-codes analog below). Do NOT catch — it propagates to `GlobalExceptionFilter`, which maps `HttpStatus.FORBIDDEN`→envelope (note: `HTTP_STATUS_TO_ERROR_CODE` has no 403 entry yet; see error-codes section).

**AND matching (D-02):** `requiredCodes.every((c) => effective.has(c))`. No OR, no hierarchy (D-03) — exact code membership only.

---

### `src/authorization/permission-resolver.service.ts` (service, read query + CLS memoize)

**Analog (async resolve shape):** `src/auth/entra-token-validator.ts` — an `@Injectable()` that does async work and returns a domain value.
**Analog (CLS memoization):** `src/auth/jwt-auth.guard.ts` line 56 (`this.cls.set('user', currentUser)`) and `src/common/interceptors/response-envelope.interceptor.ts` line 36 (`this.cls.getId()`).

No existing service performs a Prisma permission-resolution query — the query itself is **novel** (see "No Analog Found"). Compose it from these pieces:

**CLS memoization pattern** — check-then-set within the request (D-08):
```typescript
// jwt-auth.guard.ts:56 — write
this.cls.set('user', currentUser);
// response-envelope.interceptor.ts:36 — read
traceId: this.cls.getId(),
```
Resolver: `const cached = this.cls.get<Set<string>>(PERMISSIONS_CLS_KEY); if (cached) return cached;` then run the query once, `this.cls.set(PERMISSIONS_CLS_KEY, resolved)`, return. Pick a clearly-named key (Claude's Discretion D-53), e.g. `'effectivePermissions'`.

**Prisma access:** inject `PrismaService` from `@repo/database` (global; imported in `app.module.ts:3` as `PrismaModule`). Single query keyed on the unique `User.email`.

**Concrete resolution query** (real field names from `packages/database/prisma/schema/identity.prisma` + `organization.prisma`):
- `User.email` is `@@unique` (identity.prisma:56) → `where: { email }`.
- Path: `User → userRoles (UserRole[]) → role (Role) → rolePermissions (RolePermission[]) → permission (Permission)`.
- `UserRole` filters (D-07): `deletedAt: null` and `OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]` (field `expiresAt`, identity.prisma:142; `deletedAt`, :148). Uses request time `new Date()`.
- Soft-delete filters on joined rows: `Role.deletedAt: null` (:80), `RolePermission.deletedAt: null` (:178), `Permission.deletedAt: null` (:116).
- Select only `Permission.code` (identity.prisma:105) and flatten to `Set<string>`.
- **Org-agnostic this phase (D-01):** do NOT filter on `organizationId`. Relations `UserRole.user`, `role.rolePermissions`, `rolePermission.permission` are all indexed (`@@index([userId])` :160, `@@index([roleId])` :188, `@@index([permissionId])` :189) — a single nested `include`/`select` avoids the N+1 landmine.
- **Fail-closed (D-04):** no `User` match, or empty roles ⇒ empty `Set` ⇒ deny. No writes.

Sketch:
```typescript
const user = await this.prisma.user.findUnique({
  where: { email },
  select: {
    userRoles: {
      where: {
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { deletedAt: null },
      },
      select: {
        role: {
          select: {
            rolePermissions: {
              where: { deletedAt: null, permission: { deletedAt: null } },
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    },
  },
});
// flatten userRoles → role → rolePermissions → permission.code into a Set<string>
```

**Phase-6 seam (D-01):** expose org narrowing as one clearly-named boundary (e.g. a method param `organizationId?: string` currently unused, or an injectable resolver strategy) — NOT scattered TODOs. The `TokenValidator` abstract-class-as-DI-token (`src/auth/token-validator.ts`) and `IAuditContextProvider` (`src/audit/audit-context-provider.interface.ts`) are the precedent if a swappable resolver seam is wanted.

---

### `src/authorization/authorization.module.ts` (module)

**Analog:** `src/auth/auth.module.ts` (full file, 33 lines)

Leaf-level, no cyclic DI (CONTEXT established pattern; CLAUDE.md §6). Depends only on config + Prisma (both global). The guard is registered globally in `AppModule`, NOT here — this module just provides+exports the guard, resolver, and (if used) any DI token:

```typescript
@Module({
  imports: [AppConfigModule, PassportModule],
  providers: [ /* TokenValidator factory */, JwtAuthGuard, AuthAuditContextProvider ],
  exports: [TokenValidator, JwtAuthGuard, AuthAuditContextProvider],
})
export class AuthModule {}
```
RBAC variant: `imports: [AppConfigModule]` (Prisma's `PrismaModule` is `@Global`, no import needed — confirmed by `app.module.ts` global setup); `providers: [PermissionsGuard, PermissionResolverService]`; `exports: [PermissionsGuard]`. Do NOT import domain modules (CONTEXT landmine: cyclic DI).

---

### `src/authorization/authorization-error-codes.ts` (error catalog)

**Analog:** `src/common/exceptions/error-codes.ts` (verbatim) + `src/common/error-catalog/create-error-catalog.ts` (helper).

The 403 body reuses the established envelope (D-54). Two facts drive this file:

1. `GlobalExceptionFilter` `HTTP_STATUS_TO_ERROR_CODE` (`global-exception.filter.ts:14-20`) has **no `HttpStatus.FORBIDDEN` entry** → an unmapped 403 currently falls back to `INTERNAL_ERROR` (line 49). Planner must decide: add a `[HttpStatus.FORBIDDEN]: ...` mapping there, OR surface the code via the thrown exception's message. The filter reads the exception message (`global-exception.filter.ts:34-46`), so throwing `new ForbiddenException('AUTHZ.PERMISSION_DENIED')` puts the code in `message`; the `errorCode` field still needs the 403 status mapping to be non-`INTERNAL_ERROR`.

2. Create the domain code with the catalog helper (co-located, not in the platform file):
```typescript
// create-error-catalog.ts:9 signature
export function createErrorCatalog<const T extends string>(
  prefix: string, codes: readonly T[],
): { [K in T]: `${string}.${K}` }
// usage (from its own JSDoc example)
export const AUTHZ_ERROR_CODES = createErrorCatalog('AUTHZ', ['PERMISSION_DENIED'] as const);
```
**Info-leak landmine (D-54):** the message must be generic ("You do not have permission to perform this action") — never name the missing permission code, role, or internal ID.

Existing platform codes for reference (`error-codes.ts:1-7`): `RESOURCE_CONFLICT, NOT_FOUND, VALIDATION_ERROR, UNAUTHORIZED, INTERNAL_ERROR` — note there is no `FORBIDDEN`/authz code yet, so one must be added.

---

### `src/app.module.ts` (MODIFY — guard registration)

**Analog:** the existing `APP_GUARD` block in the same file (lines 113-118).

```typescript
{ provide: APP_GUARD, useClass: ThrottlerGuard },
// D-09 (Phase 4): JwtAuthGuard is second — ThrottlerGuard runs first ...
{ provide: APP_GUARD, useClass: JwtAuthGuard },
```
Add `{ provide: APP_GUARD, useClass: PermissionsGuard }` **immediately after** the `JwtAuthGuard` line (D-05 order: `ThrottlerGuard → JwtAuthGuard → PermissionsGuard`). Add the import next to line 20 (`import { JwtAuthGuard } from './auth/jwt-auth.guard';`) and add `AuthorizationModule` to `imports` (line 89, after `AuthModule`). **Order landmine:** registering before `JwtAuthGuard` makes `request.user` undefined and every check fails.

---

### `src/authorization/permissions.guard.spec.ts` (unit test)

**Analog:** `src/auth/jwt-auth.guard.spec.ts` (full file, 96 lines)

Copy the whole harness: `vitest` imports, `vi.fn()`-mocked deps, the `buildMockContext(headers)` factory (returns `{ mockContext, mockRequest }`), and `new Guard(...mocks as never)` construction.

**Mock deps** (lines 10-13) — RBAC needs reflector + resolver mocks:
```typescript
const mockReflector = { getAllAndOverride: vi.fn() };
```
**Context factory** (lines 27-31) — reuse; the guard reads handler/class + `request.user`:
```typescript
const mockContext = {
  switchToHttp: () => ({ getRequest: () => mockRequest }),
  getHandler: () => ({}),
  getClass: () => ({}),
} as unknown as ExecutionContext;
```
Required cases (mirror the `@Public()` bypass test at lines 48-56): (a) `@Public()` ⇒ true, no resolver call; (b) no `@RequirePermissions` metadata ⇒ true; (c) has all codes ⇒ true; (d) missing a code ⇒ `ForbiddenException`; (e) `request.user` undefined ⇒ deny (fail-closed).

---

### `src/app.integration.spec.ts` (MODIFY — add RBAC describe block)

**Analog:** the Phase 4 describe blocks in the same file (lines 303-430), esp. `AuthTestController` (lines 55-69) and the stub-auth request pattern (lines 393-401).

D-09 requires **real DB fixtures, no bypass**. Note the current file uses `MockPrismaModule` (lines 26-31) — the RBAC allow/deny tests need a **real** `PrismaService` (or a resolver stub backed by seeded data) because they exercise the actual query. Planner decides: real DB test (insert `User` + `OrganizationMember` + `UserRole` rows, then `deleteMany` cleanup) vs. overriding `PermissionResolverService`. Per D-09, prefer real rows so the guard path (query + AND match + 403) is genuinely exercised.

**Test controller pattern** (lines 55-69) — add an RBAC-annotated route:
```typescript
@Controller({ path: 'auth-test', version: '1' })
class AuthTestController {
  @Get('protected')
  protectedRoute(@GetCurrentUser() user: CurrentUser | null) { ... }
}
```
RBAC variant: `@Get('rbac') @RequirePermissions('organization:read') rbacRoute() {...}`.

**Stub-auth request + assertions** (lines 393-401, 331-338) — allow returns 200, deny returns 403 envelope:
```typescript
const { status, body } = await request(app.getHttpServer())
  .get('/api/v1/auth-test/rbac')
  .set('x-dev-user', 'user@test.com');
// deny case: expect(status).toBe(403); expect(body.success).toBe(false);
//            expect(body.errorCode).toBe('AUTHZ.PERMISSION_DENIED');
```
**Stub-backdoor landmine (D-09):** `AUTH_MODE=stub` (test default, line 20) authenticates but must grant **zero** permissions — a stub user with no seeded `UserRole` rows must get 403, proving no bypass.

Real seeded codes to assert against (from `packages/database/prisma/seed.ts:11-28`, 16 total): `organization:read`, `organization:manage`, `project:read`, `project:manage`, `repository:read`, `repository:manage`, `work-item:read`, `work-item:manage`, `documentation:read`, `documentation:approve`, `development:execute`, `validation:execute`, `testing:execute`, `delivery:manage`, `ai-platform:manage`, `audit:read`. Roles (seed.ts:30-79): `Platform Administrator` (all 16), `Engineering Manager`, `Developer` (isDefault), `Reviewer`. Use `Developer` (has `organization:read`) for the allow case and `Reviewer` vs a manage-only code for a deny case.

---

## Shared Patterns

### Reflector metadata read over [handler, class]
**Source:** `src/auth/jwt-auth.guard.ts:26-31` (also `response-envelope.interceptor.ts:17-20`)
**Apply to:** `PermissionsGuard` (both the `@Public()` check and the `@RequirePermissions` read)
```typescript
this.reflector.getAllAndOverride<T>(KEY, [context.getHandler(), context.getClass()]);
```

### SetMetadata decorator
**Source:** `src/auth/decorators/public.decorator.ts` (full)
**Apply to:** `@RequirePermissions()` — export a key constant + a `SetMetadata`-returning factory.

### CLS per-request memoization
**Source:** write `src/auth/jwt-auth.guard.ts:56`; read `src/common/interceptors/response-envelope.interceptor.ts:36`
**Apply to:** `PermissionResolverService` — `cls.get` / `cls.set` the effective `Set<string>` (D-08). `ClsService` is global (`app.module.ts:30-38`), no import.

### Fail-closed 403 via GlobalExceptionFilter envelope
**Source:** `src/common/exceptions/global-exception.filter.ts:52-59` (envelope) + `error-codes.ts` + `create-error-catalog.ts`
**Apply to:** `PermissionsGuard` throws `ForbiddenException`; envelope `{ success:false, errorCode, message, traceId }` is produced automatically. Must add a `HttpStatus.FORBIDDEN` mapping (filter has none) and a generic, non-leaking message.

### Leaf-level module + global APP_GUARD registration
**Source:** `src/auth/auth.module.ts` (module) + `src/app.module.ts:113-118` (registration)
**Apply to:** `AuthorizationModule` provides/exports the guard; `AppModule` registers it as `APP_GUARD` after `JwtAuthGuard`.

### Abstract-class-as-DI-token (optional seam)
**Source:** `src/auth/token-validator.ts` + `src/audit/audit-context-provider.interface.ts`
**Apply to:** the Phase-6 org-narrowing seam (D-01), if a swappable `PermissionResolver` is preferred over an unused param.

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Permission-resolution Prisma query (inside `permission-resolver.service.ts`) | service query | CRUD (read) | No existing service issues a Prisma query in `packages/backend/src` — all current services are auth/CLS/audit infra. Build the query from the real schema field names above (`User.email` unique, `UserRole.deletedAt`/`expiresAt`, joined `Role`/`RolePermission`/`Permission.deletedAt`, select `Permission.code`). Use RESEARCH.md Prisma-query guidance if present; the schema in `identity.prisma` is the source of truth. |
| Real-DB integration test with row fixtures | test | n/a | Existing integration spec uses `MockPrismaModule` (no real DB). D-09 requires real `User`/`OrganizationMember`/`UserRole` inserts. No prior real-DB test template exists — planner establishes it (seed rows in `beforeAll`, `deleteMany` in `afterAll`). |

## Metadata

**Analog search scope:** `packages/backend/src/auth/`, `packages/backend/src/common/`, `packages/backend/src/audit/`, `packages/backend/src/app.module.ts`, `packages/database/prisma/schema/`, `packages/database/prisma/seed.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-07-02
