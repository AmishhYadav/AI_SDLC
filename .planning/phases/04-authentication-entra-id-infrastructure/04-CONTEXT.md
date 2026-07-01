# Phase 4: Authentication (Entra ID) Infrastructure - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Protect NestJS endpoints with Entra-issued JWT validation behind a swappable `TokenValidator` seam. This phase delivers: a `JwtAuthGuard` registered globally (secure by default), a `@Public()` bypass decorator, a `CurrentUser` principal resolvable in handlers, and an `AUTH_MODE`-controlled dev/test stub that bypasses JWT validation using a request header.

**In scope (AUTH-01 through AUTH-05):**
- `passport-jwt` + `jwks-rsa` JWKS validation against the Entra tenant (AUTH-01)
- `TokenValidator` abstract class (DI token) with real and stub implementations (AUTH-02)
- `@Public()` decorator for bypass (AUTH-03)
- `@CurrentUser()` parameter decorator resolving the principal (AUTH-04)
- Stub/dev validator activated via `AUTH_MODE=stub` env var (AUTH-05)
- Env schema extensions: `AUTH_MODE`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE`

**Out of scope (defer to later phases):**
- RBAC, `@RequirePermissions()`, `PermissionsGuard` — Phase 5
- Tenant/actor context (organizationId) in ALS — Phase 6
- DB lookup on every request or JIT User provisioning — deferred (schema frozen; see D-04)
- Updating `IAuditContextProvider` with userId — deferred to Phase 6 when organizationId is available (D-04 from Phase 3 still applies; audit writes skip without orgId)
- Live Entra tenant integration/E2E SSO verification — future milestone (explicitly out of scope in PROJECT.md)

</domain>

<decisions>
## Implementation Decisions

### CurrentUser principal shape (AUTH-04)
- **D-01:** `CurrentUser` carries **JWT claims only — no DB hit per request**. Shape: `{ entraId: string; email: string; tenantId: string; displayName?: string | null }`. The `entraId` is mapped from the Entra token's `oid` (object ID) claim — stable, immutable user identifier that survives email changes and is the Microsoft-recommended primary key for Entra integrations.
- **D-02:** `CurrentUser` includes **no roles or permissions**. Role/permission resolution is Phase 5's sole responsibility. No cross-phase coupling via the principal.
- **D-03:** `tenantId` is mapped from the Entra token's `tid` claim. `displayName` from `name` claim (nullable). `email` from `upn` or `email` claim. Any additional claims are ignored at this phase.

### User provisioning (deferred from Phase 4)
- **D-04:** Phase 4 performs **zero DB writes** during request authentication. JIT User provisioning is deferred. Rationale: the `User` model has no `entraId` field (schema is frozen this milestone — additive-only schema changes after); provisioning by email alone is fragile (UPN ≠ email in some enterprise Entra configurations). Phase 5's `PermissionsGuard` will look up `User` by email; if no row exists, permissions are empty (fail-closed — correct behavior until provisioning runs). Provisioning is a Phase 6+ concern when org membership and `entraId` schema extension are both available.

### Dev/test stub validator (AUTH-05)
- **D-05:** The stub validator is activated via **`AUTH_MODE=stub`** env var. Fail-fast on startup if `NODE_ENV=production` and `AUTH_MODE=stub` are set simultaneously (Zod schema enforces this). When `AUTH_MODE=entra` (the production value), the real JWKS validator loads.
- **D-06:** When `AUTH_MODE=stub`, a protected endpoint authenticates via the **`X-Dev-User` request header** (value = the user's email, e.g. `X-Dev-User: dev@example.com`). The stub constructs a `CurrentUser` from the header value with a fixed `entraId` (derived from the header) and a synthetic `tenantId`. No JWT is parsed or issued.
- **D-07:** `@Public()` endpoints bypass the guard entirely regardless of `AUTH_MODE`. No `X-Dev-User` header is needed for public endpoints. `CurrentUser` is `null` in public handler parameters.

### Auth module placement and guard wiring (AUTH-02, AUTH-03)
- **D-08:** Auth infrastructure lives in **`src/auth/`** — a flat, standalone `AuthModule`. This is separate from the planned Identity bounded context (`src/modules/identity/`) which Phase 9 scaffolds for user/role business logic. Auth is cross-cutting infrastructure; identity is a business domain.
- **D-09:** `JwtAuthGuard` is registered as a **global `APP_GUARD`** in `AppModule` (secure by default). Guard execution order: `ThrottlerGuard` (already registered) → `JwtAuthGuard`. This ensures throttling applies to both authenticated and unauthenticated requests.
- **D-10:** **Only health endpoints and the Swagger UI (non-prod) are marked `@Public()`** out of the box. Everything else is protected. Phase 5+ marks any additional public endpoints.

### Claude's Discretion
- Exact `@CurrentUser()` implementation: parameter decorator using `createParamDecorator` + `ExecutionContext` to extract from `request.user` (populated by the guard). Standard NestJS pattern.
- `TokenValidator` abstract class shape: `abstract validate(token: string): Promise<CurrentUser>` — returning the principal or throwing `UnauthorizedException`. The guard calls `tokenValidator.validate(bearerToken)` and sets `request.user`.
- JWKS key caching strategy within `jwks-rsa`: use `cache: true, cacheMaxEntries: 5, cacheMaxAge: 10 * 60 * 1000` (10 min) — standard production values. Verify against current Microsoft docs at plan time (flagged in STATE.md as medium-confidence).
- Entra token claim shape: verify `iss`, `aud`, `oid`, `tid`, `upn`/`email`, `name` claim names against Microsoft's v2.0 access token documentation at plan time. Issuer format varies by tenant type (single-tenant vs multitenant).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/REQUIREMENTS.md` § "Authentication (Entra ID)" — AUTH-01 through AUTH-05 (authoritative requirement text for every deliverable this phase)
- `.planning/ROADMAP.md` § "Phase 4: Authentication (Entra ID) Infrastructure" — goal, success criteria (5 gates), and the research flag on JWKS validation specifics
- `.planning/PROJECT.md` § Constraints / Context — fixed stack, "Live Entra ID tenant integration" explicitly out of scope this milestone, layering constraint

