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

Use the shadcn `form` primitives (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) for field layout and error display. If `components/ui/form.tsx` is not yet installed, run `npx shadcn@latest add form` first.

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formSchema } from './[FormName].schema';
import type { [FormName]Props, [FormName]SubmitData } from './[FormName].type';

export function [FormName]({ formId, onSubmit, defaultValues }: [FormName]Props) {
  const form = useForm<[FormName]SubmitData>({
    resolver: zodResolver(formSchema),
    defaultValues: { fieldName: '', ...defaultValues },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit?.(data))} id={formId}>
        <FormField
          control={form.control}
          name="fieldName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Field label</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
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

### FormField Rules

- Always use `FormField` with `render` prop — never use `register()` directly with custom components
- Spread `field` directly on the input inside `FormControl`: `<Input {...field} />`
- Always wrap fields with `FormItem` → `FormLabel` → `FormControl` → `FormMessage` — this provides label, error display, and accessibility
- `FormMessage` renders the error message automatically from the field state — no need to pass it manually
- Error messages come from the Zod schema — no translation at the component level

### useForm Rules

- Always use `zodResolver(formSchema)` as resolver
- Type `useForm` with the derived type from `.type.ts`: `useForm<[FormName]SubmitData>`
- Always provide `defaultValues` with all fields initialized to prevent uncontrolled→controlled warnings
- Use `mode?: 'creation' | 'update'` prop for forms that render conditionally based on create/edit state

### Restrictions

- Never put the Zod schema inside the component file — always in `[FormName].schema.ts`
- Never use `register()` with custom UI components — always `FormField` with `render`
- Never use `watch()` for display logic — use `useWatch()` or derive from `FormField`
- No default exports — named exports only
- Standalone form components (in `components/`) must use `onSubmit` callback — never call mutations directly inside them; mutations belong in the page or layout that renders the form
