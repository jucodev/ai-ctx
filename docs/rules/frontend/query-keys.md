---
description: Rules for TanStack Query key factories
paths:
  - {{frontend}}/modules/**/queries/keys/*.keys.ts
---

## Query Key Factory Rules

### Structure Pattern

**Standard CRUD entities** (have list + detail endpoints):

```typescript
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (params: Parameters<typeof getEntities>[0]) => [...entityKeys.lists(), params] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
};
```

**Non-CRUD entities** (custom scopes, no standard list/detail shape):

```typescript
export const entityKeys = {
  all: ['entity'] as const,
  scopeA: (params: ScopeAParams) => [...entityKeys.all, 'scope-a', params] as const,
  scopeB: (params: ScopeBParams) => [...entityKeys.all, 'scope-b', params] as const,
};
```

### Hierarchy Rules

- `all` is the root — always a single-element array with the entity name
- `lists()` extends `all` with `'list'`
- `list(params)` extends `lists()` with the full params object
- `details()` extends `all` with `'detail'` (singular)
- `detail(id)` extends `details()` with the specific id
- Custom scopes extend `all` directly: `[...entityKeys.all, 'scope-name', params]`

### Naming Rules

- Key factory object: `[entity]Keys` (camelCase, singular entity, `Keys` suffix)
- File name: `[entity].keys.ts` (kebab-case)
- Base array string: plural entity name for CRUD (`['products']`), singular for non-CRUD (`['report']`)

### Type Safety Rules

- Always use `as const` on every key factory function return
- Derive param types from the API function signature with `Parameters<typeof fn>[0]`, or import the type directly from the module's `types.ts` — both are valid
- Never hardcode inline types for params if a type already exists

### Restrictions

- Never use query keys inline in components or hooks — always via the factory
- Never create ad-hoc query keys inside mutation `onSuccess` — import the factory
- Never skip hierarchy levels — always go `all → lists → list` or `all → details → detail`
