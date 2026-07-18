# Capa de datos: fetching, query keys, hooks y errores

El data fetching **siempre** atraviesa tres capas, en este orden. Nunca se salta ninguna.

```
api/ (función de red)  →  queries/keys/ (factory)  →  queries/hooks/ (useQuery/useMutation)
                                                              ↑
                                            los componentes solo consumen hooks
```

**Por qué el orden fijo:** cada capa tiene una única responsabilidad (red / identidad de caché /
integración con React). Saltarse una acopla la UI a los detalles de red y hace la caché
impredecible.

---

## 1. Capa `api/` — funciones de red

- Usan un **`fetcher` central**, nunca `fetch` crudo ni `axios`.
- No llevan `try/catch`: el `fetcher` normaliza los errores (ver §4).
- Nombres por verbo: `get[Entities]` (lista), `get[Entity]Details` (uno), `create[Entity]`,
  `update[Entity]`, `delete[Entity]`.
- Los prefijos de endpoint salen de una constante (`API_ROUTES`), nunca hardcodeados.
- Un módulo **nunca** importa de la carpeta `api/` de otro módulo (usa su hook de query).

```typescript
// ✅ modules/product/api/product.api.ts
import { fetcher } from '#/shared/services/fetcher';
import { API_ROUTES } from '#/shared/constants/api-routes';
import { setPaginationInUrl } from '#/shared/helpers/url.helper';
import type { Product } from '#/product/types';
import type { PaginationParams, PaginationResult } from '#/shared/types/pagination.type';
import type { OnlyProps } from '#/shared/types/entity.type';

export async function getProducts(
  params: Partial<PaginationParams> & Partial<Pick<Product, 'type'>>,
): Promise<PaginationResult<Product>> {
  const qs = new URLSearchParams();
  setPaginationInUrl(qs, params);
  if (params.type) qs.set('type', params.type);

  const res = await fetcher(`${API_ROUTES.PRODUCTS}?${qs.toString()}`);
  return res.json() as Promise<PaginationResult<Product>>;
}

export async function getProductDetails(id: string): Promise<{ product: Product }> {
  const res = await fetcher(`${API_ROUTES.PRODUCTS}/${id}`);
  return res.json() as Promise<{ product: Product }>;
}

export async function createProduct(params: OnlyProps<Product>): Promise<{ product: Product }> {
  const res = await fetcher(API_ROUTES.PRODUCTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json() as Promise<{ product: Product }>;
}
```

**Detalles del patrón:**
- El `fetcher` devuelve la **`Response`**: cada función decide cómo deserializar (`res.json()`) y
  anota su tipo de retorno explícitamente. Nunca lleva `try/catch` ni comprueba `response.ok`.
- Serializar el body es responsabilidad de la función: `JSON.stringify` + `Content-Type:
  application/json`, o un `FormData` **sin** header (el navegador pone el `boundary` multipart).
- Las respuestas envuelven la entidad: `{ product: Product }`, no `Product` suelto — deja espacio a
  metadatos futuros sin romper el contrato.
- Las listas devuelven `PaginationResult<T>` (`{ results: T[]; total: number }`) desde un tipo
  compartido; nunca definas tu propio shape de paginación.
- La paginación se tipa como `Partial<PaginationParams>` y se vuelca con `setPaginationInUrl` —
  nunca fijes `skip`/`limit` a mano.
- Params de filtro que coinciden con campos de la entidad se componen con
  `Partial<Pick<Entity, ...>>` en vez de re-declarar los tipos; los de creación, con
  `OnlyProps<Entity>`.

---

## 2. Capa `queries/keys/` — query key factories

Las query keys **nunca** se escriben inline. Se centralizan en una factory jerárquica por entidad.

```typescript
// ✅ modules/product/queries/keys/product.keys.ts
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: Parameters<typeof getProducts>[0]) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};
```

**Por qué importa:** una jerarquía `all → lists → list` / `all → details → detail` permite invalidar
con precisión quirúrgica (`invalidateQueries({ queryKey: productKeys.lists() })` limpia todas las
listas sin tocar los detalles) y elimina el riesgo de keys duplicadas o desalineadas.

