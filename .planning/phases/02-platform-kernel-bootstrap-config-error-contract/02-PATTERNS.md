# Phase 2: Platform Kernel — Bootstrap, Config & Error Contract - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 14 (10 source + 4 test)
**Analogs found:** 4 / 14

---

## NestJS Scaffold Status

The NestJS application scaffold does **not** yet exist in `packages/backend/src/`. The directory contains only two files:

- `packages/backend/src/index.ts` (3 lines — re-exports `@repo/database`; no bootstrap)
- `packages/backend/src/index.spec.ts` (7 lines — Vitest workspace sanity check)

There is no `main.ts`, `AppModule`, config module, exception filter, or middleware. **All 10 source files are net-new with no in-project analog.** Four codebase files serve as structural analogs for NestJS decoration/module/test conventions:

| Analog File | Lines | What It Demonstrates |
|---|---|---|
| `packages/database/src/prisma.module.ts` | 9 | `@Global()` + `@Module({ providers, exports })` shape |
| `packages/database/src/prisma.service.ts` | 13 | `@Injectable()` service with `implements` lifecycle hooks |
| `packages/backend/src/index.spec.ts` | 7 | Vitest `describe`/`it`/`expect` import and block structure |
| `eslint.config.mjs` | 19 | ESLint 9 flat config array structure for rule addition |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/main.ts` | bootstrap | request-response | none | none |
| `packages/backend/src/app.module.ts` | config | request-response | `packages/database/src/prisma.module.ts` | partial (module shape, no `@Global`) |
| `packages/backend/src/config/env.schema.ts` | utility | transform | none | none |
| `packages/backend/src/config/app-config.service.ts` | service | request-response | `packages/database/src/prisma.service.ts` | role-match (Injectable service) |
| `packages/backend/src/config/config.module.ts` | config | request-response | `packages/database/src/prisma.module.ts` | exact (Global module with providers/exports) |
| `packages/backend/src/common/exceptions/error-codes.ts` | utility | N/A | none | none |
| `packages/backend/src/common/exceptions/global-exception.filter.ts` | middleware | request-response | none | none |
| `packages/backend/src/common/exceptions/prisma-exception.filter.ts` | middleware | request-response | none | none |
| `packages/backend/src/common/middleware/correlation-id.middleware.ts` | middleware | request-response | none | none |
| `eslint.config.mjs` (modify) | config | N/A | `eslint.config.mjs` | exact (self — append rule objects) |
| `packages/backend/src/config/env.schema.spec.ts` | test | transform | `packages/backend/src/index.spec.ts` | role-match |
| `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` | test | request-response | `packages/backend/src/index.spec.ts` | role-match |
| `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` | test | request-response | `packages/backend/src/index.spec.ts` | role-match |
| `packages/backend/src/app.integration.spec.ts` | test | request-response | `packages/backend/src/index.spec.ts` | partial-match |

---

## Pattern Assignments

### `packages/backend/src/main.ts` (bootstrap, request-response)

**Analog:** none in codebase — use RESEARCH.md Pattern 1.

**Key constraints from codebase:**

- `nest-cli.json` sets `"entryFile": "index"` — the build entry is `index.ts`, not `main.ts`. The planner must either update `nest-cli.json` to `"entryFile": "main"` or keep `main.ts` and re-export from `index.ts`. Recommend updating `nest-cli.json`.
- `packages/backend/tsconfig.json` sets `"rootDir": "./src"` — `main.ts` must live at `src/main.ts`.
- `AppConfigService` must be retrieved via `app.get(AppConfigService)` after `NestFactory.create` to read `PORT` from typed config — not from `process.env` directly (INFRA-03).

**Bootstrap ordering (critical — copy exactly):**
```typescript
// packages/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');                           // MUST precede enableVersioning
  app.enableVersioning({ type: VersioningType.URI });   // adds /v prefix automatically

  const config = app.get(AppConfigService);
  await app.listen(config.get('PORT'));
}

bootstrap();
```

**`nest-cli.json` delta** — update `entryFile` from `"index"` to `"main"`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "entryFile": "main",
  "compilerOptions": {
    "builder": { "type": "swc" },
    "deleteOutDir": true
  }
}
```

---

### `packages/backend/src/app.module.ts` (root module, request-response)

**Analog:** `packages/database/src/prisma.module.ts` (lines 1–9) — same `@Module` decorator shape; differs in that `AppModule` is not `@Global`, imports external modules, and implements `NestModule` for middleware.

