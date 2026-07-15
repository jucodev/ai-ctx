---
description: Rules for Prisma repository implementations
paths:
  - {{backend}}/src/**/infra/prisma-*.repository.ts
---

# Prisma Repository Rules

- **Implement the domain repository interface** (`implements XRepo`) — never add extra public methods that aren't in the interface
- Decorate with `@injectable()` and inject only `PrismaDb` (and other infra deps if needed) via `@inject`
- Method signatures use `Parameters<Repo['method']>` / `ReturnType<Repo['method']>` — never redefine param types
- **Always map raw Prisma results back to domain entity instances**: `return new Entity(raw)` — never return plain Prisma objects
- For list methods, run `findMany` + `count` in a single `Promise.all` — never sequential
- Build `where` objects using conditional spreading:
  ```ts
  const where: Prisma.EntityWhereInput = {
    ...(field && { field }),
    ...(ids?.length && { id: { in: ids } }),
  };
  ```
- Use `Prisma.EntityWhereInput` for typed where clauses — avoids `any` and catches schema mismatches at compile time
- When using `include` for relations, destructure included fields before constructing domain entities:
  ```ts
  const { relatedField, ...rest } = raw;
  return { entity: new Entity(rest), related: relatedField.map((r) => new Related(r)) };
  ```
- **Never throw domain errors** — only services throw typed errors; repos throw only unexpected DB errors (which bubble as uncaught exceptions)
- Relation connect/set patterns:
  - Connect new relation: `{ connect: ids.map(id => ({ id })) }`
  - Replace relation set: `{ set: ids.map(id => ({ id })) }`
