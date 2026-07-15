---
description: Rules for dependency injection modules and the container
paths:
  - {{backend}}/src/**/*.module.ts
  - {{backend}}/src/container.ts
---

# Dependency Injection Rules

- **Every injectable class** (`@injectable()`) must be registered in its module's `.module.ts` — never skip registration even if the class is only used once
- Binding pattern is always: `bind<Interface>(Interface.name).to(Implementation).inSingletonScope()`
  - The type parameter is the abstract class (interface)
  - The token is `Interface.name` (string)
  - The implementation is the concrete class
  - Always use `.inSingletonScope()` — all services, repos, and routers are stateless
- Each domain module exports exactly **one `ContainerModule`** — it binds repos, services, and routers for that module only
- Module binding order: repos first, then services, then routers
- Load all `ContainerModule`s in `src/container.ts` — the order only matters if modules depend on each other at load time (rare)
- Retrieve instances in `main.ts` via `container.get<Type>(Type.name)` — never call `container.get()` inside services or repositories
- **Never use `container.get()` inside application code** — it bypasses DI and creates hidden coupling
- When an abstract class is used as a token (e.g. `StorageService`, `LoggerService`), the binding maps it to its concrete implementation in `SharedModule`
- Cross-module dependencies are resolved automatically — just inject the service; no need to import its module
- `reflect-metadata` must be the **first import** in `main.ts` — InversifyJS requires it