**Module shape from analog** (`packages/database/src/prisma.module.ts`, lines 1–9):
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**AppModule pattern (copy decorator shape; add `imports`, `NestModule`, middleware wiring):**
```typescript
// packages/backend/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '@repo/database';
import { AppConfigModule } from './config/config.module';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { PrismaExceptionFilter } from './common/exceptions/prisma-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },   // registered first → runs second
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },   // registered second → runs first
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

---

### `packages/backend/src/config/env.schema.ts` (utility, transform)

**Analog:** none — net-new. No schema/validation utility files exist anywhere in the monorepo.

**Constraints from tsconfig.base.json:** `"strict": true`, `"noUncheckedIndexedAccess": true` — the Zod schema must produce types compatible with strict mode.

**Pattern (from RESEARCH.md — no codebase analog):**
```typescript
// packages/backend/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

export type Env = z.infer<typeof envSchema>;
```

**Note:** `z.coerce.number()` not `z.number()` — env vars are always strings; coerce handles `"3000"` → `3000`. The `min(1)` guard prevents `PORT=""` coercing to `0`.

---

### `packages/backend/src/config/app-config.service.ts` (service, request-response)

**Analog:** `packages/database/src/prisma.service.ts` (lines 1–13) — `@Injectable()` class, no constructor params shown but the decorator and `implements` pattern is the same.

**Injectable pattern from analog** (`packages/database/src/prisma.service.ts`, lines 1–13):
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**AppConfigService — copy `@Injectable()` decorator + constructor injection pattern:**
```typescript
// packages/backend/src/config/app-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
```

**Why `ConfigService<Env, true>`:** The `true` generic activates strict type inference — `get('PORT')` returns `number`, not `number | undefined`. Without it, callers must cast.

---

### `packages/backend/src/config/config.module.ts` (config module, request-response)

**Analog:** `packages/database/src/prisma.module.ts` (lines 1–9) — exact structural match: `@Global()` + `@Module({ providers, exports })`.

**Analog** (`packages/database/src/prisma.module.ts`, lines 1–9):
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Config module — copy `@Global()` + `@Module` shape; add `ConfigModule.forRoot` as nested import:**
```typescript
// packages/backend/src/config/config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),  // throws ZodError on invalid → fail-fast
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

**Note:** `envSchema.parse()` not `envSchema.safeParse()` — `safeParse` does not throw, so the app would start with invalid config. `parse` throws `ZodError`, which NestJS catches at startup and exits non-zero.

---

### `packages/backend/src/common/exceptions/error-codes.ts` (utility, N/A)

**Analog:** none — net-new. No error-code or constants file exists in the monorepo.

**Pattern (RESEARCH.md D-03, D-04, D-05 — const object, not enum, so Phase 3 catalog absorbs without renaming):**
```typescript
// packages/backend/src/common/exceptions/error-codes.ts
export const PLATFORM_ERROR_CODES = {
  RESOURCE_CONFLICT: 'PLATFORM.RESOURCE_CONFLICT',
  NOT_FOUND: 'PLATFORM.NOT_FOUND',
  VALIDATION_ERROR: 'PLATFORM.VALIDATION_ERROR',
  INTERNAL_ERROR: 'PLATFORM.INTERNAL_ERROR',
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];
```

**Why `as const` not `enum`:** D-05 requires this to be absorbable into the Phase 3 catalog without renaming. A `const` object with `as const` gives the same nominal-string guarantees an enum would, while being easy to spread or extend in Phase 3.

---

### `packages/backend/src/common/exceptions/global-exception.filter.ts` (middleware, request-response)

**Analog:** none — no exception filters exist anywhere in the monorepo. Use RESEARCH.md Pattern 3.

**Key injection constraint:** Must be registered via `APP_FILTER` (not `app.useGlobalFilters`) so it can inject `AppConfigService` through NestJS DI. `app.useGlobalFilters(new Filter())` runs outside the DI container and cannot inject services.

**Imports pattern — note `@nestjs/common` decorators + typed Express req/res:**
```typescript
// packages/backend/src/common/exceptions/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES } from './error-codes';
```

