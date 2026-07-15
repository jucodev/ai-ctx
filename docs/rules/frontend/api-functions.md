---
description: Rules for API client functions in the Next.js apps
paths:
  - {{frontend}}/modules/**/api/*.api.ts
---

## API Function Rules

### Import Requirements

- Always import `fetcher` from `#/shared/services/fetcher`
- Always import `API_ROUTES` from `#/shared/constants/api-routes`
- Import types from the module's `types.ts` (e.g., `#/product/types`)
- Import `PaginationParams` and `PaginationResult` from `#/shared/types/pagination.type`
- Import `setPaginationInUrl` from `#/shared/helpers/url.helper` when the endpoint accepts pagination params

### Function Naming

- GET many: `get[Entities]` (plural) — e.g., `getProducts`
- GET one: `get[Entity]Details` — e.g., `getProductDetails`
- POST: `create[Entity]` — e.g., `createProduct`
- PATCH/PUT: `update[Entity]` — e.g., `updateProduct`
- DELETE: `delete[Entity]` — e.g., `deleteProduct`

### Filter Params Typing

When a list function accepts filter params that correspond to fields on the entity being fetched, compose with `Partial<Pick<Entity, ...>>` instead of duplicating the types:

```typescript
// Correct — reuses entity field types
export type ListProductsParams = PaginationParams & Partial<Pick<Product, 'type' | 'storeId'>>;

// Wrong — duplicates types already defined in Product
export type ListProductsParams = PaginationParams & {
  type?: string;
  storeId?: string;
};
```

Apply this whenever the filter field name AND type match an existing entity field exactly.

### URL Construction

- `API_ROUTES` stores **prefixes only** (e.g., `/api/products`) — never full endpoint paths. Always concatenate the specific segment in the function: `` `${API_ROUTES.PRODUCTS}/segment` ``
- Simple paths: use template literals — `` `${API_ROUTES.ENTITY}/segment` ``
- GET with query params: use `URLSearchParams` and append to the path string

```typescript
const qs = new URLSearchParams();
setPaginationInUrl(qs, params); // pagination (limit, skip)
qs.set('filter', value); // any extra param
const res = await fetcher(`${API_ROUTES.ENTITY}?${qs.toString()}`);
```

- Use `setPaginationInUrl(qs, params)` from `#/shared/helpers/url.helper` for pagination — never set `limit`/`skip` manually

### Request Patterns

```typescript
// GET many (with pagination)
export async function getProducts(
  params: GetProductsParams & Partial<PaginationParams>,
): Promise<PaginationResult<Product>> {
  const qs = new URLSearchParams();
  setPaginationInUrl(qs, params);
  const res = await fetcher(`${API_ROUTES.PRODUCTS}?${qs.toString()}`);
  return res.json() as Promise<PaginationResult<Product>>;
}

// GET one
export async function getProductDetails(productId: string): Promise<{ product: Product }> {
  const res = await fetcher(`${API_ROUTES.PRODUCTS}/${productId}`);
  return res.json() as Promise<{ product: Product }>;
}

// POST with JSON body
export async function createProduct(params: CreateProductParams): Promise<{ product: Product }> {
  const res = await fetcher(API_ROUTES.PRODUCTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json() as Promise<{ product: Product }>;
}

// POST with FormData (file uploads)
export async function createProductWithFile(
  params: CreateProductParams,
): Promise<{ product: Product }> {
  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value) formData.append(key, value);
    if (typeof value === 'boolean') formData.append(key, `${value}`);
    if (value instanceof File) formData.append(key, value);
    if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
  });
  // No Content-Type header — browser sets it automatically with the boundary
  const res = await fetcher(API_ROUTES.PRODUCTS, { method: 'POST', body: formData });
  return res.json() as Promise<{ product: Product }>;
}

// PATCH
export async function updateProduct(params: {
  productId: string;
  data: UpdateProductParams;
}): Promise<{ product: Product }> {
  const res = await fetcher(`${API_ROUTES.PRODUCTS}/${params.productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.data),
  });
  return res.json() as Promise<{ product: Product }>;
}

// DELETE
export async function deleteProduct(productId: string): Promise<{ productDeleted: string }> {
  const res = await fetcher(`${API_ROUTES.PRODUCTS}/${productId}`, { method: 'DELETE' });
  return res.json() as Promise<{ productDeleted: string }>;
}
```

### Return Types

- Always annotate the return type explicitly: `Promise<{ entity: Type }>`
- Or cast the json response: `return res.json() as Promise<{ entity: Type }>`
- Responses wrap the entity in an object: `{ product: Product }`, not just `Product`
- List responses use `PaginationResult<Product>`
- Never use `any` as return type

### Error Handling

- Do NOT add try/catch — `fetcher` handles errors and re-throws as `HttpError`
- Do NOT handle 4xx/5xx manually — errors bubble up to TanStack Query's error handling
- `QueryClientProvider` automatically shows a toast for every failed query/mutation

### Restrictions

- Never call `fetch()` directly — always use `fetcher`
- Never import from another module's `api/` files
- Never set `credentials` or auth headers manually — `fetcher` sends `credentials: 'include'` automatically
- Never use `axios` or any other HTTP client
