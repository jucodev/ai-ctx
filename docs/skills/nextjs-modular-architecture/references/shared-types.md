# Tipos compartidos: `Entity`, paginación y `url.helper`

Los tres tipos/helpers que consume **todo** módulo de dominio. Son los cimientos que permiten que un
componente de tabla o de paginación funcione con cualquier entidad.

> Para el `fetcher`, el `HttpError` y el `env.helper` que estas piezas asumen existentes, ver
> `references/shared-foundations.md`.

---


Dos archivos que consume **todo** módulo de dominio. Que sean compartidos es lo que permite que un
componente de tabla o de paginación funcione con cualquier entidad.

```typescript
// ✅ modules/shared/types/entity.type.ts
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Las props propias de una entidad, sin los campos que aporta `Entity`.
 * Es el tipo de los params de creación: el `id` y los timestamps los pone el backend.
 */
export type OnlyProps<T extends Entity> = Omit<T, keyof Entity>;
```

```typescript
// ✅ así se usa
type CreateProductParams = OnlyProps<Product>; // { name, price, description? }
```

```typescript
// ✅ modules/shared/types/pagination.type.ts
export interface PaginationParams {
  skip: number;
  limit: number;
}

export interface PaginationResult<T> {
  results: T[];
  total: number;
}
```

Y así se consumen desde un módulo:

```typescript
// ✅ modules/product/types.ts
import type { Entity } from '#/shared/types/entity.type';

export interface Product extends Entity {
  name: string;
  price: number;
  description?: string;
}
```

```typescript
// ✅ modules/product/api/product.api.ts
import { fetcher } from '#/shared/services/fetcher';
import { API_ROUTES } from '#/shared/constants/api-routes';
import { setPaginationInUrl } from '#/shared/helpers/url.helper';
import type { PaginationParams, PaginationResult } from '#/shared/types/pagination.type';

export async function getProducts(
  params: Partial<PaginationParams> & Partial<Pick<Product, 'name'>>,
): Promise<PaginationResult<Product>> {
  const qs = new URLSearchParams();
  setPaginationInUrl(qs, params);
  if (params.name) qs.set('name', params.name);

  const res = await fetcher(`${API_ROUTES.PRODUCTS}?${qs.toString()}`);
  return res.json() as Promise<PaginationResult<Product>>;
}
```

### `shared/helpers/url.helper.ts` — paginación en la query string

```typescript
// ✅ modules/shared/helpers/url.helper.ts
import type { PaginationParams } from '#/shared/types/pagination.type';

export function setPaginationInUrl(qs: URLSearchParams, params: Partial<PaginationParams>): void {
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
}
```

**La paginación se consume siempre como `Partial<PaginationParams>`.** Una lista sin `skip`/`limit`
es legítima: el backend aplica sus defaults. Por eso el helper **omite** las claves ausentes en vez
de mandar `?skip=undefined`, y ninguna función de `api/` fija `skip`/`limit` a mano.

**Por qué así:**

- **`createdAt`/`updatedAt` como `string`, no `Date`.** Lo que cruza el cable es JSON: `JSON.parse`
  devuelve strings ISO, nunca `Date`. Tiparlo como `Date` es mentir al compilador y garantizar un
  `.toISOString is not a function` en runtime. La conversión, si hace falta, es en el punto de
  formateo.
- **`skip`/`limit`, no `page`/`pageSize`.** Es lo que el backend recibe literalmente, así que
  `setPaginationInUrl` los vuelca sin traducción intermedia. La conversión página→offset se hace en
  el hook de UI que gestiona el paginador, no en la capa de red.
- **`results` + `total`, no `data` + `meta.total`.** Un shape plano se desestructura sin ceremonia y
  `total` (el total absoluto, no el de la página) es lo único que un paginador necesita para calcular
  el número de páginas.
- **`PaginationResult<T>` es genérico y vive en `shared/`** — nunca declares
  `{ products: Product[]; count: number }` en un módulo. Un shape distinto por entidad obliga a
  reescribir el componente de tabla en cada feature.

> ⚠️ Este es el error más caro de la capa de tipos: en cuanto dos módulos inventan su propia forma de
> paginar, cualquier componente compartido de listado deja de ser posible.

---

