# Phase 6: Tenancy & Organization Foundation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a **trusted, request-scoped tenant/actor context** (AsyncLocalStorage via the already-global `nestjs-cls`) populated from the authenticated principal, deliver **organization + member CRUD** that is **provably isolated across tenants**, provide an **org-scoped, soft-delete-aware `BaseRepository`** (SEAM-05), and **record the enforcement-mechanism decision as an ADR** (TENANT-07).

**In scope (TENANT-01 … TENANT-07, SEAM-05):**
- Request-scoped tenant context carrying `userId`, `organizationId`, `organizationMemberId`, always available to repositories without per-query plumbing (TENANT-01, TENANT-02).
- Active-organization resolution from the `X-Organization-Id` header, validated against ACTIVE membership by a global `TenantGuard` after RBAC (completes the Auth → RBAC → Tenancy chain).
- Organization CRUD: create (creator recorded as first member), list/read orgs the caller belongs to, and denial of orgs the caller does not belong to (TENANT-03, TENANT-04).
- Member CRUD: add existing users, list, and remove (TENANT-05).
- A two-organization isolation test proving org A never receives org B's data (TENANT-06).
- A **Prisma client extension**-based, org-scoped + soft-delete-aware `BaseRepository` for domain repositories (SEAM-05), with the enforcement decision recorded as an ADR (TENANT-07).

**Out of scope (defer to later phases):**
- **Per-org role/permission provisioning** — a brand-new org starts with zero roles; provisioning (cloning roles into new orgs) and org-scoped RBAC administration are deferred with a documented seam (see D-11).
- **PostgreSQL RLS enforcement** — the ADR selects the Prisma client extension as the mechanism now; RLS is recorded only as a possible future defense-in-depth backstop, not implemented this phase (D-05).
- **Just-in-time User provisioning** — no `User` rows are created on request (carried from Phase 4 D-04); add-member operates on existing users only (D-13).
- **Applying the RBAC org-narrowing seam** — RBAC stays org-agnostic (union across memberships); `PermissionResolverService.resolve(email, organizationId?)`'s `organizationId` param remains documented-but-unapplied (D-07).
- **Real invite-by-email flow / pending invites for non-existent users** — blocked by the frozen schema (`OrganizationMember.userId` is a required FK); a later phase (D-13).
- **Any schema change** — schema is frozen this milestone; all work here is runtime data + application code.

</domain>

<decisions>
## Implementation Decisions

### Active-organization resolution & tenant context (TENANT-01, TENANT-02)
- **D-01:** The active organization is declared per-request via an **`X-Organization-Id` header** — NOT the JWT. Rationale: `CurrentUser.tenantId` is the Entra **`tid`** claim (identity provider tenant), not a platform `Organization.id`; a user can be an `OrganizationMember` of many orgs, so the acting org cannot be inferred from the token. Header is transport-agnostic and uniform across all endpoints.
- **D-02:** A global **`TenantGuard`** reads `CurrentUser` + the `X-Organization-Id` header, validates the caller is an **ACTIVE** `OrganizationMember` of that org, and populates the tenant context. Missing header, non-member, or non-ACTIVE membership on a tenant-scoped route ⇒ **fail-closed** (deny). Do not leak whether the org exists vs. the caller isn't a member.
- **D-03:** The request-scoped context (stored in the global `ClsService`) carries **`userId` (User.id)** + **`organizationId`** + **`organizationMemberId`**, resolved by a single membership lookup. This one shape serves BaseRepository scoping, the RBAC org-narrowing seam, and `AuthAuditContextProvider` (which needs `userId` + `organizationId`) without re-querying.
- **D-04:** `TenantGuard` registers as a global `APP_GUARD` **after** `PermissionsGuard`, completing the documented chain **`ThrottlerGuard → JwtAuthGuard → PermissionsGuard → TenantGuard`** (Auth → RBAC → Tenancy). Org-less routes are exempted by an **opt-out decorator** `@NoTenantScope()` (a.k.a. cross-org), mirroring the Phase 4 `@Public()` precedent — enforcement is **default-on, fail-closed**; forgetting the decorator never silently disables isolation. `@Public()` routes are naturally exempt (no principal).

