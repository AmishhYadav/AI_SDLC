# Deferred Items — Phase 03

## Out-of-Scope Discoveries

### Pre-existing npm audit vulnerabilities (discovered during 03-01)

**Discovered:** 2026-07-01 during Task 2 (package install)
**Severity:** 7 high
**Root cause:** `@nestjs/core` and `multer` (via `@nestjs/platform-express`) have known vulnerabilities. These are pre-existing from Phase 2 — all four `@nestjs/*` packages in Phase 2 already depended on the vulnerable `@nestjs/core`. The new Plan 03-01 packages (`@nestjs/swagger`, `@nestjs/terminus`, `nestjs-cls`) surface the same vulnerabilities because they share the same dependency.
**Action required:** When `@nestjs/core` publishes a fix, upgrade all `@nestjs/*` packages together. Run `npm audit fix` at that time.
**Do NOT fix now:** Fixing requires `npm audit fix --force` which may introduce breaking changes. This is outside the scope of Plan 03-01.