### Prior phase context (decisions this phase extends)
- `.planning/phases/03-platform-kernel-observability-validation-security-health/03-CONTEXT.md` — **D-01** (audit seam: Phase 4 replaces the no-op `IAuditContextProvider`; but D-04 still applies — audit writes skip without `organizationId`), **D-16** (env schema to extend with auth vars)

### Current codebase state (what Phase 4 builds on)
- `packages/backend/src/app.module.ts` — `APP_GUARD ThrottlerGuard` registration (new `JwtAuthGuard` goes after it); `APP_FILTER` / `APP_INTERCEPTOR` patterns to follow for `APP_GUARD` registration; `NoOpAuditContextProvider` wiring
- `packages/backend/src/config/env.schema.ts` — Zod env schema to extend with `AUTH_MODE`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE`; `NODE_ENV` already in fail-fast set
- `packages/backend/src/audit/audit-context-provider.interface.ts` — `IAuditContextProvider` abstract class and `AuditContext { organizationId: string; userId?: string }` — Phase 4 can provide `userId` once a principal exists, but writes still skip until Phase 6 provides `organizationId`
- `packages/backend/src/audit/noop-audit-context-provider.ts` — the no-op provider; Phase 4 replaces via `AuthModule` provider override (D-01 from Phase 3)

### Authoritative design (API standards, security)
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` — §13 API Security (§440 Rate Limiting context, §441 Audit Logging — this phase begins populating `userId`); JWT / bearer token conventions if specified
- `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md` — confirm Entra SSO integration approach and any prescribed auth flow specifics

### External verification required at plan time
- **Microsoft Entra ID v2.0 token documentation** — verify `iss` format (single-tenant: `https://login.microsoftonline.com/{tenantId}/v2.0` vs multitenant wildcard), `aud` claim matching, and which token claims carry `oid`, `tid`, `upn` / `email`, `name`. STATE.md flags this as MEDIUM confidence.
- **`passport-jwt` + `jwks-rsa` compatibility** — verify current library versions and any breaking changes against NestJS 11 at plan time.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppConfigModule` / `AppConfigService` (`packages/backend/src/config/`) — the Zod fail-fast env module that Phase 4 extends with `AUTH_MODE`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE`. Follow the same `z.string().min(1, ...)` pattern as `CORS_ORIGINS`.
- `IAuditContextProvider` abstract class (`packages/backend/src/audit/`) — the Phase 4 `AuthAuditContextProvider` replaces the no-op by returning `{ userId: currentUser.entraId }` (no `organizationId` yet — audit writes still skip per D-04/Phase3).
- `APP_GUARD ThrottlerGuard` registration in `AppModule` — the pattern for registering `JwtAuthGuard` as another `APP_GUARD`. NestJS executes guards in registration order; `JwtAuthGuard` must be registered after `ThrottlerGuard`.
- `ClsService` from `nestjs-cls` — already globally available via `ClsModule.forRoot`; the guard can store `CurrentUser` in the CLS store for downstream access without prop-drilling.

