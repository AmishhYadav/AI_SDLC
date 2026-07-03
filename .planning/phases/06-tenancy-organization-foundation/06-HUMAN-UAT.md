---
status: partial
phase: 06-tenancy-organization-foundation
source: [06-VERIFICATION.md]
started: 2026-07-03T00:00:00Z
updated: 2026-07-03T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Two-Organization Isolation Test — CI / Real-DB Execution
expected: |
  Set `DATABASE_URL` to a real Postgres instance and run
  `npm test --workspace=packages/backend -- --run`. The
  `describe.skipIf(!realDbAvailable)('Tenant Isolation (real DB) (TENANT-06)', ...)`
  block (app.integration.spec.ts:621) executes and all 6 cases pass:
  (a) orgA ACTIVE member + correct x-organization-id → 200, success:true
  (b) orgA member + x-organization-id=orgB → 403 TENANT.ORG_ACCESS_DENIED
  (c) GET orgA members: result array does NOT contain orgB user's userId
  (d) missing x-organization-id on tenant-scoped route → 403 TENANT.MISSING_ORG_HEADER
  (e) INVITED-status membership → 403 TENANT.ORG_ACCESS_DENIED
  (f) POST /api/v1/organizations → 201; creator is ACTIVE member with joinedAt; GET /mine returns it
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
