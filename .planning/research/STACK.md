# Stack Research

**Domain:** Production NestJS 11 modular-monolith backend foundation (microservice-ready) on a frozen Prisma 6 / PostgreSQL data layer
**Researched:** 2026-06-29
**Confidence:** HIGH (all versions verified against the npm registry on 2026-06-29; deprecation status confirmed against Microsoft/AzureAD official sources)

> Scope note: The data layer (`@repo/database`: Prisma 6.19.3 + PostgreSQL + `PrismaModule`/`PrismaService`) is settled and NOT re-evaluated here. Everything below sits *on top* of it. NestJS 11.1.27 and Node 22+ are fixed by existing code.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS ("Jod") | Runtime | Already required by `@repo/database` seed (`--experimental-strip-types`, Node 22+). 22 is the active LTS — pin via `.nvmrc`. Avoid 24 (current, not LTS) for a production foundation. |
| `@nestjs/core` / `@nestjs/common` / `@nestjs/platform-express` | 11.1.27 | Application framework | Fixed by existing code; `@repo/database` already depends on `@nestjs/common@11.1.27`. Use the Express adapter (default, broadest middleware ecosystem incl. Helmet) unless a measured throughput need justifies Fastify later. |
| TypeScript | 5.9.x (latest 5.x) | Language | NestJS 11, `typescript-eslint` 8, and SWC are all validated against the 5.x line. **Do NOT adopt TypeScript 6.0** yet (released Jan 2026) — too new for the decorator/`emitDecoratorMetadata` reflection that NestJS, `class-validator`, and Prisma rely on. |
| `reflect-metadata` | 0.2.x | Decorator metadata | Required by NestJS DI + `class-validator`/`class-transformer`. Already transitively present via `@repo/database`; declare it explicitly in the backend package. |
| `rxjs` | 7.8.x | Reactive primitives | NestJS peer dependency (interceptors, lifecycle). Pin to the 7.x line NestJS 11 expects. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/config` | 4.0.4 | Typed config + env loading | Global config module. Wrap with a **Zod**-validated schema (see below) to produce a fully typed, fail-fast config object at boot. |
| `zod` | 4.4.x | Env + runtime schema validation | Validate `process.env` at startup via `@nestjs/config`'s `validate` hook. Produces an inferred `AppConfig` type — superior DX to Joi. (Used only for env/config, not HTTP DTOs.) |
| `class-validator` | 0.15.1 | HTTP DTO validation | Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`). NestJS-idiomatic and integrates with the Swagger CLI plugin for automatic schema generation. |
| `class-transformer` | 0.5.1 | DTO (de)serialization | Pairs with `class-validator` and `ValidationPipe` transform; also drives response serialization via `ClassSerializerInterceptor`. |
| `nestjs-pino` | 4.6.1 | Structured logging integration | Replaces the default Nest logger; per-request child loggers with auto-injected request/trace context. JSON output is CloudWatch/OpenTelemetry-ready. |
| `pino` | 10.3.1 | Logger core | High-performance structured JSON logger; the de-facto Node standard for production. |
| `pino-http` | 11.0.0 | HTTP request logging | Auto request/response logging with latency; wired through `nestjs-pino`. |
| `pino-pretty` | latest (dev only) | Human-readable dev logs | Dev dependency; pretty-print transport for local development only. |
| `nestjs-cls` | 6.2.1 | AsyncLocalStorage context | Propagates a per-request `traceId`/correlation ID into logs and the standardized error envelope **without** request-scoped providers (which break singletons and hurt perf). |
| `@nestjs/swagger` | 11.4.4 | OpenAPI / Swagger UI | Generates OpenAPI 3 + Swagger UI. Enable the **CLI plugin** in `nest-cli.json` so DTO/`class-validator` metadata becomes schema automatically. Mount at `/api/v1`. |
| `@nestjs/terminus` | 11.1.1 | Health checks | Liveness/readiness endpoints. Ships a `PrismaHealthIndicator` — point it at the existing `PrismaService` for DB connectivity readiness. |
| `@nestjs/throttler` | 6.5.0 | Rate limiting | Global rate-limit guard (API Security requirement). In-memory storage now; swap to the Redis storage adapter when Redis lands (future milestone). |
| `helmet` | 8.2.0 | Security headers | Applied in `main.ts` on the Express instance. Standard hardening for a public API. |
| `@nestjs/jwt` | 11.0.2 | JWT utilities | Decode/verify helpers and any first-party token issuance (e.g., short-lived session tokens layered over Entra ID). |
| `@nestjs/passport` | 11.0.5 | Auth strategy integration | Guard/strategy plumbing for the Entra ID bearer-token strategy and RBAC guards. |
| `passport` | 0.7.0 | Auth middleware core | Underlying Passport runtime. |
| `passport-jwt` | 4.0.1 | Bearer JWT strategy | **The Microsoft-recommended replacement path** for protecting a Node API with Entra ID-issued access tokens (validates the `Authorization: Bearer` JWT). Not deprecated. |
| `jwks-rsa` | 4.1.0 | JWKS key resolution | Fetches + caches Entra ID signing keys from the tenant's OpenID JWKS endpoint to verify token signatures (issuer/audience/`kid`). Pairs with `passport-jwt`. |
| `@nestjs/event-emitter` | 3.1.0 | In-process domain events | Async domain communication (`Integration → Repository`, etc.) for the monolith **today**. Hide it behind a thin `DomainEventBus` interface so the transport can be swapped for a broker on extraction — no call-site rewrites. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@nestjs/cli` | 11.0.23 | Project scaffolding + build. Enable the **SWC builder** (`"builder": "swc"` in `nest-cli.json`) for ~10-20x faster builds; keep `tsc` for type-checking in CI. |
| `@swc/core` | 1.15.x | Fast TS transpile | Build + (optionally) test transform. |
| `typescript-eslint` | 8.62.0 | Type-aware linting | Flat-config (`eslint.config.mjs`). Verified to support ESLint 9 and 10. |
| `eslint` | 9.x (recommended) or 10.x | Linting | ESLint 10.6.0 is current and supported by `typescript-eslint` 8.62, but **pin to ESLint 9.x** for a production foundation — the broader plugin ecosystem trails the v10 release. Flat config either way. |
| `prettier` | 3.9.1 | Formatting | Pair with `eslint-config-prettier` to disable conflicting lint rules. Establishes the formatting baseline that CONVENTIONS.md flags as missing. |
| `vitest` + `@vitest/coverage-v8` | 4.1.9 | Unit/integration tests | Recommended over Jest: native ESM + TS support (the codebase mandates ESM `import`), SWC/esbuild speed, Jest-compatible API. Use `unplugin-swc` for decorator metadata in tests. |
| `tsx` | 4.22.4 | TS script runner | For local scripts/tooling that need full TS (the seed uses `--experimental-strip-types`; keep that as-is per the frozen package). |

---

## Installation

```bash
# Core runtime deps (backend package)
npm install @nestjs/core@11.1.27 @nestjs/common@11.1.27 @nestjs/platform-express@11.1.27 \
  reflect-metadata rxjs \
  @nestjs/config zod \
  class-validator class-transformer \
  nestjs-pino pino pino-http nestjs-cls \
  @nestjs/swagger @nestjs/terminus @nestjs/throttler helmet \
  @nestjs/jwt @nestjs/passport passport passport-jwt jwks-rsa \
  @nestjs/event-emitter