---

## 3. Capa `queries/hooks/` — un hook por archivo

**Nombres de archivo y de hook:** `use[Entity]Query.ts` (lista), `use[Entity]DetailsQuery.ts` (uno)
y `use[Create|Update|Delete][Entity]Mutation.ts`. Sin sufijo `.hook.ts`: ese es para los custom hooks
de `hooks/`, y la distinción hace evidente de un vistazo qué archivo toca la caché de servidor.

```typescript
// ✅ modules/product/queries/hooks/useProductsQuery.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '#/product/api/product.api';
import { productKeys } from '#/product/queries/keys/product.keys';

export function useProductsQuery(params: Parameters<typeof getProducts>[0]) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => getProducts(params),
  });
}
```

```typescript
// ✅ modules/product/queries/hooks/useCreateProductMutation.ts
// Mutación: invalida las keys afectadas en onSuccess
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  });
}
```

**Reglas clave:**
- `enabled` se **deriva de los params** (`enabled: !!params.id`), nunca es un parámetro extra del
  hook. Nunca pases `undefined` a un param requerido: gatea con `enabled`.
- `staleTime`: omítelo para datos normales (aplica el default global, `60_000`); `Infinity` para
  datos estáticos (países, enums, config); `0` solo si debe refetchear en cada mount.
- Invalidación: CREATE invalida `lists()`; UPDATE invalida `detail(id)` **y** `lists()`; DELETE
  invalida `lists()`.

```typescript
// ❌ Evitar — query key inline, fetch directo en el componente, useQueryClient en la UI
function ProductList() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['products'], queryFn: () => fetch('/api/products') });
}
```

---

## 4. Manejo de errores centralizado

El `fetcher` es el único punto donde se habla HTTP. **Siempre** lanza un error tipado (`HttpError`)
tanto en respuestas 4xx/5xx (con `errorCode`, `httpStatus` del body) como en fallos de red.

> **Código completo del `fetcher`, el `serverFetcher` y la clase `HttpError`, con el porqué de cada
> decisión: `references/shared-foundations.md`** (y el del provider que muestra el toast, en
> `references/error-toast-provider.md`). Lo de aquí abajo es solo el esqueleto.

```typescript
// ✅ shared/services/fetcher.ts (esencia del patrón)
export async function fetcher(path: string, options: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, credentials: 'include' });
  } catch (cause) {
    throw new HttpError('Network error', { cause });        // error de red
  }
  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new HttpError(body.message, { errorCode: body.code, httpStatus: response.status });
  }
  return response;                                          // el body lo lee quien llama
}
```

El **provider de TanStack Query** captura todos los errores de queries/mutations en un único sitio y
muestra un toast automáticamente, mapeando `errorCode → mensaje` desde un diccionario:

```typescript
// ✅ shared/providers/QueryClientProvider — manejo global, cero try/catch en la UI
new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof HttpError && error.httpStatus === 401) return; // lo maneja el guard
      toast.error(resolveMessage(error));
    },
  }),
});
```

**Por qué importa:** ningún componente ni función `api/` necesita `try/catch`. El error fluye
`fetcher → HttpError → provider → toast`, y traducir un error nuevo es añadir una entrada al
diccionario de mensajes, no tocar código. Un formulario que muestra su propio error inline puede
optar por saltarse el toast global vía `mutation.meta`.

---

## 5. Fetching server-side

Para Server Components / layouts que leen cookies, usa un `serverFetcher` **separado** (no una
bandera dentro del `fetcher`) que reenvía la cookie de sesión, usa `cache: 'no-store'` y devuelve
`null` en 401 en vez de lanzar — su retorno es `Response | null`. Las funciones que lo consumen viven en la capa `api/` del módulo con
sufijo `.api-server.ts`, y tanto ellas como el helper marcan `import 'server-only'` para que nunca
acaben en el bundle del cliente.

> Código completo y el porqué de cada diferencia con el fetcher de cliente:
> `references/shared-foundations.md` §4 (`server-fetcher`).
