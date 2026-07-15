---
description: TypeScript conventions for the API
paths:
  - {{backend}}/src/**/*.ts
---

# TypeScript Conventions

## Imports

- Always use path aliases: `@/module/...` for `src/`, `lib/...` for `lib/` — never relative paths (`../../../`)
- Import order: `reflect-metadata` first (only in `main.ts`), then external packages, then internal aliases

## Types

- Prefer `Pick<Entity, 'field'>` and `Omit<...>` over redefining shapes — types stay in sync with entities automatically
- Use `NonNullable<Awaited<ReturnType<Repo['method']>>>` for the return type of `getByIdOrThrow` variants
- Use `keyof typeof EnumName` to type entity fields backed by enums — not the enum type itself
- `EntityParams` (from `@jucodev/backend-core`) is used as the base of every entity constructor: `EntityParams & Pick<Entity, ...>`

## Patterns

- `Promise.all` for independent async operations — never sequential `await` in a loop unless order matters
- Arrow-function class properties for repository methods — required for `Parameters<>` / `ReturnType<>` inference
- Conditional spreading for optional Prisma `where` clauses: `...(value && { field: value })`

## Strict mode

- `strict: true` is enabled — no implicit `any`, no non-null assertions (`!`) unless you are certain the value cannot be null (e.g. right after `requireAuthMW`)
- Never use `as any` — use proper type narrowing or generics instead
- `noUnusedLocals` and `noUnusedParameters` surface dead code — remove it rather than suppressing

## Decorators

- `@injectable()` on every class registered in the DI container
- `@inject(ClassName.name)` on every constructor parameter that is injected
- Both `emitDecoratorMetadata: true` and `experimentalDecorators: true` must remain in `tsconfig.json` — do not remove them

## File naming

- `kebab-case` for all files
- Suffix conventions: `.entity.ts`, `.repository.ts`, `.service.ts`, `.use-case.ts`, `.router.ts`, `.dto.ts`, `.error.ts`, `.enum.ts`, `.module.ts`, `.mw.ts`