# Dev dependencies
npm install -D @nestjs/cli @swc/core unplugin-swc \
  typescript@5.9 typescript-eslint eslint@9 prettier eslint-config-prettier \
  vitest @vitest/coverage-v8 pino-pretty tsx \
  @types/node @types/passport-jwt
```

> Configure root `package.json` `workspaces` (currently absent — `packages/` is manual) so `@repo/database` resolves as a workspace dependency for the new `packages/backend`.

---

## Microsoft Entra ID Authentication — Prescriptive Pattern

**Recommended:** `passport-jwt` + `jwks-rsa` (Bearer access-token validation).

The backend is an OAuth2 **resource server**: the frontend/SPA performs the interactive Entra ID login (MSAL Browser, future frontend milestone) and sends the access token. The backend's only job is to **validate** that JWT — verify signature against the tenant JWKS, check `iss`, `aud`, `exp`, then map claims to internal identity/roles.

- A custom `EntraJwtStrategy` (extends `passport-jwt`'s `Strategy`) uses `jwks-rsa`'s `passportJwtSecret` to resolve signing keys from `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`.
- `audience` = the API app registration's Application ID URI; `issuer` = the v2.0 issuer for the tenant.
- This milestone wires the strategy + guards and validates structure; live-tenant verification is explicitly deferred (per PROJECT.md Out of Scope).

**RBAC:** Implement a `@Roles()`/`@Permissions()` decorator + a `PermissionsGuard` that reads the authenticated principal and checks against the seeded `Permission`/`Role`/`UserRole` tables (16 permissions, 4 roles already in the DB). Enforce least-privilege at the route level; keep the permission catalogue DB-driven (it already is), not hardcoded.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `passport-jwt` + `jwks-rsa` (resource server) | `@azure/msal-node` 5.3.0 | Only when the **backend itself** must acquire tokens — confidential-client flows, On-Behalf-Of, or calling downstream Microsoft Graph/APIs. Add it then; not needed to merely protect endpoints. |
| `class-validator` + `class-transformer` (HTTP DTOs) | `nestjs-zod` 5.4.0 + `zod` | Choose if you want a single Zod schema language for both env and DTOs and prefer schema-first over decorators. Trade-off: less mature Swagger integration than the `@nestjs/swagger` CLI plugin + `class-validator`. |
| Zod for env validation | Joi (`@nestjs/config` documented default) | Use Joi if the team already standardizes on it; Zod is preferred here for static type inference of the config object. |
| `@nestjs/event-emitter` (in-process events) | `@nestjs/cqrs` 11.0.3 EventBus | Adopt CQRS when a domain genuinely needs command/query separation and an event-sourced read model. Avoid blanket CQRS — it adds ceremony against CLAUDE.md "simplicity first." |
| Vitest 4 | Jest 30 + ts-jest | Use Jest if you want the exact NestJS default and zero ESM friction concerns; Vitest is faster and ESM-native (the codebase mandates `import`). |
| Express adapter | Fastify adapter (`@nestjs/platform-fastify`) | Switch to Fastify only with a measured throughput requirement; it narrows the middleware ecosystem (Helmet/Passport integration is smoother on Express). |
| npm workspaces | Turborepo / Nx | Add a monorepo orchestrator later if build caching across many packages becomes a bottleneck. npm workspaces is sufficient for the current 2-3 package layout. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `passport-azure-ad` | **Officially deprecated and unmaintained** (code moved to MSAL.js repo; npm `deprecated` flag set by AzureAD). No security updates. | `passport-jwt` + `jwks-rsa` for API protection; `@azure/msal-node` if token acquisition is needed. |
| TypeScript 6.0.x | Released Jan 2026; too new for the decorator/`emitDecoratorMetadata` reflection NestJS + `class-validator` + Prisma depend on. Ecosystem (ts-eslint, SWC) not yet hardened for it. | TypeScript 5.9.x. |
| Winston | Heavier, slower, less structured-JSON-first than Pino; weaker per-request child-logger ergonomics. | `pino` + `nestjs-pino`. |
| Request-scoped providers for trace context | Forces per-request instantiation, breaks singleton DI assumptions, measurable perf cost at scale. | `nestjs-cls` (AsyncLocalStorage). |
| Raw `Error` throws in services | Violates CLAUDE.md typed-error rule; produces inconsistent API responses. | NestJS `HttpException` subclasses + a global `ExceptionFilter` emitting the `{ success, errorCode, message, traceId }` envelope (per Service-API doc §12). |
| `bcrypt`/local password storage | Auth is delegated to Entra ID SSO; storing passwords is out of scope and an attack surface. | Entra ID bearer-token validation only. |
| Installing `@nestjs/microservices` / BullMQ / Redis storage **now** | Redis runtime + microservice transport are explicitly deferred this milestone. Premature wiring adds dead config. | Design clean abstractions (`DomainEventBus`, throttler storage interface) so these drop in later without rewrites. |
| Editing `@repo/database` schema/Prisma version to fit a lib | Schema is frozen + authoritative this milestone. | Adapt the backend to the existing `PrismaService`; additive-only changes in future milestones. |

---

## Stack Patterns by Variant

**If the backend stays a monolith for the foreseeable future:**
- Keep `@nestjs/event-emitter` for cross-domain async, behind a `DomainEventBus` interface.
- Single deployable; domains are NestJS modules with strict no-cross-domain-DB-access boundaries.

**If/when a domain is extracted to a microservice:**
- Swap the `DomainEventBus` implementation to `@nestjs/microservices` (RabbitMQ/NATS/Kafka transport) — call sites unchanged.
- Move `@nestjs/throttler` and cache to Redis-backed storage.
- Long-running AI workflows (LangGraph, future) run as separate worker processes consuming a **BullMQ** (Redis) queue — plan the queue abstraction now, install later.

**If throughput becomes the bottleneck:**
- Evaluate the Fastify adapter; re-verify Helmet/Passport integration before switching.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@nestjs/*` 11.x | `@nestjs/common` ^11.0.0 | All listed Nest packages declare `^11` (or `^10 || ^11`) peers — verified. |
| `@nestjs/throttler@6.5.0` | NestJS ^11 | Peer range explicitly includes `^11.0.0` despite the major being 6. |
| `nestjs-zod@5.4.0` | `zod` ^3.25 \|\| ^4, `@nestjs/swagger` ^11 | Only relevant if the Zod-DTO alternative is chosen. |
| `typescript-eslint@8.62.0` | `eslint` ^8.57 \|\| ^9 \|\| ^10 | Supports ESLint 9 and 10; we still pin ESLint 9 for plugin stability. |
| `@repo/database` (Prisma 6.19.3) | NestJS 11, Node 22+ | `@nestjs/terminus` `PrismaHealthIndicator` consumes the existing `PrismaService` — no schema/version change. |
| `class-validator` 0.15 + `@nestjs/swagger` 11 CLI plugin | NestJS 11 | Plugin auto-derives OpenAPI schema from validation decorators. |

