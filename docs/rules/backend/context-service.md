---
description: Rules for the request context service (framework decoupling)
paths:
  - {{backend}}/src/**/*.ts
---

# Request Context Rules (framework decoupling)

The HTTP framework (Hono) must stay at the very edge of the system. Application code (services, use cases) and even router handlers must NOT depend on Hono's request-scoped accessors. Coupling business logic to `c.var` / `c.set` / `c.req.*` makes the code impossible to reuse outside an HTTP request (jobs, cron, tests, another framework).

## The single seam: `ContextService`

Any ambient, request-derived datum that downstream code needs — the authenticated user, trace id, locale, a relevant header — is written **once** into `ContextService` (the `AsyncLocalStorage` `httpContext` store) by a middleware, and read **from `ContextService`** everywhere else via DI (`@inject(ContextService.name)`).

The generic `ContextService` base lives in `@jucodev/backend-core`; the app **subclasses** it in `@/shared/application/core/services/context.service.ts` to declare each store's shape (`HttpContext`, `SchedulerContext`) and add typed accessors (e.g. the authenticated user). It is framework-agnostic: swapping Hono for another transport should only touch the HTTP implementation (`HonoHttpServerService` in `@jucodev/backend-core/hono`, where the context-init middleware lives) + the `presentation/` routers, never application code.

## Hard rules

- **Never read request-scoped/ambient data via Hono in handlers or application code:** no `c.var.*`, no `c.set(...)`, no `c.req.header(...)`, no `Hono`/`Context` types passed into services or use cases. The authenticated user is the canonical example — get it with `contextService.getAuthenticatedUserId()`, never `c.var.userId`.
- **Middleware is the only writer.** A middleware (e.g. `RequireAuthMiddleware`) extracts the datum from the raw request and calls a typed setter on `ContextService` (e.g. `setAuthenticatedUser({ id, email })`). Middlewares are injectable classes that `@inject(ContextService.name)` — never reach for the DI `container` inside a plain middleware function.
- **Routers/services/use-cases are readers.** Inject `ContextService` and call its typed getters. Entity construction that needs the creator/owner reads `contextService.getAuthenticatedUserId()` in the router (entities are still built in the router per `presentation-routers.md`).
- **Type the store, don't stuff loose keys.** Add a typed field to the `HttpContext` interface in `context.service.ts` and a typed getter/setter pair — do not store arbitrary string keys.
- **What is still allowed at the edge:** validated _input_ via `zValidator` + `c.req.valid('json' | 'query' | 'param')`, and _responses_ via `c.json(...)`. Those are the endpoint's explicit contract, not ambient context. Everything ambient goes through `ContextService`.

## Pattern

```ts
// shared/application/core/services/context.service.ts — app subclass of the package base
import { injectable } from 'inversify';
import { ContextService as BaseContextService, BaseStore } from '@jucodev/backend-core';

interface HttpContext extends BaseStore {
  request?: { method: string; url: string };
  userId?: string;
  userEmail?: string;
}

interface SchedulerContext extends BaseStore {
  cronJobName?: string;
}

@injectable() // decorate the subclass (the bound leaf), never the package base
export class ContextService extends BaseContextService<HttpContext, SchedulerContext> {
  // Writer helper: the generic `setHttpStore` merges into the active store.
  setAuthenticatedUser(user: { id: string; email: string }): void {
    this.setHttpStore({ userId: user.id, userEmail: user.email });
  }

  getAuthenticatedUserId(): string {
    const { userId } = this.getHttpStore();
    if (!userId) throw new Error('No authenticated user in context');
    return userId;
  }
}
```

```ts
// auth/presentation/middlewares/require-auth.mw.ts — the only writer
@injectable()
export class RequireAuthMiddleware {
  constructor(@inject(ContextService.name) private readonly contextService: ContextService) {}

  handle: MiddlewareHandler = async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) throw new AuthError.UnauthorizedError();
    this.contextService.setAuthenticatedUser({ id: session.user.id, email: session.user.email });
    await next();
  };
}
```

```ts
// any router — reader, no c.var
@injectable()
export class SomeRouterV1 extends Router {
  constructor(
    @inject(SomeService.name) private readonly service: SomeService,
    @inject(ContextService.name) private readonly contextService: ContextService,
    @inject(RequireAuthMiddleware.name) private readonly requireAuth: RequireAuthMiddleware,
  ) {
    super({ basePath: '/resource/v1' });
  }

  run(app: Hono): void {
    app.use('*', this.requireAuth.handle);
    app.post('/', zValidator('json', SomeDto), async (c) => {
      const data = c.req.valid('json'); // explicit input — OK
      const userId = this.contextService.getAuthenticatedUserId(); // ambient — from context, NOT c.var
      const result = await this.service.doThing({ data, userId });
      return c.json({ result }, { status: 201 });
    });
  }
}
```
