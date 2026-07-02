---
phase: 04-authentication-entra-id-infrastructure
reviewed: 2026-07-02T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - packages/backend/package.json
  - packages/backend/src/app.integration.spec.ts
  - packages/backend/src/app.module.ts
  - packages/backend/src/auth/auth-audit-context-provider.ts
  - packages/backend/src/auth/auth.module.ts
  - packages/backend/src/auth/current-user.type.ts
  - packages/backend/src/auth/decorators/current-user.decorator.ts
  - packages/backend/src/auth/decorators/public.decorator.ts
  - packages/backend/src/auth/entra-token-validator.spec.ts
  - packages/backend/src/auth/entra-token-validator.ts
  - packages/backend/src/auth/jwt-auth.guard.spec.ts
  - packages/backend/src/auth/jwt-auth.guard.ts
  - packages/backend/src/auth/stub-token-validator.spec.ts
  - packages/backend/src/auth/stub-token-validator.ts
  - packages/backend/src/auth/token-validator.ts
  - packages/backend/src/common/exceptions/error-codes.ts
  - packages/backend/src/common/exceptions/global-exception.filter.ts
  - packages/backend/src/config/env.schema.spec.ts
  - packages/backend/src/config/env.schema.ts
  - packages/backend/src/health/health.controller.ts
  - packages/backend/vitest.config.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This phase introduces the authentication infrastructure: `JwtAuthGuard`, `EntraTokenValidator`, `StubTokenValidator`, the `@Public()` bypass decorator, the `@GetCurrentUser()` param decorator, env-schema expansion for `AUTH_MODE`, and an updated integration test suite.

The overall architecture is sound: the guard/validator split is clean, the stub-vs-entra factory is correct, and the token verification pipeline (JWKS lookup → RS256-only verify → claims extraction) follows best practices. The algorithm whitelist, tenant-specific JWKS URI, issuer-plus-audience checks, and production-guard in the env schema are all correctly implemented.

Seven defects were found: one security-relevant JWT validation gap, one observable authentication bug (whitespace-only header bypasses falsy check), one dead but startup-blocking config key, one unused injected dependency, one stack-trace disclosure that contradicts the project security policy, and two weak test assertions that can silently pass despite incorrect behavior.

## Warnings

### WR-01: `StubTokenValidator` — whitespace-only `X-Dev-User` header bypasses falsy check and produces an empty email

**File:** `packages/backend/src/auth/stub-token-validator.ts:13-19`

**Issue:** The guard on line 14 is `if (!rawToken)`. A whitespace-only string such as `"   "` is truthy in JavaScript, so the guard does not throw. The subsequent `rawToken.trim()` produces an empty string, and the method returns `{ entraId: "stub-", email: "", tenantId: "stub-tenant", displayName: null }`. Downstream code that expects `email` to be a non-empty string (logs, audit context, future Phase 6 user lookup) will silently receive an invalid value. The test suite covers `""` and `undefined` but not `"   "`.

**Fix:**
```typescript
async validate(rawToken: string): Promise<CurrentUser> {
  const email = rawToken?.trim() ?? '';
  if (!email) {
    throw new UnauthorizedException('AUTH.STUB_MISSING_DEV_USER_HEADER');
  }
  return {
    entraId: `stub-${email}`,
    email,
    tenantId: 'stub-tenant',
    displayName: null,
  };
}
```
Add a matching test: `expect(validator.validate('   ')).rejects.toThrow('AUTH.STUB_MISSING_DEV_USER_HEADER')`.

---

### WR-02: `EntraTokenValidator` — `tid` claim not validated against configured `ENTRA_TENANT_ID`

**File:** `packages/backend/src/auth/entra-token-validator.ts:64-68`

**Issue:** After successful `jwt.verify`, the `tid` claim is extracted from the payload and checked only for presence (`!tenantId`). It is never compared to `this.config.get('ENTRA_TENANT_ID')`. The JWKS URI and issuer check together make cross-tenant exploitation very unlikely with a correctly configured single-tenant setup, but the absence of an explicit `tid === ENTRA_TENANT_ID` assertion means a token whose issuer matches but whose `tid` has been altered (edge cases in intermediate caching, proxy tampering, or future multi-tenant expansion) would produce a `CurrentUser.tenantId` that silently differs from the configured tenant. The OWASP JWT cheat sheet and Microsoft's own documentation both recommend explicitly verifying `tid`.