**Core filter pattern:**
```typescript
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttp ? exception.getResponse() : null;
    const message =
      isHttp && typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse
        ? String((rawResponse as Record<string, unknown>)['message'])
        : isHttp
          ? exception.message
          : 'An unexpected error occurred';

    const body: Record<string, unknown> = {
      success: false,
      errorCode: PLATFORM_ERROR_CODES.INTERNAL_ERROR,
      message,
      traceId: request.traceId ?? 'unknown',
    };

    if (!this.config.isProduction && exception instanceof Error) {
      body['stack'] = exception.stack;
    }

    response.status(status).json(body);
  }
}
```

**traceId fallback:** `request.traceId ?? 'unknown'` — the `'unknown'` string is the last-resort guard if middleware did not run. Integration tests must assert `traceId` is a UUID (not `'unknown'`) for all routes.

---

### `packages/backend/src/common/exceptions/prisma-exception.filter.ts` (middleware, request-response)

**Analog:** none — no exception filters exist anywhere in the monorepo. Use RESEARCH.md Pattern 4.

**Critical import:** `Prisma` namespace from `@repo/database`, not directly from `@prisma/client`. Verified: `packages/database/generated/client/index.d.ts` line 1964 declares `export namespace Prisma` containing `PrismaClientKnownRequestError` at line 1977, re-exported through `packages/database/src/index.ts` via `export * from '../generated/client'`.

**Imports pattern:**
```typescript
// packages/backend/src/common/exceptions/prisma-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@repo/database';
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES } from './error-codes';
```

**Core filter pattern — map table, then `@Catch` on the specific class:**
```typescript
const PRISMA_HTTP_MAP: Record<string, { status: number; errorCode: string; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    errorCode: PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
    message: 'Resource already exists',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    errorCode: PLATFORM_ERROR_CODES.NOT_FOUND,
    message: 'Resource not found',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
@Injectable()
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const mapped = PRISMA_HTTP_MAP[exception.code];
    const status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode = mapped?.errorCode ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR;
    const message = mapped?.message ?? 'Database operation failed';

    response.status(status).json({
      success: false,
      errorCode,
      message,
      traceId: request.traceId ?? 'unknown',
    });
  }
}
```

**`exception.meta` is never forwarded** — the mapped `message` string is fixed; schema/field details from `exception.meta` must not be included in the response (CLAUDE.md §11).

**Registration order in `app.module.ts`:** `GlobalExceptionFilter` must be listed first, `PrismaExceptionFilter` second. NestJS executes `APP_FILTER` providers in reverse registration order — the Prisma filter (registered second) runs first and handles Prisma errors before the global filter sees them.

---

### `packages/backend/src/common/middleware/correlation-id.middleware.ts` (middleware, request-response)

**Analog:** none — no middleware files exist in the monorepo. Use RESEARCH.md Pattern 5.

**Phase 3 seam note (D-02):** When AsyncLocalStorage lands in Phase 3, this middleware is replaced by the ALS correlation middleware. The exception filter switches from reading `req.traceId` to reading from the ALS store. The envelope contract does not change. Store the ID on the request object for now — it makes the Phase 3 swap localized to this file and the filter's `request.traceId` read.

**Pattern:**
```typescript
// packages/backend/src/common/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    const fromHeader =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['traceparent'] as string | undefined);

    req.traceId = fromHeader ?? crypto.randomUUID();
    next();
  }
}
```

**`crypto.randomUUID()`** is Node 22 built-in (no package needed). The `.nvmrc` pins Node 22.22.3 — confirmed in RESEARCH.md Environment Availability table.

---

### `eslint.config.mjs` (config modification)

**Analog:** itself — the file exists at `/Users/amish/AI_SDLC/eslint.config.mjs` (lines 1–19). The pattern is to append new config objects to the `tseslint.config()` call array.

**Current file** (`eslint.config.mjs`, lines 1–19):
```javascript
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig, // MUST be last — disables rules that conflict with Prettier
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.js',
      '.planning/**',
    ],
  },
);
```

**IMPORTANT:** `prettierConfig` must remain the last item in the array — it disables formatting rules that conflict with Prettier. New rule objects must be inserted **before** `prettierConfig`.

**Rule objects to insert before `prettierConfig`:**
```javascript
{
  // Applied to all TS files across the monorepo — ban direct process.env access
  files: ['**/*.ts'],
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'process',
        property: 'env',
        message:
          'Access process.env only through AppConfigService (packages/backend/src/config/). See INFRA-03.',
      },
    ],
  },
},
{
  // Config module is the ONLY allowed escape hatch
  files: ['packages/backend/src/config/**/*.ts'],
  rules: {
    'no-restricted-properties': 'off',
  },
},
```

