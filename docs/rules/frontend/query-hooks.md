---
description: Rules for TanStack Query hooks (useQuery, useMutation)
paths:
  - {{frontend}}/modules/**/queries/hooks/*.ts
---

## Query Hook Rules

### File Naming

- useQuery hooks: `use[Entity]Query.ts` (list) or `use[Entity]DetailsQuery.ts` (single)
- useMutation hooks: `use[Create|Update|Delete][Entity]Mutation.ts`
- One hook per file

### useQuery Pattern

```typescript
import { useQuery } from '@tanstack/react-query';
import { entityKeys } from '#/[module]/queries/keys/[entity].keys';
import { getEntities } from '#/[module]/api/[entity].api';

export function useEntitiesQuery(params: Parameters<typeof getEntities>[0]) {
  return useQuery({
    queryKey: entityKeys.list(params),
    queryFn: () => getEntities(params),
    enabled: !!params.requiredField, // only when the hook has required params
  });
}
```

### useMutation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntity } from '#/[module]/api/[entity].api';
import { entityKeys } from '#/[module]/queries/keys/[entity].keys';

export function useCreateEntityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}
```

### staleTime Rules

- Omit `staleTime` for normal data — the global default (`60_000`) applies automatically
- Use `staleTime: Infinity` for static/reference data (countries, enums, config)
- Use `staleTime: 0` only if data must always be refetched on every mount

### enabled Rules

- Derive `enabled` from the params passed to the hook — never add an extra `enabled` parameter
- Use `enabled: !!params.id` when a required param might be undefined/null
- Combine multiple conditions if needed: `enabled: !!params.id && !!params.token`
- Never pass `undefined` to a required API param — use `enabled` to gate the query instead

### Invalidation Rules

- Mutations that CREATE must invalidate `entityKeys.lists()`
- Mutations that UPDATE must invalidate `entityKeys.detail(id)` and `entityKeys.lists()`
- Mutations that DELETE must invalidate `entityKeys.lists()`
- Cross-module invalidations are allowed when needed (e.g., creating an entity invalidates a related module's list)
- Mutations that don't affect shared cache (e.g., one-off checks) don't need `useQueryClient`

### Restrictions

- Never call API functions directly in components — always through hooks
- Never use `useQueryClient()` in components — mutations handle invalidation
- Never duplicate query logic — reuse existing hooks
- No `any` types in hook params or return values