---

## Sources

- npm registry (`npm view`), queried 2026-06-29 — exact published versions + peer dependencies for every package above. Confidence: HIGH.
- `npm view passport-azure-ad deprecated` — returns the official AzureAD deprecation notice pointing to the MSAL.js validation replacement. Confidence: HIGH.
- Microsoft Support: "Security update for the Passport-Azure-AD for Node.js library" — https://support.microsoft.com/en-us/topic/security-update-for-the-passport-azure-ad-for-node-js-library-207a398e-ba56-cb74-6524-04061b468f78 — confirms deprecation. Confidence: HIGH.
- AzureAD/microsoft-identity-web Discussion #2405 — community-confirmed `passport-jwt` + `jwks-rsa` as the Bearer-token replacement path. Confidence: MEDIUM (community guidance, aligns with Microsoft deprecation pointer).
- `Enterprise-AI-Delivery-Platform-Documentation/05-High-Level-Design/High-Level-Design.md` §20/§22 — confirms Entra ID SSO, JWT, RBAC, OpenTelemetry observability requirements. Confidence: HIGH (authoritative design source).
- `Enterprise-AI-Delivery-Platform-Documentation/09-Service-and-API-Architecture/Service-API-Architecture.md` §12/§13/§14 — standardized error envelope `{ success, errorCode, message, traceId }`, API security (JWT/RBAC/validation/rate-limit/audit), `/api/v1` versioning. Confidence: HIGH.
- `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `PROJECT.md` — frozen Prisma 6.19.3 / NestJS 11.1.27 / Node 22+ baseline and constraints. Confidence: HIGH.

---
*Stack research for: NestJS 11 modular-monolith backend foundation*
*Researched: 2026-06-29*
