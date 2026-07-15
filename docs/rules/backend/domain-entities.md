---
description: Rules for domain entities
paths:
  - {{backend}}/src/**/domain/entities/**/*.ts
---

# Domain Entity Rules

- **Always extend `Entity`** from `@jucodev/backend-core` — never define `id`, `createdAt`, `updatedAt` manually
- Constructor parameter type must be `EntityParams & Pick<ClassName, 'field1' | 'field2' | ...>` (import `EntityParams` from `@jucodev/backend-core`) — never a plain object
- Assign every property explicitly in the constructor body — no implicit spreading from params
- Enum-typed fields must use `keyof typeof EnumName`, not the enum type directly (`keyof typeof Status`, not `Status`)
- **Business logic belongs on entities** — validations, derived booleans, static path generators, and format checks are entity methods, not service logic
- Static factory methods for storage paths follow the pattern: `static generateXPath(id: Entity['id']): string`
- When creating new instances in routers, pass only the domain fields: `new Entity({ ...data })`. The `Entity` constructor autogenerates `id`, `createdAt`, `updatedAt` when omitted — never construct them manually (there is no `Entity.props()` / `generateProps()`)
- Never import from `application/`, `infra/`, or `presentation/` layers — entities are pure domain objects
- String inputs that need sanitization (e.g. names) are trimmed in the constructor: `this.name = params.name.trim()`
- Optional nullable fields are typed as `field?: Type | null` and assigned directly from params without defaulting
