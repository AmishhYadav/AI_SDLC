# Deferred Items — Phase 04 Plan 01

## Pre-existing Lint Errors (out of scope for this plan)

Found during Task 2 lint verification. These errors exist in files not modified by this plan.

| File | Line | Issue |
|------|------|-------|
| `packages/backend/src/common/exceptions/global-exception.filter.ts` | 33 | `@typescript-eslint/no-unused-vars` — 'request' is assigned but never used |
| `packages/backend/src/common/interceptors/audit.interceptor.spec.ts` | 35 | Unused eslint-disable directive for `@typescript-eslint/no-explicit-any` |

**Action:** Address in Phase 03 continuation or a dedicated cleanup plan.
