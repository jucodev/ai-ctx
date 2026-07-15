---
description: Checklist for adding a new backend module
paths:
  - {{backend}}/src/**/*.module.ts
  - {{backend}}/src/container.ts
  - {{backend}}/src/app.ts
---

# New Module Checklist

When creating a new domain module, complete every step. Skipping any step silently breaks the DI container or leaves the route unreachable.

## 1. Domain layer

- [ ] Create `src/<module>/domain/entities/<name>.entity.ts` extending `Entity`
- [ ] Create `src/<module>/domain/repositories/<name>.repository.ts` as an abstract class
- [ ] Create `src/<module>/domain/errors/<name>.error.ts` with a namespace
- [ ] Add the module's prefix to `PREFIX_ERRORS` in `src/shared/domain/types/app-error.type.ts`
- [ ] Create `src/<module>/domain/enums/<name>.enum.ts` for any domain enums

## 2. Database

- [ ] Add the model to `prisma/schema.prisma`
- [ ] Run `npm run db:migrate -- --name add_<model_name>`

## 3. Infrastructure

- [ ] Create `src/<module>/infra/prisma-<name>.repository.ts` implementing the repo interface

## 4. Application

- [ ] Create `src/<module>/application/<name>.service.ts`
- [ ] Create use cases in `src/<module>/application/use-cases/` or `src/<module>/use-cases/` if needed

## 5. Presentation

- [ ] Create `src/<module>/presentation/dtos/<name>.dto.ts` with Zod schemas
- [ ] Create `src/<module>/presentation/routers/v1/<name>.router.ts`

## 6. Wiring

- [ ] Create `src/<module>/<module>.module.ts` with all bindings
- [ ] Load the module in `src/container.ts` via `container.load()`
- [ ] Add the router to the `routers` array passed to `httpServer.createApp(...)` in `src/app.ts` (`container.get<Router>(XRouterV1.name)`). Never call `attachRouter` by hand — `HonoHttpServerService` does it
