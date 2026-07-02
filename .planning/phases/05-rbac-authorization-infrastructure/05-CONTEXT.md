# Phase 5: RBAC Authorization Infrastructure - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce the seeded permissions on protected endpoints through a `@RequirePermissions()` decorator and a globally-registered `PermissionsGuard` that resolves a principal's effective permissions from the database and returns **403** when a required permission is absent — deciding authorization **independently of authentication** (no authN/authZ conflation).

**In scope (RBAC-01 through RBAC-04):**
- `@RequirePermissions(...codes)` decorator declaring the permission codes an endpoint needs (RBAC-01)
- `PermissionsGuard` that resolves permissions from the seeded **16 permissions / 4 roles** in the DB and enforces them (RBAC-02)
- Guard registered as a global `APP_GUARD` executing **after** `JwtAuthGuard`, establishing the chain **Authentication → RBAC → Tenancy** (RBAC-03; the Tenancy link is added in Phase 6)
- Authorization decided purely from the resolved permission set, never from authentication state (RBAC-04)
- Resolution path: `CurrentUser.email → User (by unique email) → UserRole → Role → RolePermission → Permission.code`, excluding soft-deleted (`deletedAt`) and expired (`expiresAt`) `UserRole` rows

**Out of scope (defer to later phases):**
- Request-scoped tenant/actor context and org-scoped narrowing of permissions — Phase 6 (a tightening seam is left here; see D-01)
- JIT `User` provisioning / writing identity rows on request — deferred (schema frozen; D-04 from Phase 4 still holds: unknown user ⇒ empty permissions ⇒ deny)
- Adding an `entraId` column or any schema change — frozen this milestone
- OR-mode matching, role-name bypass, permission hierarchy expansion — explicitly rejected this phase (D-02, D-03)
- Cross-request permission caching — not now (D-08 memoizes within a request only)

</domain>

<decisions>
## Implementation Decisions

### Permission resolution & org scoping (RBAC-02, RBAC-03)
- **D-01:** The guard resolves the **union of permissions across ALL the user's active memberships**, **org-agnostic** this phase (no `organizationId` filter on the query). Rationale: `Role`/`Permission` rows are org-scoped, but `CurrentUser` carries no `organizationId` and RBAC-03 orders **RBAC before Tenancy** — so the guard cannot depend on a resolved org yet. This phase answers "does this user hold this capability at all." **A documented Phase-6 tightening seam is required:** once tenant context exists, permission resolution narrows to the active organization. Leave a clear extension point (not a TODO scattered in code) so Phase 6 tightens without restructuring.
- **D-04 (carried from Phase 4):** **Fail-closed.** If no `User` row matches `CurrentUser.email`, or the user has no (non-expired, non-deleted) roles, the effective permission set is **empty** ⇒ any `@RequirePermissions()` endpoint returns 403. No DB writes, no provisioning during authorization.
- **D-07:** The resolution query MUST exclude `UserRole` rows where `deletedAt` is set or `expiresAt` is in the past, and MUST exclude soft-deleted `Role`/`RolePermission`/`Permission` rows. Time-expiry uses request time.

### Match & hierarchy semantics (RBAC-01)
- **D-02:** When `@RequirePermissions()` lists multiple codes, semantics are **AND — the principal must hold every listed code**. Endpoints declare exactly what they need. No OR mode this phase; add one only if a concrete endpoint later requires it.
- **D-03:** **No role-name bypass and no permission hierarchy.** Matching is **exact permission-code** only; `resource:manage` does NOT imply `resource:read`. `Platform Administrator` passes naturally because it already holds all 16 seeded codes via `RolePermission` data — the guard stays fully **data-driven** with the seeded `RolePermission` table as the single source of truth. No hardcoded super-role (avoids an un-auditable backdoor).

