---
description: Rules for Zustand state stores
paths:
  - {{frontend}}/modules/**/stores/*.store.ts
---

## Zustand Store Rules

### File Pattern

```typescript
'use client';

import { create } from 'zustand';
import type { EntityType } from '#/[module]/types';

interface [Name]Store {
  // State fields
  entity: EntityType | null;
  isOpen: boolean;

  // Actions
  setEntity: (entity: EntityType | null) => void;
  setIsOpen: (open: boolean) => void;
}

export const use[Name]Store = create<[Name]Store>((set) => ({
  // Initial state
  entity: null,
  isOpen: false,

  // Actions
  setEntity: (entity) => set({ entity }),
  setIsOpen: (isOpen) => set({ isOpen }),
}));
```

### Naming Rules

- Hook name: `use[DomainName]Store` — e.g., `useProductStore`
- File name: `[domain].store.ts` — e.g., `product.store.ts`
- Interface name: `[DomainName]Store`

### State Rules

- Nullable state initialized as `null`, not `undefined`
- Boolean state initialized as `false`
- Array state initialized as `[]`

### Action Rules

- Simple setters: `set[FieldName]` — e.g., `setEntity`, `setIsOpen`
- Complex actions: `[verb][EntityName]` — e.g., `addToCart`, `removeFromFavorites`
- Use `set({ field: value })` for partial updates — Zustand merges automatically, no need to spread full state

### Custom Hook Wrapper Pattern

When the store needs computed values or handlers, wrap it in a hook in `modules/[module]/hooks/`:

```typescript
// modules/[module]/hooks/use[Domain].hook.ts
import { use[Domain]Store } from '#/[module]/stores/[domain].store';

export function use[Domain]() {
  const { entity, setEntity } = use[Domain]Store();
  // Add computed values, derived state, handlers, etc.
  return { entity, setEntity };
}
```

### Restrictions

- Only for UI/domain state — never for server cache (that's TanStack Query)
- Never fetch data inside stores — stores are state containers only
- Always `"use client"` directive
- One logical domain per store file
- Export the hook (`use[Name]Store`), not the raw store
- Use Zustand only as a last resort — prefer `useState`, `searchParams`, or TanStack Query state first
