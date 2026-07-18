---
description: Rules for TypeScript entity types, enums, and interfaces in module types.ts files
paths:
  - {{frontend}}/modules/**/types.ts
---

## TypeScript Types Rules

### When to extend Entity

**Backend entities** (stored in DB, have CRUD endpoints) must extend `Entity`:

```typescript
import { Entity } from '#/shared/types/entity.type';

export interface Product extends Entity {
  // Required fields first
  name: string;
  type: keyof typeof ProductType;
  storeId: string;
  // Optional fields after
  description?: string;
}
```

**Frontend-only types** (mapped/transformed API responses, view models) are plain interfaces — do NOT extend `Entity`. These MAY use `Date`, since they are built client-side after parsing:

```typescript
export interface ReportRow {
  id: string;
  date: Date;
  title: string;
  status: string;
}
```

### Entity Rules

- `Entity` from `#/shared/types/entity.type` provides: `id: string`, `createdAt: string`, `updatedAt: string`
- Timestamps are ISO **strings**, never `Date` — what crosses the wire is JSON, and `JSON.parse` never produces a `Date`. Typing them as `Date` lies to the compiler and guarantees a runtime `.toISOString is not a function`. Convert at the formatting point, not in the type
- Never duplicate `id`, `createdAt`, `updatedAt` on interfaces that extend `Entity`
- Use `keyof typeof EnumName` for enum-typed fields (not the enum type itself)
- Optional fields use `?` suffix
- Required fields before optional fields

### Enum Pattern

```typescript
export enum ProductType {
  DIGITAL = 'DIGITAL',
  PHYSICAL = 'PHYSICAL',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
```

### Enum Rules

- SCREAMING_SNAKE_CASE for enum keys and values
- String enums only (value = key in uppercase) — no numeric enums
- Enums defined in the same module as the entity that uses them
- Filter-only enums suffixed with `Filter`: `ProductStatusFilter`

### Shared Type Usage

```typescript
// For partial updates
Partial<Product>;

// For create params (strips Entity fields)
// Defined in #/shared/types/entity.type as:
//   export type OnlyProps<T extends Entity> = Omit<T, keyof Entity>;
import { OnlyProps } from '#/shared/types/entity.type';
OnlyProps<Product>;

// For subset of props
Pick<Product, 'id' | 'name' | 'type'>;

// For excluding fields
Omit<Product, 'storeId' | 'description'>;

// For paginated list responses
import { PaginationResult } from '#/shared/types/pagination.type';
PaginationResult<Product>;
```

### Restrictions

- Never define `id`, `createdAt`, `updatedAt` on interfaces that extend `Entity`
- Never use `any` — use `unknown` if the type is truly unknown
- Never use type aliases for entities — always `interface`
- Component prop types go in `[Component].type.ts` files, not in `types.ts`