### Enforcement mechanism & BaseRepository (TENANT-06, TENANT-07, SEAM-05)
- **D-05 (ADR):** The tenant-enforcement mechanism is a **Prisma client extension** (`$extends`) that auto-injects `where organizationId = <ctx.organizationId>` **and** `deletedAt: null` on org-owned model queries, driving the `BaseRepository`. Rationale: no DDL (respects the frozen schema), connection-pooling-safe (no per-transaction session variable), and fully covered by the isolation test. The ADR **records PostgreSQL RLS as a future defense-in-depth option**, explicitly not implemented this phase.
- **D-06:** Phase 6 **implements the working scoping now** (not ADR-only): a real org-scoped, soft-delete-aware `BaseRepository` used by the Organization/Member repositories, with the **two-organization isolation test as the concrete acceptance gate** (TENANT-06). Nothing scoping-related is left dangling for Phase 7.
- **D-07:** **RBAC stays org-agnostic.** Because `TenantGuard` runs *after* `PermissionsGuard`, the active org is unknown at RBAC time. RBAC continues to answer "does the user hold this capability in **any** active membership" (Phase 5 shipped behavior). Org-scoping is enforced at the **data layer** (BaseRepository) where the tenant context exists. The Phase-5 D-01 narrowing seam (`resolve(email, organizationId?)`) remains **documented-but-unapplied**; the guard order in the roadmap (Auth → RBAC → Tenancy) is preserved.
- **D-08:** The client extension **scopes by default**; an **explicit, auditable unscoped path** (e.g. a raw/unscoped Prisma accessor or a `systemContext()` wrapper) is required for the few legitimate cross-org / bootstrap operations: creating an `Organization` (no parent org), `TenantGuard`'s own membership-validation lookup, and "list orgs I belong to." **Fail-closed:** no active org in CLS **and** no explicit unscoped call ⇒ error, never a silent full-table query.

### Organization creation & bootstrap (TENANT-03)
- **D-09:** **Any authenticated user** can create an organization (self-service SaaS onboarding) and becomes its first member. The create route is `@NoTenantScope()` (runs with no active org) — it cannot be gated by org-scoped RBAC without a chicken-and-egg, so it is authenticated-only.
- **D-10:** The creator is recorded as an **ACTIVE** `OrganizationMember` with `joinedAt = now()` (overriding the schema default `status = INVITED`) — no invite handshake for the creator. Membership-based auth and the isolation test both depend on ACTIVE status.
- **D-11:** **Org administration is membership-based this phase.** Because the seeded 4 roles / 16 permissions belong to the **system org only**, a new org has zero roles, and `OrganizationMember` has no owner/admin field, org + member administration is authorized by **ACTIVE membership in that org** — not org-scoped RBAC. **Per-org role provisioning (cloning roles into new orgs) is deferred** to a later phase, with a documented seam. This keeps Phase 6 in scope and avoids straining the frozen schema.

### Member lifecycle (TENANT-04, TENANT-05)
- **D-12:** Read authorization for orgs derives from membership: a caller can **list/read only orgs they are an ACTIVE member of**, and reading an org they don't belong to is denied (TENANT-04) — enforced naturally by the tenant context + BaseRepository scoping.
- **D-13:** **Add-member operates on existing Users only.** It resolves an existing `User` by email (or userId) and creates the `OrganizationMember`; if no `User` row exists, it **rejects with an actionable error** — **no JIT User creation** (honors Phase 4 D-04 + frozen `OrganizationMember.userId` FK). A real invite-by-email flow for not-yet-registered users is a later phase.
- **D-14:** **Removal is a soft-delete** — set `status = REMOVED` + `deletedAt` / `deletedBy`, consistent with the platform-wide soft-delete convention. Re-adding a soft-removed user **reactivates the existing row** (honors `@@unique([organizationId, userId])`). BaseRepository's `deletedAt: null` filter excludes removed members.
- **D-15:** **Guardrail: block removing the last ACTIVE member** of an org (prevents orphaning an unreachable, member-less org). Self-removal is otherwise allowed. This is the only removal guardrail this phase (no owner concept exists yet).

### Wiring the existing seams
- **D-16:** Wire `AuthAuditContextProvider.getContext()` to read `userId` + `organizationId` from the tenant context (CLS) instead of returning `null`, so the existing `AuditInterceptor` begins writing audit context once an org is resolved.

