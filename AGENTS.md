# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

# 5. Project Philosophy

This project is a production-grade AI SDLC platform.

Treat every implementation as if it will be deployed to paying enterprise customers.

Prioritize:

1. Correctness
2. Maintainability
3. Readability
4. Security
5. Scalability
6. Performance

Never sacrifice long-term maintainability for short-term speed.

---

# 6. Architecture Rules

Always preserve clean architecture.

* Business logic must not exist in controllers.
* Controllers orchestrate only.
* Services contain business logic.
* Repositories perform database access.
* Shared utilities belong in shared modules.
* Never duplicate logic.

Every new feature should fit naturally into the existing architecture.

If an implementation requires violating architecture, stop and explain why.

---

# 7. Code Quality Standards

Every piece of code should be:

* Small
* Readable
* Self-documenting
* Consistent

Avoid:

* nested conditionals
* giant functions
* magic strings
* magic numbers
* duplicate logic
* excessive comments

Prefer expressive code over comments.

---

# 8. Naming

Names should explain intent.

Prefer

createProject()

over

create()

Prefer

OrganizationInvitationService

over

InvitationService

Avoid abbreviations unless universally understood.

---

# 9. API Standards

Every endpoint should have:

* request validation
* typed responses
* consistent error format
* authorization checks
* logging where appropriate

REST conventions should be followed consistently.

---

# 10. Database Rules

Prisma is the single source of truth.

Never:

* write raw SQL unless absolutely necessary
* duplicate data
* denormalize without justification

Every schema change must include:

* migration
* updated seed if required
* updated types

---

# 11. Security

Always assume hostile input.

Validate:

* request body
* params
* query
* uploaded files

Never trust client data.

Never expose:

* secrets
* stack traces
* internal IDs unintentionally

Apply least-privilege principles.

---

# 12. AI Feature Standards

Every AI feature must be:

* deterministic where possible
* observable
* retryable
* logged
* configurable

Prompt templates belong in dedicated files.

Never hardcode prompts inside services.

Model selection should be configurable.

---

# 13. Error Handling

Errors should be:

* actionable
* informative
* typed

Avoid generic exceptions.

Every error should explain:

* what failed
* why
* how to fix it

---

# 14. Logging

Log meaningful events.

Do not log noise.

Never log:

* API keys
* secrets
* passwords
* tokens
* sensitive customer data

---

# 15. Testing

Every feature should include appropriate tests.

Prefer:

* unit tests
* integration tests

When fixing a bug:

1. reproduce it
2. write the failing test
3. fix it
4. verify the test passes

---

# 16. Performance

Think about scalability before writing code.

Avoid:

* N+1 queries
* unnecessary renders
* unnecessary API calls
* repeated database lookups

Batch work whenever possible.

---

# 17. Git Discipline

Keep commits focused.

One logical change per commit.

Avoid commits containing unrelated modifications.

---

# 18. Definition of Done

A task is complete only if:

* implementation is correct
* types compile
* tests pass
* lint passes
* formatting passes
* documentation updated
* no TODOs remain
* no dead imports remain
* no obvious edge cases remain

---

# 19. Before Finishing Any Task

Before declaring completion, verify:

* Is this the simplest solution?
* Is it production-ready?
* Does it match the architecture?
* Is it secure?
* Is it tested?
* Would I approve this in a senior engineer code review?

If any answer is "No", continue improving.

---

# 20. Communication

Be proactive.

If you discover:

* architectural problems
* security issues
* technical debt
* better approaches

Explain them before implementing.

Challenge poor technical decisions with reasoning.

Do not blindly follow instructions that reduce code quality.

Act like a senior engineer collaborating on the project, not a code generator.
