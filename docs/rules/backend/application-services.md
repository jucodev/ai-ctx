---
description: Rules for application-layer services
paths:
  - {{backend}}/src/**/application/**/*.service.ts
---

# Application Service Rules

- **Always decorate with `@injectable()`** — services without it crash the DI container silently
- Inject all dependencies via **constructor `@inject(ClassName.name)`** — never use `container.get()` inside a service
- Use `ClassName.name` as the injection token, never a raw string literal
- Method signatures **mirror the repository interface** using `Parameters<Repo['method']>` and `ReturnType<Repo['method']>` — this ensures the service stays in sync when the repo contract changes
- Standard `getByIdOrThrow` pattern:
  ```ts
  async getByIdOrThrow(...params): Promise<NonNullable<Awaited<ReturnType<Repo['findOneById']>>>> {
    const entity = await this.repo.findOneById(...params);
    if (!entity) throw new EntityError.NotFoundById(`...`);
    return entity;
  }
  ```
- **Throw domain errors** (`EntityError.SomeProblem`) — never throw `HTTPException` or raw `Error` from services
- Use `Promise.all` for independent async operations — never sequential awaits when parallelism is possible. For large arrays, chunk them and process each chunk with `Promise.all` sequentially to avoid overwhelming the database or external services:
  ```ts
  const CHUNK_SIZE = 10;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    await Promise.all(items.slice(i, i + CHUNK_SIZE).map((item) => process(item)));
  }
  ```
- Services may depend on other modules' services — inject them, do not duplicate logic
- **No HTTP, Hono, or request/response knowledge** inside services — services are transport-agnostic
- Guard clauses go at the top of a method, happy path at the bottom
- `list()` methods delegate directly to the repo with no added logic unless cross-cutting concerns apply