### Claude's Discretion
- Exact module placement — a new leaf-level `src/tenancy/` (or `src/organization/`) module, depending only on config + `PrismaService`/`ClsService` (mirror the Phase 4/5 leaf-module constraint to avoid cyclic DI).
- Exact `TenantGuard` primitive (guard vs. a guard + interceptor split) and the CLS keys used for `userId` / `organizationId` / `organizationMemberId`.
- Exact shape of the Prisma client-extension API, the `BaseRepository` abstract class surface (read vs. write scoping helpers, `findMany`/`create`/`update`/`softDelete`), and the unscoped-access accessor name.
- Exact `@NoTenantScope()` metadata key and how `TenantGuard` reads it (`Reflector.getAllAndOverride` over `[handler, class]`, per the `@Public()` precedent).
- Error-code catalog additions for tenancy denials (missing/invalid org header, non-member, last-member removal, unknown user on add-member) via `createErrorCatalog`, reusing the `{ success, errorCode, message, traceId }` envelope; keep messages actionable but non-sensitive (don't disclose org existence or internal IDs).
- REST shape of the org/member endpoints (routes, DTOs, pagination) — follow the SEAM-06 pagination/idempotency/error conventions established in the kernel phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Tenancy" — TENANT-01 through TENANT-07 (authoritative requirement text) and § "Cross-cutting Seams" SEAM-05 (org-scoped soft-delete-aware BaseRepository)
- `.planning/ROADMAP.md` § "Phase 6: Tenancy & Organization Foundation" — goal + 5 success criteria + the "highest-risk phase" research flag (isolation tests are the acceptance gate)
- `.planning/PROJECT.md` § Constraints / Context — modular-monolith + microservice-ready, frozen schema (additive-only), least-privilege, never expose internal IDs/stack traces, cross-domain DB access prohibited

### Prior phase context (decisions this phase extends)
- `.planning/phases/05-rbac-authorization-infrastructure/05-CONTEXT.md` — **D-01** (Phase-6 org-narrowing seam `resolve(email, organizationId?)`), **D-05** (guard chain / `APP_GUARD` order — `TenantGuard` chains after `PermissionsGuard`), **D-08** (CLS-memoized permission set — do not duplicate), **D-09** (fail-closed in every AUTH_MODE)
- `.planning/phases/04-authentication-entra-id-infrastructure/04-CONTEXT.md` — `CurrentUser` shape (`entraId`, `email`, `tenantId`, `displayName`) carries **no** org; **D-04** (no JIT User provisioning on request; unknown user ⇒ fail-closed)

### Database (schema is FROZEN — read to build queries & scoping)
- `packages/database/prisma/schema/organization.prisma` — `Organization` (cuid, `slug` unique, `status`, soft-delete fields; **no `entraTenantId`** — orgs are independent of Entra tenants), `OrganizationMember` (`status` INVITED/ACTIVE/SUSPENDED/REMOVED, `joinedAt?`, `@@unique([organizationId, userId])`, indexed on `organizationId`/`userId`/`status`), `Project`/`Team`/`ProjectMember`/`Repository` (org-owned models the BaseRepository will scope)
- `packages/database/prisma/schema/identity.prisma` — `User` (unique `email`, no `entraId`), `UserRole` (org-scoped via `organizationMemberId`, `expiresAt`/`deletedAt`), `Role`/`Permission` (org-scoped, seeded for the **system org only**)
- `packages/database/prisma/seed.ts` — confirms **no `User`/`OrganizationMember` rows are seeded**; isolation tests create their own org A / org B / member fixtures

### Current codebase state (what Phase 6 builds on)
- `packages/backend/src/app.module.ts` — `ClsModule.forRoot({ global: true })` setup and the `APP_GUARD` registration order (`ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`); add `TenantGuard` after `PermissionsGuard`
- `packages/backend/src/auth/current-user.type.ts` — the principal `TenantGuard` reads; note `tenantId` = Entra `tid`, NOT a platform org
- `packages/backend/src/auth/decorators/public.decorator.ts` — `@Public()` = `SetMetadata` + `Reflector.getAllAndOverride`; the exact pattern to mirror for `@NoTenantScope()`
- `packages/backend/src/auth/jwt-auth.guard.ts` — precedent for a guard that sets `request.user` **and** `cls.set('user', ...)`
- `packages/backend/src/authorization/permission-resolver.service.ts` — the documented `resolve(email, organizationId?)` org-narrowing seam (kept unapplied per D-07)
- `packages/backend/src/auth/auth-audit-context-provider.ts` — returns `null` today; D-16 wires it to CLS `userId` + `organizationId`
- `packages/backend/src/common/exceptions/global-exception.filter.ts` + `error-codes.ts` + `common/error-catalog/create-error-catalog.ts` — error envelope + code source for tenancy denials
- `@repo/database` `PrismaService` (global) — the single Prisma access path the client extension wraps

### Authoritative design (tenancy / data isolation / API contracts)
- `Enterprise-AI-Delivery-Platform-Documentation/04-Domain-Architecture/DAS-Volume-II-Business-Domains.md` — Organization/Identity domain model (org, members, roles) to confirm tenancy semantics match the design
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — API security / multi-tenancy conventions (confirm any prescribed tenant-header name, error-response shape, or org-scoping contract before finalizing the ADR)
- Data-architecture / ERD docs under `Enterprise-AI-Delivery-Platform-Documentation/` — confirm the intended multi-tenant isolation strategy the ADR must align with

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nestjs-cls` `ClsService` (global) — store the tenant context (`userId`/`organizationId`/`organizationMemberId`); already wired, no new module setup.
- `@Public()` decorator + `Reflector.getAllAndOverride([handler, class])` — copy verbatim for `@NoTenantScope()`.
- `PermissionsGuard` / `JwtAuthGuard` as global `APP_GUARD` — the precedent for registering `TenantGuard` and honoring an opt-out decorator.
- `GlobalExceptionFilter` + error-code catalog — standard `{ success, errorCode, message, traceId }` 403/40x envelope for tenancy denials.
- `PrismaService` via `@repo/database` — the client the `$extends` extension wraps for auto-scoping.

### Established Patterns
- Global cross-cutting guard = `APP_GUARD` provider executed in registration order (Phase 4/5 precedent) — `TenantGuard` goes last.
- Decorator = `SetMetadata`; guard reads via `Reflector` (Phase 4 `@Public()` precedent).
- Leaf-level module depending only on config + Prisma + CLS to avoid cyclic DI (Phase 4/5 constraint).
- Platform-wide soft-delete: every model has `deletedAt`/`deletedBy`; the BaseRepository default filter is `deletedAt: null`.

### Integration Points
- `AppModule.providers[]` gains `{ provide: APP_GUARD, useClass: TenantGuard }` immediately after the `PermissionsGuard` registration.
- `TenantGuard` consumes `request.user` (the `CurrentUser` set by `JwtAuthGuard`) — establishes the runtime Auth → RBAC → Tenancy chain.
- `AuthAuditContextProvider` reads tenant context from CLS (D-16), activating the existing `AuditInterceptor` writes.
- Organization/Member repositories extend `BaseRepository`; the two-org isolation integration test wires into CI alongside the Phase 5 RBAC integration test.

### Landmines
- **Entra tenant ≠ platform org:** never treat `CurrentUser.tenantId` (Entra `tid`) as an `Organization.id`. The active org comes only from the validated `X-Organization-Id` header.
- **Guard order:** `TenantGuard` MUST run after `JwtAuthGuard` (needs `request.user`); registered before it, every request fails.
- **Fail-open scoping:** the Prisma extension must fail-closed — no active org + no explicit unscoped call ⇒ error, never an unscoped full-table query (data leak across tenants).
- **Bootstrap/cross-org queries:** org creation, membership validation, and "list my orgs" MUST use the explicit unscoped path or they deadlock against the auto-scope (no org yet / cross-org by design).
- **Frozen schema:** no owner/admin field on `OrganizationMember`, no `entraTenantId` on `Organization`, `OrganizationMember.userId` is a required FK — design around these, do not migrate.
- **Connection pooling:** the Prisma-extension choice (over RLS) avoids per-transaction session-variable pinning; don't reintroduce a session-var dependency.
- **Info leak:** tenancy denials must not disclose whether an org exists vs. the caller isn't a member; keep messages generic + actionable.

</code_context>

<specifics>
## Specific Ideas

- Tenant header name: `X-Organization-Id` (confirm against the API-architecture doc before locking; align if the design prescribes a different header).
- Opt-out decorator name: `@NoTenantScope()` (a.k.a. cross-org) — the org-less routes are: create organization, list my organizations, and any explicitly cross-org read.
- ADR to author: "Tenant enforcement — Prisma client extension (chosen) vs PostgreSQL RLS (deferred defense-in-depth)"; place under the project's ADR location and add it to canonical refs once written.
- Isolation test intent: seed org A + org B with distinct members/data; assert a member of A, acting with `X-Organization-Id: A`, can never read B's rows through the BaseRepository — and vice versa.

</specifics>

<deferred>
## Deferred Ideas

- **Per-org role/permission provisioning** — cloning the standard roles + permissions into newly created orgs and assigning the creator an Owner/Admin role, enabling org-scoped RBAC administration. Deferred (membership-based admin used this phase); revisit when org-scoped RBAC is needed (likely Phase 7+ or a dedicated org-roles phase).
- **PostgreSQL RLS as DB-level defense-in-depth** — recorded in the ADR as a future hardening option layered atop the Prisma extension.
- **Applying the RBAC org-narrowing seam** — narrowing permission resolution to the active org; requires resolving the org before RBAC (reordering the guard chain), justified via ADR if/when per-org permission scoping is required.
- **Invite-by-email for not-yet-registered users** — pending invites + JIT/self-service User provisioning; blocked by the frozen schema this milestone.
- **Owner/admin member roles & richer removal guardrails** (transfer ownership, last-admin protection) — needs an owner concept the schema doesn't yet model.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 6-Tenancy & Organization Foundation*
*Context gathered: 2026-07-03*
