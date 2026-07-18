---
description: Rules for custom React hooks
paths:
  - {{frontend}}/modules/**/hooks/**/*.hook.ts
---

## Custom Hook Rules

### File Structure

**Simple hook → a single file.** If the whole hook fits legibly in one file, that's where it stays:

```
modules/[module]/hooks/
└── use[Name].hook.ts       # Hook implementation, nothing else
```

**Complex hook → its own directory**, same pattern as components. Split as soon as exported types,
config constants or pure utilities show up, instead of growing one file:

```
modules/[module]/hooks/[HookName]/
├── [HookName].hook.ts      # Hook implementation
├── [HookName].type.ts      # Types (if needed)
├── [HookName].const.ts     # Constants (if needed)
├── [HookName].helper.ts    # Pure utility functions (if needed)
└── index.ts                # Barrel exports
```

Start flat and extract when it hurts, not the other way around — a directory holding a single file
is ceremony with no payoff.

### File Naming

- Always: `use[Name].hook.ts` (with `.hook.ts` suffix)
- Examples: `useProduct.hook.ts`, `usePagination.hook.ts`

### Hook Structure Pattern

```typescript
import { useCallback, useState } from 'react';
import { use[Entity]Store } from '#/[module]/stores/[entity].store';

export function use[Name]() {
  // 1. Store access
  const { field, setField } = use[Entity]Store();

  // 2. Other hooks
  const [localState, setLocalState] = useState(null);

  // 3. Computed values / derived state
  const computedValue = field ? transform(field) : null;

  // 4. Handlers (memoized with useCallback)
  const handleAction = useCallback(() => {
    // logic
  }, [dependencies]);

  // 5. Return object (grouped by: state, actions)
  return {
    // State
    field,
    computedValue,
    localState,

    // Actions
    setField,
    handleAction,
  };
}
```

### useCallback Rules

- Use `useCallback` for handler functions returned from the hook
- Always specify the dependency array — never omit it
- Callbacks that close over state or props must include them in deps

### Composition Rules

- Hooks compose other hooks — never duplicate logic that already exists in another hook
- If a hook wraps a store, it should add computed values or handlers on top
- Shared hooks (used by 2+ modules) go in `modules/shared/hooks/`
- Module-specific hooks in `modules/[module]/hooks/`

### Index Exports

Only for hooks that have their own directory — a single-file hook is imported directly:

```typescript
export * from './[HookName].hook';
export * from './[HookName].type'; // only if .type.ts exists
```

### Restrictions

- Never call hooks conditionally
- One hook export per file
- No default exports
- Never fetch data directly — use query hooks from `queries/hooks/` for server data
