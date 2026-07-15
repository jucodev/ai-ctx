---
description: Rules for barrel index.ts files in component, page, layout, hook, and store directories
paths:
  - {{frontend}}/modules/**/components/**/index.ts
  - {{frontend}}/modules/**/pages/**/index.ts
  - {{frontend}}/modules/**/layouts/**/index.ts
  - {{frontend}}/modules/**/hooks/**/index.ts
  - {{frontend}}/modules/**/stores/**/index.ts
---

## Index Export Rules

### Pattern

```typescript
// Always use star re-exports
export * from './[Name].component';
export * from './[Name].type';
```

### What to Export

- Always export: the main file (`.component.ts`, `.hook.ts`, `.store.ts`)
- Always export: `.type.ts` (if it exists)
- Usually NOT exported: `.schema.ts` — internal to the form component
- Usually NOT exported: `.helper.ts` — internal utilities
- Usually NOT exported: `.const.ts` — unless needed by external consumers

### Import Usage

```typescript
// Consumers import from the directory, not the specific file
import { ProductCard } from '#/product/components/ProductCard';
// NOT: import { ProductCard } from '#/product/components/ProductCard/ProductCard.component'
```

### Rules

- Never add logic to `index.ts` — only re-exports
- Keep it minimal: just the export lines
- File should rarely exceed 5 lines

### Restrictions

- Never import in `index.ts` — only `export *`
- Never transform or filter exports
- No default exports — never add `export { default }`
