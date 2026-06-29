# Testing Patterns

**Analysis Date:** 2026-06-29

## Current State Assessment

**Test infrastructure: absent.**

As of this analysis, the codebase contains zero test files, zero test runner configuration, and zero testing dependencies. This is the honest baseline. The sections below document:
1. What the declared standard mandates (from `CLAUDE.md` / `AGENTS.md`)
2. What is present in actual code
3. The gap and the recommended setup path

---

## Declared Testing Standard

Source: `/Users/amish/AI_SDLC/CLAUDE.md` §15 and §18 (identical in `/Users/amish/AI_SDLC/AGENTS.md`)

**Every feature must include appropriate tests.**

**Preferred test types:**
- Unit tests
- Integration tests

**Bug-fix discipline:**
1. Reproduce the bug
2. Write a failing test
3. Fix it
4. Verify the test passes

**Definition of done (§18) requires:**
- Tests pass (listed as a non-negotiable gate before declaring completion)

**Testing is a first-class requirement**, not an afterthought.

---

## Test Framework

**Runner:** Not yet configured.

**Recommended setup for NestJS + Prisma stack:**

| Layer | Recommended Tool |
|-------|-----------------|
| Unit test runner | Jest (standard for NestJS ecosystem) |
| Integration tests | Jest + `@nestjs/testing` |
| Database integration | Jest + `prisma/__mocks__` or a test database |
| Type checking | `tsc --noEmit` as part of CI |

**Config file to create:** `jest.config.ts` at each package root (e.g., `packages/database/jest.config.ts`) and at the monorepo root.

**Run Commands (to be established):**
```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

---

## Test File Organization

**Current:** No test files exist anywhere in the repo outside of `node_modules` and `.git`.

**Recommended pattern for NestJS packages:**

```
packages/database/
├── src/
│   ├── prisma.service.ts
│   ├── prisma.service.spec.ts   # unit test co-located with source
│   ├── prisma.module.ts
│   └── index.ts
└── test/
    └── prisma.integration.spec.ts   # integration tests in separate dir
```

**Naming convention to adopt:**
- Unit tests: `<filename>.spec.ts` co-located with source
- Integration tests: `<name>.integration.spec.ts` in `test/` directory
- E2E tests (future): `<name>.e2e-spec.ts` in `test/` directory

---

## What Should Be Tested

### Unit Tests (immediate priority)

Once service-layer code is written, every service method needs unit test coverage.

**Pattern for NestJS service tests:**
```typescript
// packages/<service>/src/<name>.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '@repo/database';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get(PrismaService);
  });

  describe('findOrganizationBySlug', () => {
    it('returns organization when found', async () => {
      const expected = { id: 'cuid', slug: 'system', name: 'System Organization' };
      prisma.organization.findUnique.mockResolvedValue(expected as any);

      const result = await service.findOrganizationBySlug('system');

      expect(result).toEqual(expected);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'system' },
      });
    });

    it('throws NotFoundException when organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOrganizationBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Integration Tests (database layer)

The `PrismaService` in `packages/database/src/prisma.service.ts` is a thin NestJS wrapper. Its integration test should verify lifecycle hook behavior against a real (test) PostgreSQL instance.

**Pattern:**
```typescript
// packages/database/test/prisma.integration.spec.ts
import { Test } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '../src';

describe('PrismaService (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('connects to the database', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
});
```

**Requires:** `DATABASE_URL` pointing to a dedicated test database (not production, not development). Use `.env.test` for this.

### Seed Script Testing

`packages/database/prisma/seed.ts` is currently untested. At minimum, the seed should be runnable against an empty test database and be idempotent (all operations use `upsert`). Verify idempotency by running the seed twice and asserting record counts do not change.

---

## Mocking

**Framework:** Jest mocks (to be adopted)

**What to mock in unit tests:**
- `PrismaService` — mock individual model accessor methods (`prisma.organization.findUnique`, etc.)
- External HTTP clients (AI provider SDKs, VCS APIs)
- `Date.now()` when testing time-sensitive logic

**What NOT to mock:**
- Business logic under test
- NestJS module wiring in integration tests
- The database in integration tests (use a real test DB)

**Prisma mock pattern:**

Do not use the generated Prisma client directly in unit tests. Create a typed mock helper:

```typescript
// packages/<service>/src/test/prisma.mock.ts
import { PrismaService } from '@repo/database';

export const createPrismaMock = (): jest.Mocked<PrismaService> =>
  ({
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    // add other models as needed
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as any);
```

---

## Fixtures and Factories

**Current state:** No fixtures or factories exist.

**Pattern to adopt:**

Define typed factory functions for test data. Locate them in `test/factories/` within each package.

```typescript
// packages/<service>/test/factories/organization.factory.ts
import { Organization } from '@repo/database';

export function buildOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'cuid_org_1',
    name: 'Test Organization',
    slug: 'test-org',
    description: null,
    logoUrl: null,
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}
```

---

## Coverage

**Requirements:** None enforced (no coverage thresholds configured).

**Recommended thresholds once infrastructure is set up:**
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**Per CLAUDE.md §18**, tests passing is a gate before any task is declared done. Coverage metrics alone are insufficient — test quality matters more than percentage.

**View Coverage (command to establish):**
```bash
npm run test:coverage
```

---

## Test Types

### Unit Tests

- **Scope:** Single class or function in isolation
- **Approach:** Mock all external dependencies (Prisma, HTTP clients, config)
- **Location:** Co-located as `<filename>.spec.ts`
- **What to cover:** All service methods, all error branches, all business rules

### Integration Tests

- **Scope:** Multiple layers working together (NestJS module + real Prisma + test DB)
- **Approach:** Use a real PostgreSQL test database; run migrations before tests
- **Location:** `test/` directory per package
- **What to cover:** Repository queries, transaction behavior, constraint enforcement

### E2E Tests

- **Framework:** Not yet determined (Supertest + Jest is standard for NestJS HTTP APIs)
- **Status:** Not applicable until API controllers are implemented
- **When to add:** With first HTTP endpoint implementation

---

## Test Environment Setup (Required Work)

The following must be done before any tests can be written:

1. **Add Jest to root and package dependencies:**
   ```json
   // packages/database/package.json devDependencies to add
   "@nestjs/testing": "^11.x",
   "jest": "^29.x",
   "ts-jest": "^29.x",
   "@types/jest": "^29.x"
   ```

2. **Create `jest.config.ts` in `packages/database/`:**
   ```typescript
   import type { Config } from 'jest';

   const config: Config = {
     moduleFileExtensions: ['js', 'json', 'ts'],
     rootDir: 'src',
     testRegex: '.*\\.spec\\.ts$',
     transform: { '^.+\\.(t|j)s$': 'ts-jest' },
     coverageDirectory: '../coverage',
     testEnvironment: 'node',
   };

   export default config;
   ```

3. **Create `.env.test`** (not committed) with a test database URL.

4. **Add `test` script to `packages/database/package.json`:**
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage"
   }
   ```

5. **Add `tsconfig.json`** to resolve TypeScript compilation (currently absent).

---

## Bug Fix Protocol

Per CLAUDE.md §15, when fixing any bug:

1. Reproduce the failure with a minimal case
2. Write a failing test that captures the exact failure
3. Fix the implementation
4. Verify the test now passes
5. Confirm no other tests regressed

This workflow is mandatory — do not fix bugs without a covering test.

---

*Testing analysis: 2026-06-29*
