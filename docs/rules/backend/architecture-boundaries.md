---
description: Layered architecture import boundaries for the API
paths:
  - {{backend}}/src/**/*.ts
---

# Architecture Boundary Rules

The codebase follows a strict layered architecture. Violations cause tight coupling and break testability.

## Allowed import directions

```
presentation  →  application  →  domain
     ↓                ↓
   infra        infra (repos)
     ↓                ↓
  (external)   (external: Prisma, S3...)
```

## Forbidden imports

| From           | Must NOT import                                                         |
| -------------- | ----------------------------------------------------------------------- |
| `domain/`      | `application/`, `infra/`, `presentation/`                               |
| `application/` | `infra/`, `presentation/`, `hono`, `@prisma/client`                     |
| `infra/`       | `presentation/`                                                         |
| `domain/`      | any external library except pure utilities (`dayjs`, `file-type`, etc.) |

## Layer responsibilities

- **Domain (`domain/`)** — entities, repo interfaces, errors, enums. Zero framework knowledge. No async unless the logic demands it
- **Application (`application/`)** — services and use cases. Orchestrates domain objects using repo interfaces. No HTTP, no Prisma, no cloud SDKs
- **Infrastructure (`infra/`)** — Prisma repos, S3 storage, Nodemailer, Sharp, and any concrete tech implementation. Implements interfaces defined in domain/application. Framework-aware: it is the layer allowed to import `hono` besides `presentation/`. In this codebase the reusable implementations (`HonoHttpServerService`, `PinoLogger`, `PrismaDatabase`, `S3Storage`) live in the `@jucodev/backend-core` package (subpaths `/hono`, `/pino`, `/prisma`, `/s3`) rather than in the app's `infra/`, which now holds only the thin app-specific subclasses that configure them (`PrismaDb`, `S3Storage`) plus the fully app-specific infra (email, payments)
- **Presentation (`presentation/`)** — Hono routers, Zod DTOs, middlewares. HTTP-aware. Delegates all logic to application layer immediately

## Cross-module rules

- A module's service **may** inject another module's service (e.g. `OrderService` injecting `UserService`)
- A module's repo **must not** depend on another module's repo — cross-entity joins must be done at the service or infrastructure level
- A module's domain entity **must not** import another module's entity — use IDs (`userId: User['id']`) to reference across modules

## Adding new external dependencies

- Infrastructure-level dependencies (HTTP clients, cloud SDKs, ORMs) go in `infra/` only
- If multiple modules need the same external capability, add an abstract service to `shared/application/core/services/` and a concrete implementation in `shared/infra/`
- Never add a new external SDK import directly in a service or router
