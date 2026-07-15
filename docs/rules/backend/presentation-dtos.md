---
description: Rules for presentation-layer DTOs and Zod schemas
paths:
  - {{backend}}/src/**/presentation/dtos/**/*.ts
---

# DTO / Zod Schema Rules

- DTOs are **Zod schemas only** — no classes, no decorators, no types that duplicate the entity
- Naming convention: `EntityCreationDto`, `EntityUpdateDto`, `EntityListDto` — exported as named constants (see `{{backend}}/src/example/presentation/dtos/example.dto.ts`)
- `EntityUpdateDto` is always derived from `EntityCreationDto`:
  ```ts
  export const EntityUpdateDto = EntityCreationDto.partial();
  // or with extensions:
  export const EntityUpdateDto = EntityCreationDto.omit({ immutableField: true })
    .extend({ extra: z.string() })
    .partial();
  ```
  Never duplicate field definitions between `EntityCreationDto` and `EntityUpdateDto`
- Use shared schemas from `@jucodev/backend-core` for common patterns:
  - `booleanStrSchema` — for booleans coming from form data or query strings (`'true'` / `'false'`)
  - `paginationParams` — extend with `.shape` for list query schemas
- Query schemas extend pagination: `.extend(paginationParams.partial().shape)`
- Date fields from query/form use `z.coerce.date()`
- Enum fields use `z.enum(...)` when a TypeScript enum exists
- Multipart file fields handle single-or-array input:
  ```ts
  files: z.union([z.instanceof(File), z.array(z.instanceof(File)).min(1).max(N)]);
  ```
- UUIDs are validated with `z.uuid()` — never plain `z.string()` for ID fields
- Use `.transform()` to normalize values at the boundary (e.g. `null` literals, array coercion)
- DTOs must not import from `domain/`, `application/`, or `infra/` — only shared schemas from `@jucodev/backend-core` and the module's `domain/enums/`
