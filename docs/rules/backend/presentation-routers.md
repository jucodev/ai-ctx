---
description: Rules for Hono presentation routers
paths:
  - {{backend}}/src/**/presentation/routers/**/*.ts
---

# Router Rules

- **Extend `Router`** from `@jucodev/backend-core/hono` — never create bare Hono apps in modules
- Decorate with `@injectable()` and inject services/middlewares via `@inject(ClassName.name)` in the constructor
- Constructor calls `super({ basePath: '/resource/v1' })` — basePath always includes the version. The `/api` prefix is set globally via `httpServer.createApp({ basePath: '/api' })` in `app.ts` — never include it in individual router paths
- All route definitions go inside `run(app: Hono<{ Variables: ApiVariables }>): void`
- **Thin handlers** — routers handle HTTP transport only: parse input, call a service, return JSON
- Input validation always uses `zValidator('query' | 'json' | 'form', SchemaName)` as inline middleware — never validate manually
- Access validated data via `c.req.valid('...')` — never `c.req.query()`, `c.req.json()`, or `c.req.form()` directly
- **Never throw `HTTPException`** — all errors must be `AppError` subclasses (domain errors from the module's `errors/` file). This includes authorization checks (403, 401): define an `AppError` subclass for them instead of using `HTTPException`
- Domain errors (`AppError` subclasses) thrown by services propagate automatically to `onError` — do not catch them in handlers
- New entity instances are constructed **in the router** using `new Entity({ ...data })` (the constructor autogenerates `id`/`createdAt`/`updatedAt`) then passed to the service
- All list endpoints return `c.json({ results, total })`
- All create endpoints return `c.json({ entity }, 201)`
- Never import `PrismaClient` or any `infra/` code into a router
- Versioning: breaking changes go in a new `v2/` file — never modify an existing versioned router
