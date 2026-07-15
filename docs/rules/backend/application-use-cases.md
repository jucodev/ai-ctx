---
description: Rules for application use cases
paths:
  - {{backend}}/src/**/application/use-cases/**/*.ts
---

# Use Case Rules

- **Extend `UseCase<Input, Output>`** from `@jucodev/backend-core`
- Always decorate with `@injectable()` and inject dependencies via `@inject(ClassName.name)`
- Define `Input` and `Output` as local types at the top of the file — keep them simple and co-located
- Implement **only** the `run(input: Input)` method — use `before()` and `after()` hooks only when there is a real lifecycle need (e.g. locking a resource before, emitting an event after)
- Always call use cases via `.execute(input)` from routers — never call `.run()` directly
- **When to use a use case vs a service method:**
  - Use case: operation spans multiple services, has conditional side effects (emails, cascading deletes, notifications), or requires the lifecycle hooks
  - Service method: single-concern CRUD, lookups, or simple orchestration within one domain
- Use cases may access any service from any module — they are the coordination layer
- Never access repositories directly inside a use case — go through services
- A use case should do **one thing** — if it branches into unrelated concerns, split it
- The `validate()` hook is for input precondition checks (not schema validation — that happens in the router)