**Fix:**
```typescript
const expectedTenantId = this.config.get('ENTRA_TENANT_ID');
if (!entraId || !email || !tenantId) {
  throw new UnauthorizedException('AUTH.MISSING_REQUIRED_CLAIMS');
}
if (tenantId !== expectedTenantId) {
  throw new UnauthorizedException('AUTH.TOKEN_INVALID');
}
```

---

### WR-03: `EntraTokenValidator` — no guard against a JWT that omits the `kid` header

**File:** `packages/backend/src/auth/entra-token-validator.ts:42`

**Issue:** `decoded.header.kid` is typed `string | undefined` in the `jsonwebtoken` types. When `kid` is absent, `jwks-rsa@4.x`'s `getSigningKey(undefined)` behaviour is implementation-defined: depending on the number of keys in the JWKS response it may return an arbitrary key rather than throwing. In the current code, that ambiguous path is silently folded into `AUTH.KEY_NOT_FOUND` via the outer catch, which obscures the root cause. More significantly, there are no tests for a `kid`-less token, leaving this path unvalidated. All legitimate Entra ID v2.0 tokens include a `kid`, so an explicit guard also acts as an early rejection gate for malformed input.

**Fix:**
```typescript
const decoded = jwt.decode(rawToken, { complete: true });
if (!decoded || typeof decoded === 'string') {
  throw new UnauthorizedException('AUTH.INVALID_TOKEN_FORMAT');
}
if (!decoded.header.kid) {
  throw new UnauthorizedException('AUTH.INVALID_TOKEN_FORMAT');
}
```

---

### WR-04: `env.schema.ts` — `ENTRA_CLIENT_ID` required at startup but never consumed by any production code

**File:** `packages/backend/src/config/env.schema.ts:16,31-33`

**Issue:** The `superRefine` block adds `ENTRA_CLIENT_ID` to the list of required keys when `AUTH_MODE=entra`, causing startup to fail with a `ZodError` if the variable is absent. Confirmed by exhaustive grep: `config.get('ENTRA_CLIENT_ID')` is never called anywhere in `src/` outside spec files. `EntraTokenValidator` uses only `ENTRA_TENANT_ID` (for the JWKS URI and issuer) and `ENTRA_AUDIENCE` (for `jwt.verify`). The effect is that operators are blocked from deploying unless they supply a value that the running service ignores. This will cause confusion during future onboarding and makes the schema a misleading source of truth for required configuration.

**Fix:** Remove `ENTRA_CLIENT_ID` from the schema's `required` array and from the `z.object` definition entirely, or add `config.get('ENTRA_CLIENT_ID')` to the `EntraTokenValidator` constructor call-chain (e.g., for client-assertion flows in a future phase) and document why it is collected now. Do not leave it required but unused.

```typescript
// Remove from the required array in superRefine:
const required: Array<'ENTRA_TENANT_ID' | 'ENTRA_AUDIENCE'> = [
  'ENTRA_TENANT_ID',
  'ENTRA_AUDIENCE',
];
```

Also update `env.schema.spec.ts` Test C to no longer supply `ENTRA_CLIENT_ID`.

---

### WR-05: `AuthAuditContextProvider` — `ClsService` injected but never read

**File:** `packages/backend/src/auth/auth-audit-context-provider.ts:15`

**Issue:** `private readonly cls: ClsService` is injected via the constructor but `getContext()` returns a hard-coded `null` without accessing `cls` at all. The comment acknowledges this ("userId is accessible as cls.get('user')?.entraId but is deliberately not returned"), but the constructor parameter still participates in NestJS DI resolution: the container must resolve `ClsService` for every instantiation of this provider despite it being unused. Per CLAUDE.md §18, dead injections should not remain. This also misleads readers who see `ClsService` as a dependency and assume it is used somewhere in the method body.

**Fix:**
```typescript
@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  // Phase 6 will inject ClsService here to supply userId and organizationId.
  getContext(): AuditContext | null {
    return null;
  }
}
```
Remove the `ClsService` import and constructor when the dependency is not yet used.

