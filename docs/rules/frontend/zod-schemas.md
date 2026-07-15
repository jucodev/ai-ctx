---
description: Rules for Zod validation schemas in form and page components
paths:
  - {{frontend}}/modules/**/*.schema.ts
---

## Zod Schema Rules

### File Pattern

- One schema file per component or page that has forms/filters
- Always named `[ComponentName].schema.ts`
- If the file has a single main form schema, name the export `formSchema`
- If the file has multiple schemas (e.g., one form + several filter schemas), use descriptive names: `credentialsSchema`, `productsFilterSchema`

### Import Pattern

```typescript
import { z } from 'zod';
import { FORM_VALIDATION_MSG } from '#/shared/constants/form-messages';
import { ProductType, ProductStatus } from '#/[module]/types'; // import enums from types
```

### Field Type Rules

```typescript
export const formSchema = z.object({
  // Text — required: trim + nonempty with message from FORM_VALIDATION_MSG
  name: z.string().trim().nonempty(FORM_VALIDATION_MSG.required),

  // Text — optional
  description: z.string().optional(),

  // URL
  baseUrl: z
    .string()
    .trim()
    .url(FORM_VALIDATION_MSG.invalidUrl)
    .nonempty(FORM_VALIDATION_MSG.required),

  // TypeScript enums — use z.enum(), NOT z.nativeEnum()
  type: z.enum(ProductType),
  status: z.enum(ProductStatus),

  // Booleans
  isActive: z.boolean(),

  // IDs (UUID format)
  entityId: z.string().uuid(),

  // Dates
  dateBirth: z.date(),

  // Files
  image: z.instanceof(File),
  video: z.instanceof(File).optional(),

  // Arrays of objects (field arrays)
  breeds: z.array(z.object({ id: z.string().uuid() })),

  // Arrays of strings
  images: z.array(z.string()).optional(),
});
```

### Enum Validation

- Use `z.enum(EnumName)` for TypeScript enums (Zod v4 — `z.nativeEnum()` was removed)
- Import the enum from the module's `types.ts`, never hardcode string literals in the schema

### Error Messages

- Use `FORM_VALIDATION_MSG` from `#/shared/constants/form-messages` for common messages (required, invalid URL, etc.)
- Add new entries to `FORM_VALIDATION_MSG` when a message could be reused — never hardcode a string directly
- Inline a message only if it is truly one-off and specific to that field

### Type Export Pattern

In the component's `.type.ts` file, derive the form data type from the schema:

```typescript
import { z } from 'zod';
import { formSchema } from './[ComponentName].schema';

export type [ComponentName]FormData = z.infer<typeof formSchema>;
```

### Restrictions

- Never define validation logic in the component file — only in the schema file
- Never use `z.any()` — use specific types or `z.unknown()`
- Never duplicate error message strings — always go through `FORM_VALIDATION_MSG`