### Established Patterns
- Abstract class as DI token: `IAuditContextProvider` is the precedent — use `abstract class TokenValidator` (not `interface`) so NestJS DI can use it as a provide token at runtime.
- Guard + decorator pattern: `@Public()` is a `SetMetadata` decorator; the guard reads it via `Reflector` to skip validation.
- `APP_FILTER`, `APP_PIPE`, `APP_GUARD`, `APP_INTERCEPTOR` all registered as providers in `AppModule.providers[]`. Phase 4 adds `{ provide: APP_GUARD, useClass: JwtAuthGuard }` after `ThrottlerGuard`.
- Env schema extension: `env.schema.ts` exports a single `envSchema` Zod object; Phase 4 adds fields to the same object (not a separate schema).

### Integration Points
- `AppModule.providers[]` gains: `{ provide: APP_GUARD, useClass: JwtAuthGuard }` and the replacement `IAuditContextProvider` provider (scoped to `AuthModule` or overridden in `AppModule`).
- `AuthModule` imports: `AppConfigModule` (for Zod-validated env vars), `PassportModule` (from `@nestjs/passport`), `JwtModule` from `@nestjs/jwt` if needed for the stub.
- New runtime deps to add: `@nestjs/passport`, `passport`, `passport-jwt`, `jwks-rsa`, `@types/passport-jwt`.
- `HealthModule` (`packages/backend/src/health/`) — its controller must be decorated with `@Public()` so readiness/liveness probes bypass auth.

### Landmines
- **Cyclic DI**: `AuthModule` must not import modules that depend on auth-protected services. Keep `AuthModule` leaf-level: it depends on `AppConfigModule` and nothing else in the application graph.
- **Guard execution order**: NestJS `APP_GUARD` providers execute in registration order. `ThrottlerGuard` is currently the only `APP_GUARD`. `JwtAuthGuard` must be added after it.
- **Stub security**: The `X-Dev-User` header bypass must only be active when `AUTH_MODE=stub`. The fail-fast Zod validation must reject `NODE_ENV=production` + `AUTH_MODE=stub`. Do not leave a backdoor.
- **`@Public()` on Swagger + Health**: `SwaggerModule.setup(...)` in `main.ts` is not a NestJS route handler — it doesn't go through guards. The `/api-docs` path needs no `@Public()`. Health controller routes do need `@Public()` applied via decorator.
- **Token caching**: `jwks-rsa` caches signing keys; the cache must be configured (max age, max entries) to prevent excessive JWKS endpoint calls in production while still picking up key rotation.

</code_context>

<specifics>
## Specific Ideas

- `CurrentUser` shape verbatim: `{ entraId: string; email: string; tenantId: string; displayName?: string | null }`
- `entraId` ← Entra `oid` claim; `tenantId` ← `tid` claim; `email` ← `upn` or `email` claim; `displayName` ← `name` claim.
- `TokenValidator` shape: `abstract class TokenValidator { abstract validate(token: string): Promise<CurrentUser>; }` — guard calls it, throws `UnauthorizedException` on failure.
- `AUTH_MODE` env values: `'stub' | 'entra'` — Zod `z.enum(['stub', 'entra'])`. Fail-fast Zod refinement: if `NODE_ENV === 'production'` and `AUTH_MODE === 'stub'`, throw schema error.
- Dev stub header: `X-Dev-User: dev@example.com` — stub constructs `CurrentUser` from this value; `entraId` = `stub-${email}`, `tenantId` = `stub-tenant`.
- `@Public()` = `SetMetadata('isPublic', true)`. Guard reads via `Reflector.getAllAndOverride('isPublic', [context.getHandler(), context.getClass()])`.
- `@CurrentUser()` = `createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().user)`.

</specifics>

<deferred>
## Deferred Ideas

- **JIT User provisioning** — Deferred to Phase 6 or later. Phase 4 makes no DB writes. When the schema is extended with `entraId` (additive migration), Phase 6 can upsert `User` on first org-scoped access.
- **Live Entra tenant E2E SSO verification** — Explicitly out of scope this milestone (PROJECT.md). A future milestone verifies full SSO against a real tenant.
- **Authenticated Swagger in production** — Phase 3 D-14 deferred this; still deferred. Revisit when a live prod docs portal is needed.
- **`IAuditContextProvider` with `organizationId`** — Phase 4 can provide `userId` but audit writes still skip (no org context). Phase 6 injects the real tenant-aware provider.

None of the above are scope creep — all are roadmap-defined later phases or explicitly-reserved seams.

</deferred>

---

*Phase: 4-Authentication (Entra ID) Infrastructure*
*Context gathered: 2026-07-01*