---

### WR-06: `GlobalExceptionFilter` — stack traces exposed in non-production responses, violating CLAUDE.md §11

**File:** `packages/backend/src/common/exceptions/global-exception.filter.ts:64-66`

**Issue:** When `config.isProduction` is `false`, the full `Error.stack` is serialised into the HTTP response body under the key `stack`. CLAUDE.md §11 states: "Never expose: secrets, stack traces, internal IDs unintentionally." Stack traces disclose file paths, internal class and module names, and NestJS routing internals to any client that can reach a non-production environment (e.g., a staging server, a shared dev cluster, or a CI/CD preview environment). This violates the project's own security policy and can accelerate targeted attacks if the environment is reachable externally.

**Fix:** Remove the conditional stack disclosure entirely. Use server-side structured logging (already wired via `nestjs-pino`) to capture stack traces where they are needed for debugging, without exposing them to HTTP clients.

```typescript
// Delete lines 64-66:
// if (!this.config.isProduction && exception instanceof Error) {
//   body['stack'] = exception.stack;
// }
```

---

### WR-07: `app.integration.spec.ts` — CORS rejection assertion does not verify that the header is absent

**File:** `packages/backend/src/app.integration.spec.ts:232-234`

**Issue:** The assertion for a blocked (evil) origin is:
```typescript
expect(rejectedHeaders['access-control-allow-origin']).not.toBe('http://evil.example.com');
```
This assertion passes under any of three distinct conditions: (a) the header is absent (correct CORS rejection), (b) the header is `*` (CORS fully open — a mis-configuration), or (c) the header reflects a different allowed origin. A regression that enables wildcard CORS would not be caught. The correct assertion for rejection is that the header is either absent or does not equal the unlisted origin.

**Fix:**
```typescript
// Stronger: assert the header is not present at all for an unlisted origin
expect(rejectedHeaders['access-control-allow-origin']).toBeUndefined();
```

---

## Info

### IN-01: `app.integration.spec.ts` — `require('child_process')` used inside a test body in an ESM module

**File:** `packages/backend/src/app.integration.spec.ts:420`

**Issue:** The file uses ES module `import` statements at the top level but line 420 uses a CommonJS `require()` call inside the test body. While SWC transpilation makes this work currently, it is inconsistent with the module system in use and may silently fail if the test runner configuration changes (e.g., switching to native ESM without transpilation). Additionally, `process.cwd()` on line 424 is commented as being reliable only "when tests run via npm workspace" — running from a different working directory would make `grep` fail to find the directory, and that failure would be misinterpreted by `expect(...).toThrow()` as proof that no `passport-azure-ad` import exists, producing a false-pass.

**Fix:**
```typescript
// Top of file, with other imports:
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In the test body:
const srcPath = resolve(__dirname, '../');  // resolves to packages/backend/src
expect(() =>
  execSync(`grep -r "passport-azure-ad" "${srcPath}" --include="*.ts" --exclude="*.spec.ts"`),
).toThrow();
```

---

### IN-02: `auth.module.ts` — `JwtAuthGuard` and `AuthAuditContextProvider` exported from `AuthModule` but consumed via direct `useClass` in `AppModule`

**File:** `packages/backend/src/auth/auth.module.ts:31`

**Issue:** `AuthModule` exports both `JwtAuthGuard` and `AuthAuditContextProvider`. Neither export is consumed by any other module via injection token — `AppModule` references the concrete class directly in `APP_GUARD` and `IAuditContextProvider` provider registrations. The exports create the impression that these classes are intended to be injected into downstream domain modules, which conflicts with the D-08 comment ("auth lives in src/auth/ and is independent of domain bounded contexts"). Exporting `JwtAuthGuard` specifically could tempt a future developer to add a module-level guard via import rather than keeping everything global through `APP_GUARD`.

**Fix:** Remove `JwtAuthGuard` and `AuthAuditContextProvider` from the `exports` array. Export only `TokenValidator`, which is the sole auth abstraction that callers outside the auth module might legitimately need.

```typescript
exports: [TokenValidator],
```

---

_Reviewed: 2026-07-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
