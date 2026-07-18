# Tipos de entidad y estado global (Zustand)

## 1. Tipos y entidades

Los tipos del dominio viven en `types.ts` de cada módulo.

Las **entidades de backend** (con id y timestamps) extienden un `Entity` base compartido:

```typescript
// ✅ modules/product/types.ts
import { Entity } from '#/shared/types/entity.type'; // { id, createdAt: string, updatedAt: string }

export interface Product extends Entity {
  name: string;                     // requeridos primero
  type: keyof typeof ProductType;   // enums vía keyof typeof
  storeId: string;
  description?: string;             // opcionales después
}

export enum ProductType {
  DIGITAL = 'DIGITAL',
  PHYSICAL = 'PHYSICAL',
}
```

**Reglas:**
- Nunca redeclares `id`/`createdAt`/`updatedAt` en interfaces que extienden `Entity`.
- `createdAt`/`updatedAt` son **`string`** (ISO), no `Date`: lo que cruza el cable es JSON. Convierte
  a `Date` en el punto de formateo, no en el tipo.
- Params de creación con `OnlyProps<Entity>` (`Omit<T, keyof Entity>`): el `id` y los timestamps los
  pone el backend.
- Enums **string** en `SCREAMING_SNAKE_CASE` (valor = clave); nada de enums numéricos.
- Los **tipos solo-frontend** (view models, respuestas transformadas) son interfaces planas, no
  extienden `Entity`.
- `interface` para entidades (no `type`). `unknown` en vez de `any`.
- Los **tipos de props de componentes** van en `[Componente].type.ts`, no en `types.ts`.

**Por qué importa:** un `Entity` base evita repetir campos de auditoría en cada interfaz, y usar
`keyof typeof Enum` mantiene los campos atados al enum real en lugar de a strings sueltos.

> El código de `shared/types/entity.type.ts` y `shared/types/pagination.type.ts`
> (`PaginationParams` / `PaginationResult<T>`), con el porqué de cada campo, está en
> `references/shared-types.md`. Las listas **siempre** devuelven `PaginationResult<T>`;
> nunca declares un shape de paginación propio por módulo.

---

## 2. Estado global con Zustand (último recurso)

Solo para estado de UI/dominio verdaderamente global. **Nunca** para caché de servidor (eso es
TanStack Query). Antes de crear un store, agota `useState`, `searchParams` y TanStack Query — ver la
regla de oro del estado en `SKILL.md`.

```typescript
// ✅ modules/product/stores/product.store.ts
'use client';
import { create } from 'zustand';
import type { Product } from '#/product/types';

interface ProductStore {
  selected: Product | null;              // nullable → null (no undefined)
  isPanelOpen: boolean;                  // boolean → false
  setSelected: (p: Product | null) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useProductStore = create<ProductStore>((set) => ({
  selected: null,
  isPanelOpen: false,
  setSelected: (selected) => set({ selected }),
  setPanelOpen: (isPanelOpen) => set({ isPanelOpen }),
}));
```

**Reglas:** un dominio por archivo; exporta el hook (`use[Nombre]Store`), no el store crudo; los
stores no hacen fetch; si necesitas valores derivados, envuelve el store en un custom hook.
