# Coding Conventions

**Analysis Date:** 2026-06-29

## Authoritative Sources

Declared engineering standards live in two identical files:
- `/Users/amish/AI_SDLC/CLAUDE.md` — consumed by Claude AI agents
- `/Users/amish/AI_SDLC/AGENTS.md` — consumed by non-Claude AI agents

Both files are identical and define the canonical, binding conventions for this project. Where actual code diverges from them, that divergence is called out explicitly below.

---

## Naming Patterns

### Files

**Declared (CLAUDE.md §8):** Names must explain intent. No abbreviations unless universally understood.

**Observed practice (`packages/database/src/`):**
- NestJS modules: `prisma.module.ts` — `<entity>.<type>.ts` pattern
- NestJS services: `prisma.service.ts` — `<entity>.<type>.ts` pattern
- Barrel exports: `index.ts`

**Schema files (`packages/database/prisma/schema/`):**
- Named by domain: `identity.prisma`, `organization.prisma`, `ai-platform.prisma`, `planning.prisma`, `development.prisma`, `delivery.prisma`, `testing.prisma`, `validation.prisma`, etc.
- Root config files: `schema.prisma` (generator + datasource only)

### Classes / Types

- NestJS classes: PascalCase — `PrismaService`, `PrismaModule`
- Prisma models: PascalCase — `Organization`, `WorkflowRun`, `AiExecution`, `HumanApproval`
- Prisma enums: PascalCase — `UserStatus`, `ModelProvider`, `WorkflowStatus`

### Enum Values

- SCREAMING_SNAKE_CASE throughout all Prisma schemas: `ACTIVE`, `WAITING_FOR_APPROVAL`, `AWS_BEDROCK`, `CHANGES_REQUESTED`

### Database Table Names

All Prisma models use `@@map("snake_case")` to normalize DB table names:
- `Organization` → `organizations`
- `WorkflowRun` → `workflow_runs`
- `AiExecution` → `ai_executions`
- `RolePermission` → `role_permissions`
- `GeneratedCode` → `generated_code`

This separation of model name (PascalCase) from table name (snake_case) is consistent across all schema files.

### Relation Names

Prisma relations use descriptive quoted string names that follow `"<OwnerModel><PluralRelation>"` convention:
- `@relation("OrganizationProjects")`
- `@relation("UserOrganizations")`
- `@relation("WorkflowRunAiExecutions")`

This pattern makes bi-directional relations unambiguous and follows the intent-naming principle from CLAUDE.md §8.

### Variables / Parameters (TypeScript)

- camelCase for all local variables, function parameters, and object properties
- Observed in `packages/database/prisma/seed.ts`: `organizationId`, `permissionByCode`, `capabilityByKey`, `roleSeed`, `capabilitySeed`

### Constants (seed data)

Module-level constant arrays/objects use SCREAMING_SNAKE_CASE when representing domain data sets:
- `PERMISSIONS`, `ROLES`, `CAPABILITIES`, `PROMPTS`, `CONFIGURATIONS`, `MODEL_BY_CAPABILITY`

This is observed in `packages/database/prisma/seed.ts` and is a good separation of data from logic.

---

## Code Style

### Formatting

**Declared:** CLAUDE.md §7 requires code to be small, readable, self-documenting, and consistent.

**Observed:**
- No Prettier config file detected (`.prettierrc` absent)
- No ESLint config file detected (`.eslintrc*` / `eslint.config.*` absent)
- No `tsconfig.json` detected at root or in `packages/database/`

**Gap:** No automated formatter or linter is configured. Style correctness depends entirely on developer discipline and AI agent adherence to CLAUDE.md. This is a significant gap for an enterprise-grade codebase — formatting and linting tools must be added before service-layer code is written.

### Code Size

**Declared (CLAUDE.md §2, §7):** Minimum code. If 200 lines could be 50, rewrite it. No abstractions for single-use code.

**Observed:** All three hand-written TypeScript files are minimal:
- `packages/database/src/prisma.service.ts` — 22 lines
- `packages/database/src/prisma.module.ts` — 9 lines
- `packages/database/src/index.ts` — 5 lines

### Avoid

Per CLAUDE.md §7, the following are explicitly banned:
- Nested conditionals
- Giant functions
- Magic strings (use named constants)
- Magic numbers (use named constants)
- Duplicate logic
- Excessive comments — prefer expressive code

---

## Import Organization

**Observed pattern** (from `packages/database/src/prisma.service.ts` and `prisma.module.ts`):

```typescript
// 1. External framework packages first
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';

// 2. Internal generated/relative imports second
import { PrismaClient } from '../generated/client';
import { PrismaService } from './prisma.service';
```

**Inconsistency — seed file uses CommonJS:**

`packages/database/prisma/seed.ts` uses `require()` rather than `import`:
```typescript
// seed.ts (actual, line 1)
const { PrismaClient } = require('../generated/client');
```
This is because the seed is executed with `node --experimental-strip-types` (see `packages/database/package.json`), which strips type annotations but does not transform ESM to CJS. For consistency with the rest of the TypeScript codebase, future service-layer code must use ES module `import` syntax. The seed file's `require()` should be treated as an isolated exception until the seed is refactored to use `import`.

