---
description: Rules for domain repository interfaces
paths:
  - {{backend}}/src/**/domain/repositories/**/*.ts
---

# Repository Interface Rules

- **Use abstract classes, not TypeScript `interface`** — InversifyJS needs a class as a DI token; interfaces are erased at runtime
- All methods are declared as **arrow-function properties** (`abstract methodName: (...) => Promise<...>`), not regular abstract methods — this makes `Parameters<Repo['method']>` and `ReturnType<Repo['method']>` work correctly in implementations
- `findOneBy*` methods return `EntityType | null`, never `undefined`
- List methods always return `Promise<PaginationResult<EntityType>>` — never a plain array
- Update methods take `id` as the first parameter and a `Partial<...>` data object as the second
- The update data `Partial<>` must omit immutable fields: `Omit<ConstructorParameters<typeof Entity>[0], 'createdAt' | 'id' | ...>`
- ID parameters are typed as `Entity['id']`, not `string`
- Never import from `application/`, `infra/`, or `presentation/` — repository interfaces are domain contracts
- Cross-entity relationships use the related entity's ID type (e.g. `storeId: Store['id']`) rather than raw `string`
- Complex queries that return joined data define the full return shape inline in the abstract method signature
