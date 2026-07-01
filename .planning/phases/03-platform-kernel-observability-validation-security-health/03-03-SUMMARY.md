---
phase: "03"
plan: "03"
subsystem: backend
tags:
  - audit-interceptor
  - seam
  - idempotency
  - error-catalog
  - nestjs
  - tdd
dependency_graph:
  requires:
    - "03-01"
  provides:
    - "@RawResponse() decorator — opts out of ResponseEnvelopeInterceptor"
    - "IAuditContextProvider seam — pluggable audit context DI token"
    - "AuditInterceptor — fire-and-forget audit write on handler success"
    - "IdempotencyStore seam — pluggable idempotency DI token with in-memory no-op"
    - "createErrorCatalog() — per-domain PREFIX.CODE error code helper"
  affects:
    - "03-04 (ResponseEnvelopeInterceptor uses RAW_RESPONSE_KEY)"
    - "03-05 (HealthController uses @RawResponse())"
    - "03-06 (AppModule wires IAuditContextProvider + NoOpAuditContextProvider)"
tech_stack:
  added: []
  patterns:
    - "Abstract class as NestJS DI injection token (not interface — survives TypeScript erasure)"
    - "Fire-and-forget .catch() for non-blocking audit writes (D-03)"
    - "Reflector.get() metadata reading in NestJS interceptors"
    - "TDD RED/GREEN cycle for interceptor unit tests with vi.fn() factory mocks"
key_files:
  created:
    - packages/backend/src/common/interceptors/raw-response.decorator.ts
    - packages/backend/src/audit/audit-context-provider.interface.ts
    - packages/backend/src/audit/noop-audit-context-provider.ts
    - packages/backend/src/audit/audit.decorator.ts
    - packages/backend/src/common/interceptors/audit.interceptor.ts
    - packages/backend/src/common/interceptors/audit.interceptor.spec.ts
    - packages/backend/src/idempotency/idempotency-store.interface.ts
    - packages/backend/src/idempotency/noop-idempotency-store.ts
    - packages/backend/src/idempotency/idempotency.decorator.ts
    - packages/backend/src/common/error-catalog/create-error-catalog.ts
    - packages/backend/src/common/error-catalog/create-error-catalog.spec.ts
  modified: []
decisions:
  - "IAuditContextProvider is an abstract class (not TypeScript interface) so NestJS DI can inject it at runtime"
  - "AuditInterceptor uses NestJS built-in Logger (not nestjs-pino) to avoid circular dependency with LoggerModule"
  - "Audit write is fire-and-forget (.catch()) per D-03 — handler success is never coupled to audit store availability"
  - "writeAuditLog() guards ctx?.organizationId per D-04 — never fabricate an org ID for the non-nullable FK"
  - "createErrorCatalog() uses Object.fromEntries cast — avoids manual const boilerplate per D-10"
metrics:
  duration_minutes: 15
  completed_date: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 0
  tests_added: 7
  tests_total_after: 31
---

# Phase 03 Plan 03: Audit Seam, Idempotency Seam & Error Catalog Summary

**One-liner:** Pluggable audit interceptor (fire-and-forget, no-op provider, abstract class DI token), idempotency seam (abstract store + in-memory no-op), and createErrorCatalog() generic helper for per-domain PREFIX.CODE error codes.

## Tasks

| # | Name | Status | Commits |
|---|------|--------|---------|
| 1 | @RawResponse decorator + audit interceptor seam | DONE | 9310541, 62a372a |
| 2 | Idempotency seam + error catalog helper + specs | DONE | 295a382, 2079ecc |

## What Was Built

### Task 1: Audit Seam (6 files)

**`raw-response.decorator.ts`** — `RAW_RESPONSE_KEY = 'RAW_RESPONSE'` constant and `RawResponse(): MethodDecorator & ClassDecorator` factory using `SetMetadata`. Plans 04 and 05 depend on this.

**`audit-context-provider.interface.ts`** — `AuditContext { organizationId, userId? }` interface and `IAuditContextProvider` abstract class with `getContext(): AuditContext | null`. Abstract class (not TypeScript interface) so NestJS DI can use it as an injection token at runtime.

**`noop-audit-context-provider.ts`** — `@Injectable() NoOpAuditContextProvider extends IAuditContextProvider` always returning `null`. JSDoc documents D-01: Phase 4/6 replace this via provider override, no interceptor changes needed.

**`audit.decorator.ts`** — `AUDIT_KEY = 'AUDIT'`, `AuditMeta { action: AuditAction, resource: string }` interface, and `Audit(action, resource): MethodDecorator` factory. Imports `AuditAction` from `@repo/database`.

**`audit.interceptor.ts`** — `@Injectable() AuditInterceptor implements NestInterceptor`. Reads `AUDIT_KEY` metadata via `Reflector.get()`; if absent, passes through. On handler success, `tap({ next })` fires `writeAuditLog()` (void, non-blocking). `writeAuditLog()` checks `ctx?.organizationId` (D-04 guard), then calls `prisma.auditLog.create()` with `.catch()` (D-03 fire-and-forget). Uses `@nestjs/common` `Logger` (not nestjs-pino) per plan constraint.

