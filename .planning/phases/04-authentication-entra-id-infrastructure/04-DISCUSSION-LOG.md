# Phase 4: Authentication (Entra ID) Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 4-Authentication (Entra ID) Infrastructure
**Areas discussed:** CurrentUser principal shape, JIT user provisioning, Dev stub design, Auth module placement

---

## CurrentUser Principal Shape

| Option | Description | Selected |
|--------|-------------|----------|
| JWT claims only (no DB hit) | `CurrentUser = { entraId, email, tenantId, displayName? }` from token — zero DB round-trip | ✓ (Claude's discretion) |
| DB user record (lookup every request) | Look up `User` by entraId/email after JWT validation; populate with cuid DB id | |
| You decide | Deferred to Claude | |

**User's choice:** You decide (Claude selected: JWT claims only)

---

| Option | Description | Selected |
|--------|-------------|----------|
| oid (object ID) | Stable, immutable Entra user identifier — Microsoft's recommended primary key | ✓ |
| sub (subject) | Also stable but less Entra-specific; preferred in consumer OIDC | |
| You decide | Deferred to Claude | |

**User's choice:** oid (object ID)

---

| Option | Description | Selected |
|--------|-------------|----------|
| No roles in CurrentUser | Phase 5 owns role/permission resolution — clean phase separation | ✓ |
| Include Entra app roles from token | Include token-level roles in CurrentUser if configured | |
| You decide | Deferred to Claude | |

**User's choice:** No roles in CurrentUser

---

## JIT User Provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — no DB write in Phase 4 | Pure JWT validation; provisioning deferred | |
| JIT upsert in Phase 4 | Upsert User on first auth (enterprise SSO standard) | ✓ (initial) |
| You decide | Deferred to Claude | |

**User's choice:** JIT upsert (initial) — then overridden in follow-up question

---

| Option | Description | Selected |
|--------|-------------|----------|
| Email key is fine for now | Upsert by email; entraId is a future schema addition | |
| Skip DB write in Phase 4 | Defer provisioning until schema can be extended | ✓ (Claude's discretion) |
| You decide | Deferred to Claude | |

**User's choice:** You decide (Claude selected: skip DB write — schema frozen, email-only upsert is fragile)

**Notes:** After the user selected JIT upsert, the frozen schema constraint was surfaced (no `entraId` field on `User`; unique only on `email`). Claude recommended deferring to Phase 6 when both org membership and an `entraId` schema extension can be done together. User agreed.

---

## Dev Stub Design

| Option | Description | Selected |
|--------|-------------|----------|
| Header-based bypass | `X-Dev-User: email` header supplies principal identity; no JWT parsed | ✓ |
| Unsigned test JWT | Test JWT (HS256 or no signature) — more realistic but complex to generate | |
| Hardcoded single principal | Stub always returns one fixed CurrentUser — not useful for multi-user tests | |
| You decide | Deferred to Claude | |

**User's choice:** Header-based bypass

---

| Option | Description | Selected |
|--------|-------------|----------|
| AUTH_MODE env var | `AUTH_MODE=stub\|entra`; fail-fast if production + stub | ✓ |
| NODE_ENV check only | Stub loads when `development` or `test` — less flexible | |
| You decide | Deferred to Claude | |

**User's choice:** AUTH_MODE env var

---

| Option | Description | Selected |
|--------|-------------|----------|
| Allow through (null CurrentUser) | @Public endpoints bypass guard entirely — no header needed | ✓ |
| Require header even on @Public | Breaks the whole point of @Public | |

**User's choice:** Allow through (null CurrentUser)

---

## Auth Module Placement

| Option | Description | Selected |
|--------|-------------|----------|
| src/auth/ — standalone auth module | Flat module, separate from Identity bounded context; Phase 9 scaffolds identity separately | ✓ |
| src/modules/identity/ — inside Identity domain now | Pre-create Identity domain; Phase 9 fills the rest | |
| src/common/auth/ — alongside cross-cutting concerns | Consistent with common/exceptions, common/middleware | |

**User's choice:** src/auth/ — standalone auth module

---

| Option | Description | Selected |
|--------|-------------|----------|
| Global APP_GUARD (secure by default) | JwtAuthGuard as APP_GUARD; @Public() opts out | ✓ |
| Feature-level guard per module | More granular but easy to forget = security gaps | |

**User's choice:** Global APP_GUARD

---

| Option | Description | Selected |
|--------|-------------|----------|
| Health endpoints only | GET /health + Swagger (non-prod) — minimal public surface | ✓ |
| Health + Swagger + ping endpoint | Additional test route for integration testing | |

**User's choice:** Health endpoints only

---

## Claude's Discretion

- **CurrentUser DB lookup strategy**: JWT claims only (no DB hit) — user said "you decide". Reasoning: no DB round-trip per request; Phase 6 is where DB state enters the lifecycle; services look up `User.id` on demand.
- **JIT provisioning deferral**: User initially selected JIT upsert, then "you decide" on the email-key follow-up. Claude selected defer-to-Phase-6 given frozen schema and fragile email-only lookup.
- **`@CurrentUser()` implementation**: Standard NestJS `createParamDecorator` reading from `request.user`.
- **`TokenValidator` interface shape**: `abstract class TokenValidator { abstract validate(token: string): Promise<CurrentUser>; }`.
- **JWKS key caching configuration**: `cache: true, cacheMaxEntries: 5, cacheMaxAge: 10 min` — verify at plan time per STATE.md flag.

## Deferred Ideas

- JIT User provisioning (upsert by email) — deferred to Phase 6 when `entraId` schema extension and org membership are both available.
- Live Entra tenant E2E SSO verification — future milestone (out of scope PROJECT.md).
- Authenticated Swagger in production — Phase 3 D-14; still deferred.
- `IAuditContextProvider` with real `organizationId` — Phase 6.
