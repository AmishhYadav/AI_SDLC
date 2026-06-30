# Phase 2: Platform Kernel — Bootstrap, Config & Error Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 2-Platform Kernel — Bootstrap, Config & Error Contract
**Areas discussed:** traceId origin, errorCode taxonomy, Config shape & env set, Prisma error breadth

---

## traceId origin

| Option | Description | Selected |
|--------|-------------|----------|
| UUID + honor inbound header | Middleware generates a v4 UUID per request but adopts an inbound `x-request-id` / W3C `traceparent` if present; stored on request now, rewired to ALS in Phase 3. | ✓ |
| UUID only, ignore headers | Always mint a fresh UUID, never trust inbound headers. | |
| Placeholder until Phase 3 | Ship empty/null traceId now, wire fully in Phase 3. | |

**User's choice:** UUID + honor inbound header
**Notes:** Preserves cross-service correlation; deliberate seam so Phase 3 ALS work moves generation without changing the envelope contract.

---

## errorCode taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Flat SCREAMING_SNAKE | VALIDATION_ERROR, RESOURCE_CONFLICT, NOT_FOUND, INTERNAL_ERROR. | |
| Namespaced DOMAIN.CODE | KERNEL.CONFLICT, AUTH.INVALID_TOKEN — structured for 14 domains. | ✓ |
| HTTP-reason style | CONFLICT, NOT_FOUND, UNPROCESSABLE_ENTITY mirroring status text. | |

**User's choice:** Namespaced DOMAIN.CODE
**Notes:** Format locked as dotted UPPER_SNAKE, single level (`PREFIX.CODE`). Follow-up selected the kernel prefix `PLATFORM` (over `KERNEL` / `COMMON`) — reads naturally for cross-cutting errors and is distinct from domain prefixes. Full catalog formalized in Phase 3 / SEAM-06.

---

## Config shape & env set

| Option | Description | Selected |
|--------|-------------|----------|
| @nestjs/config + Zod + typed wrapper | ConfigModule.forRoot with Zod validate(), registerAs namespaces, thin typed AppConfigService. | ✓ |
| Custom global config module | Hand-rolled global module, Zod-validated frozen typed config object. | |
| @nestjs/config, untyped get() | Plain ConfigService.get<T>(key) with a Zod validate fn. | |

**User's choice:** @nestjs/config + Zod + typed wrapper
**Notes:** Required fail-fast env set accepted as proposed: `DATABASE_URL`, `PORT` (default 3000), `NODE_ENV`. No additions (CORS_ORIGINS/LOG_LEVEL deferred to the Phase 3 features that need them).

---

## Prisma error breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Named pair + safe default, dedicated mapper | Dedicated mapper: P2002→409, P2025→404, other known Prisma errors→500 sanitized. | ✓ |
| Broader common set now | Also P2003→409, P2000/P2006→400, P2014→400, plus 500 default. | |
| Named pair, inline in global filter | instanceof check for the two codes inline in the general filter. | |

**User's choice:** Named pair + safe default, dedicated mapper
**Notes:** Scope matches success criteria exactly; broader codes added per-domain when a real endpoint exercises them.

---

## Claude's Discretion

- Global filter registration pattern (`APP_FILTER` provider vs `app.useGlobalFilters` in `main.ts`) — lean DI-friendly.
- Exact Zod strictness/flags and `registerAs` namespace breakdown (server/database/app).
- INFRA-03 lint-rule mechanism (`no-restricted-properties` / `no-process-env` + config-dir exception).
- `main.ts` bootstrap specifics and correlation-middleware registration mechanism.

## Deferred Ideas

- AsyncLocalStorage correlation-ID (INFRA-04), formal error-code catalog + pagination + idempotency conventions (SEAM-06), validation pipe/interceptors/health/Swagger/security/graceful-shutdown (INFRA-07–13) — all Phase 3.
- Broader Prisma error-code mappings — per-domain, as needed.