**Path Aliases:** None configured (no `tsconfig.json` paths defined). All imports are currently relative paths.

---

## Module Design

**Exports:**
- Barrel file `packages/database/src/index.ts` re-exports everything: `PrismaModule`, `PrismaService`, and all generated Prisma client types.
- This means consumers do `import { PrismaService } from '@repo/database'` (once workspace aliasing is configured).

**NestJS Module Pattern:**
```typescript
// packages/database/src/prisma.module.ts
@Global()   // makes PrismaService injectable without importing PrismaModule everywhere
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```
The `@Global()` decorator is intentional for a shared database service. All future NestJS modules should follow this same `@Module({ providers, exports })` structure.

---

## Architecture Rules

**Declared (CLAUDE.md §6):**
- Controllers orchestrate only — no business logic in controllers
- Services contain business logic
- Repositories perform database access
- Shared utilities belong in shared modules
- Never duplicate logic

**Current state:** No controllers, services, or repositories exist yet. Only the database package (`packages/database`) is implemented. Clean architecture layers have not yet been instantiated. All future service-layer code must follow this strict separation.

**Prisma as single source of truth (CLAUDE.md §10):**
- Never write raw SQL unless absolutely necessary
- Never duplicate data; never denormalize without justification
- Every schema change requires: migration + updated seed (if required) + updated generated types

---

## Error Handling

**Declared (CLAUDE.md §13):** Errors must be actionable, informative, and typed. Avoid generic exceptions. Every error must explain what failed, why, and how to fix it.

**Observed in `packages/database/prisma/seed.ts`:**
```typescript
// Descriptive error with specific context
throw new Error(`Missing permission for role seed: ${permissionCode}`);
throw new Error(`Missing capability for prompt seed: ${promptSeed.capabilityKey}`);
throw new Error(`Missing capability for model seed: ${capabilityKey}`);
```
This pattern — template literal message with specific entity context — is the established error style for this codebase. Follow it for all future thrown errors.

**Top-level catch pattern (seed.ts):**
```typescript
main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```
For service-layer code, use typed NestJS exceptions (e.g., `NotFoundException`, `ConflictException`) rather than raw `Error` throws.

---

## Logging

**Declared (CLAUDE.md §14):** Log meaningful events, not noise. Never log API keys, secrets, passwords, tokens, or sensitive customer data.

**Observed:** Only `console.error` is used in `packages/database/prisma/seed.ts`. No structured logger is configured. When NestJS services are built, use NestJS's built-in `Logger` class:

```typescript
// Mandated pattern for future service code
import { Logger } from '@nestjs/common';

@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name);

  doSomething() {
    this.logger.log('Meaningful event description');
  }
}
```

---

## Comments

**Declared (CLAUDE.md §7):** Excessive comments are explicitly banned. Prefer expressive code over comments.

**Observed:** Comments in Prisma schema files are limited to section separators:
```prisma
// Relations
organization Organization @relation(...)
```
No JSDoc/TSDoc is used in current source files. TypeScript types serve as documentation. Follow this restraint — add comments only when code cannot express intent itself.

---

## Database Schema Conventions

These patterns are consistent across all Prisma schema files:

**Every model includes audit fields:**
```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
createdBy String?
updatedBy String?
deletedAt DateTime?   // soft-delete pattern
deletedBy String?
```

**Soft deletes:** `deletedAt`/`deletedBy` are present on all entities. Hard deletes are not the pattern.

**Primary keys:** Always `String @id @default(cuid())`.

**Referential actions:**
- Parent-child: `onDelete: Restrict, onUpdate: Cascade` (protect against orphaned records)
- Optional relations: `onDelete: SetNull, onUpdate: Cascade`
- Strict ownership (e.g., UserRole → User): `onDelete: Cascade, onUpdate: Cascade`

**Indexes:** Every foreign key column has a corresponding `@@index`. Enum status fields also have indexes. `createdAt` is always indexed.

**Unique constraints:** Business-level uniqueness uses `@@unique` with compound keys (e.g., `@@unique([organizationId, key])`).

---

## API Standards

**Declared (CLAUDE.md §9):** Every endpoint must have:
- Request validation
- Typed responses
- Consistent error format
- Authorization checks
- Appropriate logging

No API layer exists yet. When built, these requirements are non-negotiable.

---

## AI Feature Standards

**Declared (CLAUDE.md §12):** Every AI feature must be:
- Deterministic where possible
- Observable
- Retryable
- Logged
- Configurable

**Prompt templates** belong in dedicated files — never hardcode prompts inside services.

**Observed adherence:** The seed data in `packages/database/prisma/seed.ts` stores all prompts in the database (`Prompt` model with `systemPrompt` + `userTemplate` fields) and model configuration in `AiModel` records. This is the correct foundation — prompts are externalizable and configurable per-organization, not hardcoded in service logic.

---

## Security Rules

**Declared (CLAUDE.md §11):** Always assume hostile input. Validate all: request body, params, query, uploaded files. Never trust client data. Never expose secrets, stack traces, or internal IDs unintentionally. Apply least-privilege principles.

No security middleware or validation exists yet (no API layer). When built, all input validation is mandatory.

---

*Convention analysis: 2026-06-29*
