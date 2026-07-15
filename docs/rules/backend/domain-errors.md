---
description: Rules for domain errors and the app error type
paths:
  - {{backend}}/src/**/domain/errors/**/*.ts
  - {{backend}}/src/**/shared/domain/types/app-error.type.ts
---

# Domain Error Rules

- Every error class **must extend `AppError`** from `@/shared/domain/types/app-error.type`
- Errors are grouped in a **namespace** named `<EntityName>Error` — never export bare error classes
- Each error has a sequential numeric code: `PREFIX-001`, `PREFIX-002`, etc. — never reuse a code within the same namespace
- The prefix comes from `PREFIX_ERRORS` in `app-error.type.ts` — **register a new entry there** whenever a new module is created
- HTTP status is set **per error class** in the constructor, not per handler: 404 → not found, 409 → conflict, 422 → unprocessable, 406 → not acceptable, 401 → unauthorized, 403 → forbidden
- Never use raw `Error`, `new Error()`, or `throw new Error()` in domain or application code — always throw a typed `AppError` subclass
- Error names are auto-generated as `MODULE_ERROR.ClassName` — do not set `this.name` manually
- `AppError` subclasses accept only a `message: string` constructor param — context goes in the message, not in extra properties
- The global `onError` handler in `main.ts` catches all `AppError` instances automatically — do not add try/catch in routers for domain errors