**`audit.interceptor.spec.ts`** — 4 unit tests using vi.fn() factory-function mock pattern:
- Test A: provider returns null → prisma.auditLog.create not called
- Test B: provider returns context → create called with correct organizationId, action, resource
- Test C: create rejects → Observable still emits success (error swallowed by fire-and-forget)
- Test D: no @Audit() decorator → create not called (pass-through)

### Task 2: Idempotency + Error Catalog (5 files)

**`idempotency-store.interface.ts`** — `IDEMPOTENCY_KEY_HEADER = 'idempotency-key'` constant and `IdempotencyStore` abstract class with `get()`, `set()`, `has()` abstract methods. D-09 seam — enforcement interceptor is a future enhancement.

**`noop-idempotency-store.ts`** — `@Injectable() NoOpIdempotencyStore extends IdempotencyStore`. In-memory `Map<string, unknown>` backing store. JSDoc warns: single-instance only, replace with Redis-backed implementation for multi-replica deployments (D-09).

**`idempotency.decorator.ts`** — `IDEMPOTENCY_KEY_META = 'IDEMPOTENCY_KEY'` constant and `IdempotencyKey(): MethodDecorator` factory using `SetMetadata`.

**`create-error-catalog.ts`** — `createErrorCatalog<const T extends string>(prefix, codes)` generic function using `Object.fromEntries` to produce `{ [K in T]: \`${string}.${K}\` }`. Exports `DomainErrorCode = \`${string}.${string}\`` weak cross-domain type. JSDoc explains relationship to manual `PLATFORM_ERROR_CODES` pattern.

**`create-error-catalog.spec.ts`** — 3 unit tests:
- Test A: `createErrorCatalog('AUTH', ['INVALID_TOKEN', 'EXPIRED_TOKEN'])` → correct objects
- Test B: `createErrorCatalog('PLATFORM', ['NOT_FOUND'])` → correct object
- Test C: empty codes array → empty object

## Verification Results

```
Test Files  7 passed (7)
Tests  31 passed (31)     (+7 new tests from 24 baseline)
TypeScript typecheck: PASSED (0 errors)
```

Grep verifications:
- `abstract class IAuditContextProvider` — 1 match
- `RAW_RESPONSE_KEY` in raw-response.decorator.ts — 1 match
- No `nestjs-pino` import in audit.interceptor.ts
- `Kernel interceptors are permitted` comment — 1 match
- `abstract class IdempotencyStore` — 1 match
- `return null` in noop-audit-context-provider.ts — 1 match
- `.catch(` in audit.interceptor.ts — 1 match

## Deviations from Plan

None — plan executed exactly as written.

The `IDEMPOTENCY_KEY_META` constant name (from the plan action text) was used instead of `IDEMPOTENCY_KEY` to avoid naming collision with the exported constant name. The plan action section specifies both `IDEMPOTENCY_KEY_META` for the metadata key and uses `SetMetadata(IDEMPOTENCY_KEY_META, true)` — implemented as specified.

## Known Stubs

None. All files are seam definitions (abstract classes, decorators, no-op providers) — the "no-op" behavior is intentional and documented per the design decisions D-01, D-09. The real providers (Phase 4/6 for audit context, Redis-backed for idempotency) are explicitly deferred by design.

## Threat Flags

No new security surface introduced — these are seam definitions only:
- `IAuditContextProvider.getContext()` returns `null` this phase (NoOp) — no org data at risk
- `AuditInterceptor.writeAuditLog()` guards the non-nullable `organizationId` FK (T-03-04 mitigated via D-04 guard)
- Fire-and-forget audit failures are logged but not propagated (T-03-03 accepted per design)

## TDD Gate Compliance

Both tasks followed RED/GREEN cycle:
1. `test(03-03): add failing tests for AuditInterceptor (RED)` — 9310541
2. `feat(03-03): implement @RawResponse decorator, audit seam and AuditInterceptor (GREEN)` — 62a372a
3. `test(03-03): add failing tests for createErrorCatalog (RED)` — 295a382
4. `feat(03-03): implement idempotency seam and error catalog helper (GREEN)` — 2079ecc

## Self-Check: PASSED

Files exist:
- packages/backend/src/common/interceptors/raw-response.decorator.ts — FOUND
- packages/backend/src/audit/audit-context-provider.interface.ts — FOUND
- packages/backend/src/audit/noop-audit-context-provider.ts — FOUND
- packages/backend/src/audit/audit.decorator.ts — FOUND
- packages/backend/src/common/interceptors/audit.interceptor.ts — FOUND
- packages/backend/src/common/interceptors/audit.interceptor.spec.ts — FOUND
- packages/backend/src/idempotency/idempotency-store.interface.ts — FOUND
- packages/backend/src/idempotency/noop-idempotency-store.ts — FOUND
- packages/backend/src/idempotency/idempotency.decorator.ts — FOUND
- packages/backend/src/common/error-catalog/create-error-catalog.ts — FOUND
- packages/backend/src/common/error-catalog/create-error-catalog.spec.ts — FOUND

Commits exist:
- 9310541 — FOUND
- 62a372a — FOUND
- 295a382 — FOUND
- 2079ecc — FOUND
