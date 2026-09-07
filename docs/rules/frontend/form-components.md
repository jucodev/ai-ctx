---
description: Rules for React form components using react-hook-form + zod
paths:
  - {{frontend}}/modules/**/components/**/*.component.tsx
  - {{frontend}}/modules/**/pages/**/*.component.tsx
---

## Form Component Rules

> These rules apply to any component that contains `useForm`. For standalone reusable form components (in `components/`), follow the full 4-file structure. Page components may embed forms directly.

### Required Files for Standalone Form Components

```
[FormName]/
├── [FormName].component.tsx   # Component
├── [FormName].schema.ts       # Zod schema
├── [FormName].type.ts         # TypeScript types + Props
└── index.ts                   # Barrel exports
```

### Component Structure

Use the shadcn `field` primitives (`Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSet`, `FieldLegend`) for field layout and error display, wired to react-hook-form through `Controller`. If `components/ui/field.tsx` is not yet installed, run `npx shadcn@latest add field` first.

> The old `Form` / `FormField` / `FormItem` / `FormControl` / `FormMessage` primitives from `@/components/ui/form` are gone from current shadcn: `npx shadcn add form` no longer registers anything (it exits without creating files and without an error). `Field` is the replacement — see https://ui.shadcn.com/docs/components/base/field and https://ui.shadcn.com/docs/forms/react-hook-form.

```typescript
'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formSchema } from './[FormName].schema';
import type { [FormName]Props, [FormName]SubmitData } from './[FormName].type';

export function [FormName]({ formId, onSubmit, defaultValues }: [FormName]Props) {
  const form = useForm<[FormName]SubmitData>({
    resolver: zodResolver(formSchema),
    defaultValues: { fieldName: '', ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => onSubmit?.(data))} id={formId}>
      <FieldGroup>
        <Controller
          control={form.control}
          name="fieldName"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Field label</FieldLabel>
              <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
              <FieldDescription>Optional helper text</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
```

### Props Pattern (in .type.ts)

```typescript
import { z } from 'zod';
import { formSchema } from './[FormName].schema';

export type [FormName]SubmitData = z.infer<typeof formSchema>;

export interface [FormName]Props {
  formId?: string;
  mode?: 'creation' | 'update';
  onSubmit?: (data: [FormName]SubmitData) => void;
  defaultValues?: Partial<[FormName]SubmitData>;
}
```

### Index Exports (in index.ts)

```typescript
export * from './[FormName].component';
export * from './[FormName].type';
```

### Field Rules

- Always use `Controller` with the `render` prop — never use `register()` directly with custom components
- Spread `field` directly on the input: `<Input {...field} id={field.name} />`, and give the input an `id` matching `field.name` so `FieldLabel htmlFor` pairs with it
- Always wrap a field with `Field` → `FieldLabel` → control → `FieldError` — this provides label, error display, and accessibility
- Mark invalid state on both sides: `data-invalid={fieldState.invalid}` on `Field` and `aria-invalid={fieldState.invalid}` on the control
- `FieldError` takes the error objects as an array: `errors={[fieldState.error]}`; render it only when the field is invalid
- Stack fields inside a single `FieldGroup`; use `FieldSet` + `FieldLegend` for a semantic group of related fields (radio groups, checkbox groups, address blocks)
- `FieldDescription` is for helper text, never for error text
- Error messages come from the Zod schema — no translation at the component level

### useForm Rules

- Always use `zodResolver(formSchema)` as resolver
- Type `useForm` with the derived type from `.type.ts`: `useForm<[FormName]SubmitData>`
- Always provide `defaultValues` with all fields initialized to prevent uncontrolled→controlled warnings
- Use `mode?: 'creation' | 'update'` prop for forms that render conditionally based on create/edit state

### Restrictions

- Never put the Zod schema inside the component file — always in `[FormName].schema.ts`
- Never import from `@/components/ui/form` — that component no longer exists in shadcn; use `@/components/ui/field`
- Never use `register()` with custom UI components — always `Controller` with `render`
- Never use `watch()` for display logic — use `useWatch()` or derive from `Controller`
- No default exports — named exports only
- Standalone form components (in `components/`) must use `onSubmit` callback — never call mutations directly inside them; mutations belong in the page or layout that renders the form
