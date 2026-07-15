---
description: Rules for the backend shared module
paths:
  - {{backend}}/src/shared/**/*.ts
---

# Shared Module Rules

- **`shared/` is for cross-cutting concerns only** — domain-specific logic never goes here
- **The reusable core lives in `@jucodev/backend-core`.** Generic building blocks (`Entity`, `UseCase`, `Router`, `ContextService` base, `LoggerService`, `HttpServerService`, helpers, pagination schemas/types) are imported from the package, not defined here. `shared/` only holds the **app-specific config** of that core (env schema, `AppError` prefixes, the `ContextService` subclass) and the **app's own infra** (Prisma, email, storage, payments)
- The shared module provides abstractions; domain modules consume them. The dependency is always one-way: modules → shared/package, never the reverse
- **Infrastructure services follow the abstract-class pattern** (abstract class as DI token, concrete impl bound in `SharedModule`). Generic ones come from the package: `LoggerService` → `PinoLogger` (`@jucodev/backend-core/pino`), `HttpServerService` → `HonoHttpServerService` (`@jucodev/backend-core/hono`), `StorageService` → `S3Storage` (`@jucodev/backend-core/s3`), `DatabaseService` → `PrismaDatabase` (`@jucodev/backend-core/prisma`). App-specific ones (`EmailService`, `StripeService`) are abstract classes in `application/core/services/` with impls in `infra/`
- **`PrismaDatabase` and `S3Storage` from the package are abstract bases, not ready-made services.** The app subclasses them in `shared/infra/` to supply the project-specific bits — the generated `PrismaClient` + driver adapter and the `DATABASE_URL` getter for the former; the bucket config and the `StorageError` factories for the latter. Decorate **the subclass** with `@injectable()` (the bound leaf), never the package base — same rule as `ContextService`. Error taxonomies (`StorageError` and its `PREFIX_ERRORS` code) stay app-local: the package never imports `AppError`
- Never access `process.env` directly — always use `EnvVarsHelper.getEnvVars()`. `EnvVarsHelper` is built once in `shared/domain/helpers/env.helper.ts` with `createEnvVarsHelper({...schema...})` from the package
- Env validation is **lazy and fail-fast**: the first `EnvVarsHelper.getEnvVars()` during bootstrap validates `process.env` against the Zod schema and throws if any required variable is missing. `validateEnvVars()` forces it eagerly if needed
- **`PrismaDb`** is the single database connection. It is a singleton injected into every Prisma repository. Never instantiate `PrismaClient` directly
- **`ContextService`** uses `AsyncLocalStorage` to propagate trace IDs and request context. The generic base is in the package; the app **subclasses** it (`shared/application/core/services/context.service.ts`) to declare each store's shape and add accessors (e.g. the authenticated user). The HTTP store is initialized by the context middleware **inside `HonoHttpServerService`**, not in `app.ts`
- **`LoggerService`** automatically enriches log entries e.g `traceId`, `request`, or `profile.id` from the context store. Inject it and use `this.logger.info/warn/error/debug` — never use `console.log`
- Reusable Zod schemas (`paginationParams`, `booleanStrSchema`) and shared types (`Entity`, `PaginationParams`, `PaginationResult`) come from `@jucodev/backend-core` — import them, never redefine per module. `AppError` is app-local (`shared/domain/types/app-error.type.ts`, built with `createAppError({...})`) — every domain error extends **that** one
- Helper classes (`TextHelper`, `ListHelper`, `MathHelper`) are stateless utilities from `@jucodev/backend-core` — inject them via their `.name` token (bound in `SharedModule`)
