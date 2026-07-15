---
description: Rules for managing environment variables in the Next.js apps
paths:
  - {{frontend}}/modules/shared/helpers/env.helper.ts
  - {{frontend}}/.env*
---

## Environment Variables — Schema Rule

Environment variables are validated at startup via a Zod schema in `modules/shared/helpers/env.helper.ts`. The root layout (`app/layout.tsx`) calls `envVariablesSchema.parse(process.env)` on boot — if a required variable is missing or has the wrong type, the app throws immediately.

### Main rule

**Every time a new environment variable is added, add it to the schema too.**

```ts
// modules/shared/helpers/env.helper.ts
import { z } from 'zod';

export const envVariablesSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  // add each new variable here
});
```

### Criteria

- Required variables → required field (no `.optional()` or `.default()`)
- Optional variables → `.optional()` or `.default('value')`
- `NEXT_PUBLIC_*` variables → available on both client and server
- Variables without the prefix → server-only (Next.js strips them from the client bundle)

### Checklist when adding a variable

1. Add it to the schema in `env.helper.ts` with the correct Zod type
2. Add it to `.env.example` with a sample value (never a real one)
3. Add it to your local `.env.local` with the real value
