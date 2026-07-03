# ADR-001 — Tenant Enforcement Mechanism: Prisma Client Extension

Date: 2026-07-03
Status: Accepted

---

## Context

This platform is a multi-tenant SaaS system with a shared PostgreSQL schema where multiple organizations access the same database tables. The schema is frozen for this milestone (no DDL changes permitted). Connection pooling (PgBouncer or equivalent) is a deployment requirement. The tenant context (organizationId) is available per-request via NestJS CLS (AsyncLocalStorage), populated by `TenantGuard` after validating ACTIVE organization membership.

We need a mechanism to enforce organization-level data isolation at the database access layer so that no application code path can accidentally query another tenant's data. The selected mechanism must satisfy:

1. No DDL required — schema remains unchanged.
2. Connection-pooling-safe — no session-variable dependencies.
3. Testable with the application's existing Vitest + NestJS integration test harness.
4. Fail-closed — an absent organizationId must produce an error, not a silent full-table read.

---

## Decision

The tenant enforcement mechanism is a **Prisma client extension (`$extends`)** that wraps the existing singleton `PrismaService`. The extension registers an `$allModels.$allOperations` query hook via a closure over `ClsService`.

At query execution time, the hook:

1. Checks whether the queried model is in `ORG_SCOPED_MODELS` (models with a direct `organizationId` FK).
2. Skips injection for write operations with no `where` clause (`create`, `createMany`, `createManyAndReturn`) and for unique-key operations (`findUnique`, `findUniqueOrThrow`) where Prisma's type system enforces that only unique-constraint fields appear in `where`.
3. Reads `organizationId` from the request's AsyncLocalStorage store via `ClsService`.
4. Auto-injects `WHERE organizationId = {orgId} AND deletedAt IS NULL` into eligible operations.

**Fail-closed (D-08):** If `organizationId` is `undefined` in CLS when a scoped-model query runs, the hook throws `ForbiddenException(TENANT.NO_ORG_CONTEXT)` rather than proceeding without the scope. This prevents silent full-table reads in any scenario where `TenantGuard` has not yet populated the CLS context.

**Implementation:** `packages/backend/src/tenancy/tenanted-prisma.service.ts`

**Primary acceptance gate (D-06, TENANT-06):** The two-organization integration test in `packages/backend/src/app.integration.spec.ts` (describe `'Tenant Isolation (real DB) (TENANT-06)'`) proves this decision works at the HTTP + DB + Prisma extension layer — not just in unit tests. Six test cases cover: allow, cross-tenant deny, isolation proof, missing header, non-ACTIVE membership, and create-org happy path. If the `$extends` mechanism is broken or bypassed, these tests fail CI.

---

## Alternatives Considered

### 1. PostgreSQL Row-Level Security (RLS)

**Rejected for this phase.**

RLS requires DDL (`CREATE POLICY` statements per table) which conflicts with the frozen schema constraint. Additionally, RLS requires `SET LOCAL app.tenant_id = '{id}'` per transaction to pass the tenant context to Postgres. PgBouncer in transaction mode cannot reset `SET LOCAL` between client connections, pinning connections and degrading pool efficiency.

**Recorded as future defense-in-depth:** PostgreSQL RLS remains a valid future option to add DB-enforced row security as a second layer behind the Prisma extension. If the Prisma extension is bypassed (e.g., via raw SQL or a misconfigured service injecting the plain `PrismaService` instead of `TenantedPrismaService`), RLS would provide an independent enforcement layer. This would require a schema migration phase to add the policies and a Postgres-level mechanism for tenant context propagation compatible with the chosen connection pooler.

### 2. Prisma `$use` middleware

**Rejected.** Deprecated in Prisma 5, removed in Prisma 6. The `$extends` API is the only supported extension mechanism in Prisma 6.19.3 (the version in use).

### 3. Request-scoped PrismaClient instance per tenant

**Rejected.** Creates a new connection per request, exhausting the connection pool under load and eliminating connection reuse benefits. Incompatible with the deployment's connection pooling requirement.

---

## Consequences

### Positive

- No DDL required; schema remains unchanged.
- Connection pool efficiency preserved — the extension wraps the singleton client with no per-request connection management overhead.
- Enforcement is testable with the existing Vitest + real-DB integration test harness.
- Fail-closed by design: missing org context produces a `ForbiddenException` (TENANT.NO_ORG_CONTEXT), never a silent data leak.

### Negative / Mitigated

- Enforcement lives in application code — the isolation test (TENANT-06) is the primary safety gate rather than a DB-enforced row security policy. PostgreSQL RLS remains as a future defense-in-depth option to add DDL-based enforcement behind the application layer.
- Operations that bypass `TenantedPrismaService` (i.e., services that inject raw `PrismaService` directly) are excluded from auto-injection. These cases require explicit documentation and are auditable via codebase search for `PrismaService` injection points. Examples of intentional bypasses: `OrganizationRepository` (the Organization entity has no `organizationId` FK — it is the root entity), `MemberRepository.upsertMember` (upsert's unique-key clause conflicts with the extension's `where` injection — RESEARCH A3), and `TenantGuard` itself (bootstraps the CLS context that `TenantedPrismaService` reads — using the scoped client in the guard would create a circular dependency at query time, D-08 Pitfall 4).
- `findUnique` and `findUniqueOrThrow` operations are excluded from auto-injection due to Prisma's type-level unique-key constraint enforcement. Repositories must use `findFirst` for all org-scoped lookups.