### Enforcement scope & guard wiring (RBAC-03, RBAC-04)
- **D-05:** `PermissionsGuard` registers as a global `APP_GUARD` in `AppModule`, ordered **after** `JwtAuthGuard` (chain: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`). It reads required codes via `Reflector.getAllAndOverride` over handler + class. Endpoints with **no** `@RequirePermissions()` metadata are **not** gated by RBAC (authentication alone suffices) — the guard only enforces when the decorator is present. `@Public()` endpoints bypass RBAC entirely (no principal to authorize).
- **D-06:** Authorization derives **solely** from the resolved permission set, never from authentication state — a fully authenticated principal lacking the code is still denied 403 (RBAC-04). authN failure is 401 (JwtAuthGuard); authZ failure is 403 (PermissionsGuard).

### Dev/test permission strategy
- **D-09:** **Per-test DB fixtures, no authorization bypass.** Integration tests insert real `User` + `OrganizationMember` + `UserRole` rows to exercise the actual guard path for **both** allowed and denied cases. The guard is **fail-closed in every mode** — `AUTH_MODE=stub` grants a principal but **never** grants permissions (no stub short-circuit, no backdoor). A clearly dev-only seed helper MAY be provided for manual local work but MUST stay out of the production seed in `packages/database`.

### Resolution performance (RBAC-02)
- **D-08:** **One indexed query per request**, result **memoized in the request-scoped CLS store** (`nestjs-cls`, already global) so repeated permission checks within the same request reuse it. **No cross-request cache** this phase — correctness first; role/permission changes take effect immediately. A cross-request caching seam can be added later if load demands it.

### Claude's Discretion
- Exact module/file placement: RBAC is cross-cutting infrastructure like auth — either extend `src/auth/` or add a sibling `src/authorization/` (or `src/rbac/`) module. Keep it leaf-level (depends on `AppConfigModule` + `PrismaService`/`@repo/database` only) to avoid cyclic DI, mirroring the Phase 4 `AuthModule` constraint.
- Exact shape of `@RequirePermissions()` (variadic `string[]` of permission codes) and the metadata key.
- Exact query form (single Prisma query with nested `where`/`select` vs a focused join) — optimize for the indexed `User.email` unique lookup and the `UserRole`/`RolePermission` indexes that already exist; avoid N+1.
- The CLS key used to store/read the memoized permission set.
- The 403 body reuses the established error envelope `{ success, errorCode, message, traceId }` from the `GlobalExceptionFilter`; pick an appropriate `errorCode` from the existing catalog (or add one via `createErrorCatalog`) — do NOT leak which permission was missing beyond an actionable, non-sensitive message.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Authorization (RBAC)" — RBAC-01 through RBAC-04 (authoritative requirement text)
- `.planning/ROADMAP.md` § "Phase 5: RBAC Authorization Infrastructure" — goal + 4 success criteria (deny-403, DB-resolved from seeded 16/4, guard order, no authN/authZ conflation)
- `.planning/PROJECT.md` § Constraints / Context — least-privilege RBAC, frozen schema (additive-only), never expose internal IDs/stack traces, layering constraint

### Prior phase context (decisions this phase extends)
- `.planning/phases/04-authentication-entra-id-infrastructure/04-CONTEXT.md` — **D-01/D-02** (`CurrentUser` = `{ entraId, email, tenantId, displayName }`, carries **no** roles/permissions — Phase 5 owns resolution), **D-04** (no DB writes on request; unknown user ⇒ empty permissions ⇒ fail-closed; guard looks up `User` by email), **D-09** (`JwtAuthGuard` global `APP_GUARD` after `ThrottlerGuard` — `PermissionsGuard` chains after it)

### Database (schema is frozen — read to build the resolution query)
- `packages/database/prisma/schema/identity.prisma` — `User` (unique `email`, no `entraId`), `Role` (org-scoped, `@@unique([organizationId, name])`), `Permission` (org-scoped, `code`, `@@unique([organizationId, code])`), `UserRole` (has `expiresAt`, `deletedAt`; `@@unique([organizationMemberId, roleId])`; indexed on `userId`/`roleId`), `RolePermission`
- `packages/database/prisma/seed.ts` — the seeded **16 permission codes** (`organization:read`, `project:manage`, `documentation:approve`, …) and **4 roles** (Platform Administrator = all 16; Engineering Manager; Developer = default; Reviewer). **No `User`/`OrganizationMember`/`UserRole` rows are seeded** — tests must create them (D-09)

### Current codebase state (what Phase 5 builds on)
- `packages/backend/src/app.module.ts` — `APP_GUARD` registration order (`ThrottlerGuard` → `JwtAuthGuard`); add `PermissionsGuard` after `JwtAuthGuard`
- `packages/backend/src/auth/decorators/public.decorator.ts` — `@Public()` = `SetMetadata`; RBAC must honor it (public ⇒ skip)
- `packages/backend/src/auth/decorators/current-user.decorator.ts` + `current-user.type.ts` — principal the guard reads (`request.user` / CLS)
- `packages/backend/src/common/exceptions/global-exception.filter.ts` + `error-codes.ts` + `common/error-catalog/create-error-catalog.ts` — 403 envelope + error-code source
- `ClsService` (`nestjs-cls`, global via `ClsModule.forRoot`) — memoize resolved permissions per request (D-08)
- `@repo/database` `PrismaService` (global) — the only Prisma access path

### Authoritative design (RBAC / API security)
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — API security / authorization conventions; confirm any prescribed permission-check or error-response shape
- `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-II-Business-Domains.md` — Identity/Access domain model (roles, permissions, memberships) to confirm the resolution semantics match the design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@Public()` decorator + `Reflector.getAllAndOverride` pattern (from `JwtAuthGuard`) — reuse the exact metadata-reading pattern for `@RequirePermissions()`.
- `ClsService` — store the memoized effective-permission `Set<string>` per request (D-08); already globally available, no new wiring.
- `PrismaService` via `@repo/database` — single indexed query for resolution; `User.email` is unique, `UserRole` is indexed on `userId`.
- `GlobalExceptionFilter` + error-code catalog — produce the standard 403 envelope without leaking sensitive detail.

### Established Patterns
- Global cross-cutting guard = `APP_GUARD` provider in `AppModule.providers[]`, executed in registration order (Phase 4 precedent).
- Decorator = `SetMetadata`; guard reads via `Reflector` over `[handler, class]` (Phase 4 `@Public()` precedent).
- Leaf-level module to avoid cyclic DI (Phase 4 `AuthModule` constraint) — RBAC module depends only on config + Prisma.
- Abstract-class-as-DI-token precedent (`TokenValidator`, `IAuditContextProvider`) is available if a swappable permission-resolver seam is wanted.

### Integration Points
- `AppModule.providers[]` gains `{ provide: APP_GUARD, useClass: PermissionsGuard }` immediately after the `JwtAuthGuard` registration.
- Guard consumes `request.user` (the `CurrentUser` set by `JwtAuthGuard`) — establishes the runtime chain Auth → RBAC.
- A demo/protected endpoint (or the existing scaffolding) annotated with `@RequirePermissions('organization:read')` proves allow + deny in integration tests.

### Landmines
- **N+1 / heavy query:** resolve permissions in a single query; avoid loading roles then permissions separately per request.
- **Order dependency:** `PermissionsGuard` MUST run after `JwtAuthGuard` — if registered before, `request.user` is undefined and every check fails or throws. Verify registration order explicitly.
- **`@Public()` interaction:** public endpoints have no principal — RBAC must short-circuit for them (mirror the guard's own public check), else public routes 403.
- **Stub backdoor:** do NOT grant permissions in `AUTH_MODE=stub`. Stub authenticates only; authorization stays DB-driven and fail-closed (D-09).
- **Frozen schema:** no `entraId` column — resolution keys on `email`. Do not attempt schema changes.
- **Info leak:** the 403 message must be actionable but must not disclose which internal permission/role/ID was missing beyond a safe, generic statement.

</code_context>

<specifics>
## Specific Ideas

- Decorator: `@RequirePermissions('organization:read', 'project:manage')` — variadic permission codes; AND semantics (all required).
- Effective permissions resolved as a `Set<string>` of `Permission.code`, memoized in CLS per request.
- Guard verdicts: missing/invalid token ⇒ 401 (JwtAuthGuard); authenticated but missing code ⇒ 403 (PermissionsGuard); no decorator ⇒ pass; `@Public()` ⇒ pass.
- Resolution filters: `UserRole.deletedAt = null AND (expiresAt = null OR expiresAt > now)`, plus soft-delete filters on joined `Role`/`RolePermission`/`Permission`.
- Phase-6 seam: a single, clearly-named extension point where org-scoped narrowing will slot in once tenant context exists.

</specifics>

<deferred>
## Deferred Ideas

- **Org-scoped permission narrowing** — Phase 6. Once request-scoped tenant/actor context exists, tighten resolution from the union-across-memberships to the active organization. The seam is defined this phase (D-01).
- **JIT `User` provisioning + `entraId` schema column** — deferred (schema frozen; additive migration + provisioning is a Phase 6+ concern per Phase 4 D-04).
- **OR-mode / `mode: 'any'` matching** — not built; add only when a concrete endpoint needs it (D-02).
- **Cross-request permission caching** — not built; add if load justifies it (D-08).
- **Standing seeded dev/admin user** — rejected for the production seed; tests use per-test fixtures, dev uses an optional out-of-band helper (D-09).

None of the above are scope creep — all are roadmap-defined later phases or explicitly-reserved seams.

</deferred>

---

*Phase: 5-RBAC Authorization Infrastructure*
*Context gathered: 2026-07-02*
