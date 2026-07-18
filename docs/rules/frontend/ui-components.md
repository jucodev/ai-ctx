---
description: Rules for non-form UI React components
paths:
  - {{frontend}}/modules/**/components/**/*.component.tsx
  - {{frontend}}/modules/**/pages/**/*.component.tsx
  - {{frontend}}/modules/**/layouts/**/*.component.tsx
---

## UI Component Rules

### File Structure

```
[ComponentName]/
├── [ComponentName].component.tsx   # Component
├── [ComponentName].type.ts         # Props interface (if non-trivial)
├── [ComponentName].const.ts        # Config constants, mappers, etc. (if needed)
├── [ComponentName].helper.ts       # Pure utility functions for the component (if needed)
└── index.ts                        # Barrel exports
```

Simple components may define props inline in the component file and omit `.type.ts`.

### Component Pattern

```typescript
// Add "use client" ONLY if hooks or event handlers are needed
import type { [ComponentName]Props } from './[ComponentName].type';

export function [ComponentName]({ prop1, prop2 }: [ComponentName]Props) {
  return (
    <div>
      {/* content */}
    </div>
  );
}
```

### Props Typing Rules

- For simple or few props: define the interface inline in the component file
- For non-trivial props: colocate in `.type.ts` and export from `index.ts`
- Use `Pick<Entity, 'field1' | 'field2'>` for entity-based props — avoid passing full entities
- Example: `product: Pick<Product, 'id' | 'name' | 'type'>` not `product: Product`

### Index Exports

```typescript
export * from './[ComponentName].component';
export * from './[ComponentName].type'; // only if .type.ts exists
```

### UI Library Usage

- Always use components from `components/ui/` (shadcn/ui) — never raw HTML elements if an equivalent shadcn component exists
- Before writing any UI code, search the shadcn registry via the `shadcn` MCP (`mcp__shadcn__search_items_in_registries`, `mcp__shadcn__view_items_in_registries`) to look up the component API, props, and usage examples
- If a component is not yet installed locally, install it with `npx shadcn@latest add <component>` — it will land in `components/ui/`
- If a needed component doesn't exist in shadcn, create it in `components/ui/` following the same conventions (variantes con `cva`, helper `cn()`, primitivas de `@base-ui/react` when applicable)
- Use `cn()` from `#/shared/helpers/styles` for conditional class merging — it is available throughout the project. Note the alias: `#/*` maps to `modules/*`, `@/*` to the app root
- The shadcn CLI generates its own `cn()` in `lib/utils.ts` on init. Keep **one** implementation: have `lib/utils.ts` re-export the one in `shared/helpers/styles` (or point the `utils` alias in `components.json` at it), so installed shadcn components and your own code share it
- Never use inline styles — always Tailwind classes

### Icon Usage (MANDATORY CHECK)

Icons come exclusively from `lucide-react`. Do **not** install other icon libraries (heroicons, react-icons, etc.) without explicit user approval.

```tsx
import { Settings } from 'lucide-react';

<Settings size={16} className="text-muted-foreground" />;
```

Before using an icon, verify its name exists in `lucide-react` — icon names are PascalCase (e.g. `Settings`, `ChevronDown`, `Loader2`). If the exact icon isn't available, pick the closest alternative and tell the user.

### Tailwind Color Tokens

This project defines two layers of color tokens in `app/globals.css` (dashboard) — use the appropriate one for context:

**shadcn semantic tokens** (prefer these for component-level styling — they adapt to light/dark mode automatically):

| Token                     | Usage                               |
| ------------------------- | ----------------------------------- |
| `text-foreground`         | Primary text                        |
| `text-muted-foreground`   | Secondary / helper text             |
| `bg-background`           | Page background                     |
| `bg-card`                 | Card surfaces                       |
| `bg-muted`                | Subtle backgrounds, disabled states |
| `bg-accent`               | Hover/focus highlight surfaces      |
| `text-primary`            | Brand-primary text                  |
| `bg-primary`              | Brand-primary fill (buttons, etc.)  |
| `text-primary-foreground` | Text on brand-primary fill          |
| `border-border`           | Default border color                |
| `bg-destructive`          | Error/destructive fill              |
| `text-destructive`        | Error text                          |

**Custom brand scales** (use for explicit brand expression — hero sections, badges, illustrations):

| Scale          | Shades       | Example                          |
| -------------- | ------------ | -------------------------------- |
| `brand`        | `50` – `900` | `text-brand-700`, `bg-brand-100` |
| `brand-accent` | `50` – `900` | `bg-brand-accent-400`            |

**Source of truth:** `app/globals.css` → `@theme inline` block lists every registered token. When unsure whether a token exists, check that file — do not invent token names.

### "use client" Rules

- Add `"use client"` ONLY if the component uses hooks, event handlers, or browser APIs
- Server components cannot use: `useState`, `useEffect`, `onClick`, etc.
- When in doubt, try without `"use client"` first

### Restrictions

- No default exports — named exports only
- Never call API functions directly in components
- Never use TanStack Query hooks directly in display/UI components — use them in page components
- No business logic in UI components — keep them purely presentational
