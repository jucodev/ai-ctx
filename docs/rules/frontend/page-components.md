---
description: Rules for page-level components in modules/
paths:
  - {{frontend}}/modules/**/pages/**/*.component.tsx
---

## Page Component Rules

### File Structure

```
modules/[module]/pages/[PageName]/
├── [PageName].component.tsx
├── [PageName].type.ts        # (if needed)
├── [PageName].const.ts       # Config constants, mappers, etc. (if needed)
├── [PageName].helper.ts      # Pure utility functions (if needed)
└── index.ts

# App Router delegates to the module page:
app/(group)/path/page.tsx
```

### App Router Page Pattern

```typescript
// app/(dashboard)/dashboard/products/page.tsx
import { ProductsPage } from '#/product/pages/ProductsPage';

export default function Page() {
  return <ProductsPage />;
}
```

### Module Page Pattern

```typescript
'use client';

import { useState } from 'react';
import { useEntitiesQuery } from '#/[module]/queries/hooks/useEntitiesQuery';
import { EntityCard } from '#/[module]/components/EntityCard';

export function EntitiesPage() {
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useEntitiesQuery({ filter });

  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

### Responsibilities of Page Components

- Orchestrate data fetching with query hooks
- Manage local UI state (filters, modals, pagination)
- Compose UI components
- Handle navigation
- Complex logic extracted to custom hooks in `hooks/`

### Naming Rules

- Standard pages: `[Feature]Page` — e.g., `ProductsPage`, `SettingsPage`
- List pages: `[Feature]ListPage` — e.g., `ProductsListPage`
- Detail pages: `[Feature]DetailPage` — e.g., `ProductDetailPage`

### Index Exports

```typescript
export * from './[PageName].component';
```

### Language

- All route paths, page names, and component names must be in English — e.g. `/settings` not `/configuracion`, `UserSettingsPage` not `ConfiguracionUsuarioPage`

### Restrictions

- Always `"use client"` — pages are interactive
- No direct API calls — use query hooks
- Keep app router `page.tsx` files as thin wrappers (import + render only)
- Never put reusable UI in pages — extract to `components/`
- Never define types inline in the component file — put them in `[PageName].type.ts`
- Never define constants inline in the component file — put them in `[PageName].const.ts`
- Pages always live in their own subdirectory: `pages/[PageName]/[PageName].component.tsx`
