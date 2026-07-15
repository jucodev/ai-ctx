---
description: Prefer TypeScript utility types to derive types instead of duplicating them
paths:
  - {{backend}}/src/**/*.ts
  - {{frontend}}/**/*.ts
  - {{frontend}}/**/*.tsx
---

# TypeScript Utility Types

Whenever possible, derive types from the ones you already have using TypeScript's built-in utility types instead of re-declaring their shape by hand. Duplicated types drift out of sync as the code evolves; derived types update automatically when their source changes, which keeps the code smaller and more maintainable.

## Rules

- **Never duplicate a shape that already exists.** If a type is a subset or variation of another, derive it with `Pick`, `Omit`, `Partial`, `Required`, or `Readonly`.
- **Filter/param types from an entity** use `Partial<Pick<Entity, 'a' | 'b'>>` — never re-type fields that already live on the entity.
- **Mirror a function or method contract** with `Parameters<typeof fn>` and `ReturnType<typeof fn>`; use `Awaited<...>` for the resolved value of a promise.
- **Key/value maps** use `Record<K, V>` instead of a hand-written index signature.
- **Narrow unions** with `Exclude` / `Extract`, and drop `null | undefined` with `NonNullable`.
- **Keep a single source of truth**: prefer `keyof typeof obj`, `typeof value`, and indexed access (`T['field']`) over restating literal or field types.
- **Reach for the built-ins first** — `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `NonNullable`, `Parameters`, `ReturnType`, `InstanceType`, `Awaited` — before writing a custom mapped or conditional type.

## Examples

```ts
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// ✅ subsets and variations derived from User
type UserPreview = Pick<User, 'id' | 'name'>;
type UserUpdate = Partial<Omit<User, 'id' | 'createdAt'>>;
type UserFilter = Partial<Pick<User, 'name' | 'email'>>;

// ✅ mirror a function's contract instead of restating it
async function loadUser(id: string): Promise<User> {
  /* ... */
}
type LoadUserArgs = Parameters<typeof loadUser>; // [id: string]
type LoadedUser = Awaited<ReturnType<typeof loadUser>>; // User

// ✅ maps and narrowing
type UsersById = Record<string, User>;
type PresentUser = NonNullable<User | null | undefined>; // User
```

```ts
// ❌ re-declaring fields that already exist on User — drifts when User changes
type UserUpdate = { name?: string; email?: string };
```

## When a hand-written type is fine

- The new type genuinely shares nothing with an existing one.
- A utility-type chain would read worse than an explicit type. Favor clarity: if you need more than two or three nested utilities, extract intermediate named types instead of one dense expression.