**`prettierConfig` ordering constraint:** These two objects go at positions 3 and 4 in the array (after `tseslint.configs.recommended`, before `prettierConfig`). The `ignores` object and `prettierConfig` remain in their current relative positions.

---

### `packages/backend/src/config/env.schema.spec.ts` (test, transform)

**Analog:** `packages/backend/src/index.spec.ts` (lines 1–8) — exact test file structure: Vitest named imports, `describe`/`it`/`expect` pattern.

**Test file structure from analog** (`packages/backend/src/index.spec.ts`, lines 1–8):
```typescript
import { describe, it, expect } from 'vitest';

describe('workspace sanity', () => {
  it('resolves @repo/database barrel export', async () => {
    const database = await import('@repo/database');
    expect(database).toBeDefined();
  });
});
```

**env.schema.spec.ts pattern — copy describe/it/expect structure; test validate function directly:**
```typescript
import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  it('parses valid env', () => {
    const result = envSchema.parse({ DATABASE_URL: 'postgresql://x', PORT: '3000', NODE_ENV: 'test' });
    expect(result.PORT).toBe(3000);           // coerced to number
    expect(result.NODE_ENV).toBe('test');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => envSchema.parse({ PORT: '3000', NODE_ENV: 'test' })).toThrow();
  });

  it('throws when PORT is invalid', () => {
    expect(() => envSchema.parse({ DATABASE_URL: 'postgresql://x', PORT: '0', NODE_ENV: 'test' })).toThrow();
  });

  it('defaults PORT to 3000 when omitted', () => {
    const result = envSchema.parse({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'test' });
    expect(result.PORT).toBe(3000);
  });
});
```

---

### `packages/backend/src/common/exceptions/global-exception.filter.spec.ts` (test, request-response)

**Analog:** `packages/backend/src/index.spec.ts` (lines 1–8) — Vitest structure.

**Filter test pattern — mock `ArgumentsHost` manually (no NestJS testing module needed for unit tests):**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function makeHost(traceId?: string) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const getRequest = vi.fn().mockReturnValue({ traceId });
  return { switchToHttp: () => ({ getResponse, getRequest }) } as any;
}

function makeConfig(isProduction = false) {
  return { isProduction } as any;
}

describe('GlobalExceptionFilter', () => {
  it('returns error envelope for HttpException', () => {
    const filter = new GlobalExceptionFilter(makeConfig());
    const host = makeHost('test-uuid');
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    const jsonArg = host.switchToHttp().getResponse().status().json.mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.traceId).toBe('test-uuid');
  });

  it('omits stack in production', () => {
    const filter = new GlobalExceptionFilter(makeConfig(true));
    const host = makeHost('x');
    filter.catch(new Error('boom'), host);
    const jsonArg = host.switchToHttp().getResponse().status().json.mock.calls[0][0];
    expect(jsonArg['stack']).toBeUndefined();
  });
});
```

---

### `packages/backend/src/common/exceptions/prisma-exception.filter.spec.ts` (test, request-response)

**Analog:** `packages/backend/src/index.spec.ts` (lines 1–8) — Vitest structure.

**Pattern — instantiate `PrismaClientKnownRequestError` from `@repo/database`:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@repo/database';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function makeHost(traceId = 'uuid') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ traceId }) }) } as any;
}

describe('PrismaExceptionFilter', () => {
  it('maps P2002 to 409 PLATFORM.RESOURCE_CONFLICT', () => {
    const filter = new PrismaExceptionFilter({} as any);
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '0',
    });
    filter.catch(err, makeHost());
    const arg = makeHost().switchToHttp().getResponse().status.mock?.calls[0];
    // Assert via spy on the host passed to filter
  });
});
```

**Note:** Constructing `PrismaClientKnownRequestError` requires `{ code, clientVersion }` — the second argument changed in Prisma 5+. Check `packages/database/generated/client/index.d.ts` constructor signature at implementation time.

---

### `packages/backend/src/app.integration.spec.ts` (test, request-response)

**Analog:** `packages/backend/src/index.spec.ts` (lines 1–8) — Vitest structure. This is a partial match only — integration tests need `supertest` and `NestFactory`, which don't appear in the existing spec.

**Pattern — minimal NestJS integration test with supertest:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';

describe('App (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(() => app.close());

  it('returns a traceId UUID in error envelope for unknown route', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/v1/nonexistent').expect(404);
    expect(body.success).toBe(false);
    expect(body.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

**`supertest` dependency:** Not yet in `packages/backend/package.json`. Must be added as `devDependency`. Check if it is already present at the workspace root before adding per-package.

---

## Shared Patterns

### NestJS `@Injectable()` Service Decorator
**Source:** `packages/database/src/prisma.service.ts` lines 1–3
**Apply to:** `app-config.service.ts`, `global-exception.filter.ts`, `prisma-exception.filter.ts`, `correlation-id.middleware.ts`
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class SomeName { ... }
```

### NestJS `@Global()` + `@Module({ providers, exports })` Module Shape
**Source:** `packages/database/src/prisma.module.ts` lines 1–9
**Apply to:** `config.module.ts` (exact shape with `@Global()`); `app.module.ts` (without `@Global()`, adds `imports` and `NestModule`)
```typescript
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [SomeService],
  exports: [SomeService],
})
export class SomeModule {}
```

### Vitest Test File Structure
**Source:** `packages/backend/src/index.spec.ts` lines 1–8
**Apply to:** All four `*.spec.ts` files
```typescript
import { describe, it, expect } from 'vitest';

describe('subject', () => {
  it('does something', () => {
    expect(true).toBe(true);
  });
});
```

### ESLint Flat Config Array Extension
**Source:** `eslint.config.mjs` lines 6–19
**Apply to:** `eslint.config.mjs` modification — insert new objects inside `tseslint.config(...)` before `prettierConfig`
```javascript
export default tseslint.config(
  // ... existing objects ...
  { files: [...], rules: { ... } },  // new object goes here
  prettierConfig,                     // MUST remain last
);
```

---

## No Analog Found

Files with no close match in the codebase — planner must use RESEARCH.md patterns as the reference:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/backend/src/main.ts` | bootstrap | request-response | No NestJS bootstrap file exists anywhere in the project; `index.ts` is a re-export shim, not a bootstrap |
| `packages/backend/src/common/exceptions/error-codes.ts` | utility | N/A | No constants/error-codes file of any kind exists in the monorepo |
| `packages/backend/src/common/exceptions/global-exception.filter.ts` | middleware | request-response | No NestJS exception filter exists anywhere in the project |
| `packages/backend/src/common/exceptions/prisma-exception.filter.ts` | middleware | request-response | Same — no exception filter exists; no Prisma error mapping exists |
| `packages/backend/src/common/middleware/correlation-id.middleware.ts` | middleware | request-response | No NestJS middleware exists anywhere in the project |
| `packages/backend/src/config/env.schema.ts` | utility | transform | No Zod schema or env validation file exists anywhere in the monorepo |

---

## Additional Landmines for Planner

1. **`nest-cli.json` `entryFile`:** Currently `"index"` — must change to `"main"` when `main.ts` is introduced, or the `nest build` command will compile the wrong entry point.

2. **`packages/backend/src/index.ts`:** Currently re-exports `@repo/database`. Once `main.ts` becomes the real entry, `index.ts` can be left as-is (Turborepo build only uses the compiled output), but it should not re-export `@repo/database` from the backend public surface — review whether to remove or repurpose it.

3. **`@nestjs/platform-express` missing:** Not in `packages/backend/package.json` — must be added as `dependency` (runtime, not dev). Same for `@nestjs/config` and `zod`.

4. **`supertest` missing:** Not present in the monorepo — must be added as `devDependency` if the integration test uses it. Check root `package.json` first.

5. **`prettierConfig` must stay last:** When modifying `eslint.config.mjs`, insert new rule objects before `prettierConfig`. Moving it would silently re-enable formatting rules that conflict with Prettier.

6. **Prisma `PrismaClientKnownRequestError` constructor signature:** In Prisma 5+, the second argument is `{ code: string; clientVersion: string; meta?: Record<string, unknown> }`. Confirm against `packages/database/generated/client/index.d.ts` at implementation time before writing test instantiation.

7. **`noUncheckedIndexedAccess`:** `tsconfig.base.json` enables this. In `PRISMA_HTTP_MAP[exception.code]` the result type is `{ status, errorCode, message } | undefined` — the `??` fallback chain in the filter already handles this correctly, but the planner should note it to avoid TypeScript errors on the index access.

---

## Metadata

**Analog search scope:** `packages/backend/src/`, `packages/database/src/`, `eslint.config.mjs`
**Files scanned:** 7 (all existing source files in those directories)
**Pattern extraction date:** 2026-06-30
