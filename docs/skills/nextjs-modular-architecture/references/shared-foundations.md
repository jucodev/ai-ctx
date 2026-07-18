# Cimientos de `modules/shared/` — la capa de red

El **error tipado, el entorno validado y los dos fetchers**: las primeras piezas que se escriben en
un proyecto nuevo, porque todo el resto de la arquitectura las asume ya existentes. Son
deliberadamente pequeñas, sin dependencias del dominio, y se copian tal cual.

Orden de creación dentro de este archivo: `errors/http-error.ts` → `helpers/env.helper.ts` →
`services/fetcher.ts` → `services/server-fetcher.ts`.

**Los otros dos bloques de `shared/` viven aparte** (léelos solo si vas a ese tema):

| Pieza | Archivo |
| --- | --- |
| `Entity` + `OnlyProps`, `PaginationParams`/`PaginationResult`, `url.helper` | `references/shared-types.md` |
| `QueryClientProvider` + diccionario `errorCode → mensaje` (el toast global) | `references/error-toast-provider.md` |

Al montar un proyecto desde cero se escriben los tres, en ese orden.

---

## 1. `shared/errors/http-error.ts` — el único tipo de error de red

Un error tipado que transporta lo que la UI necesita para decidir qué hacer: el **código de error de
negocio** del backend (`errorCode`), su nombre, y el status HTTP.

```typescript
// ✅ modules/shared/errors/http-error.ts
export class HttpError extends Error {
  readonly errorCode?: string;

  readonly errorName?: string;

  readonly httpStatus?: number;

  constructor(
    message: string,
    options: {
      errorCode?: string;
      errorName?: string;
      httpStatus?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'HttpError';
    this.errorCode = options.errorCode;
    this.errorName = options.errorName;
    this.httpStatus = options.httpStatus;
  }
}
```

**Por qué así:**

- **Todos los campos opcionales.** Un fallo de red (DNS caído, offline) no tiene status ni código —
  se construye con `new HttpError('Network error', { cause })` y sigue siendo el mismo tipo. La UI
  nunca tiene que distinguir entre "error de red" y "error de API" para renderizar.
- **`errorCode` es la clave de traducción**, no el mensaje. El backend devuelve un **código opaco**
  (`2-001`, `4-010`: prefijo de módulo + número correlativo) y el frontend lo mapea a texto
  localizado. Es un identificador estable y sin semántica filtrada, no un texto legible — ver
  `references/error-toast-provider.md`.
- **`errorName` es para depurar, nunca para renderizar.** Sirve para logs y breadcrumbs; en cuanto lo
  usas para decidir qué pintar, has acoplado la UI a los nombres de clase del backend.
- **`cause` solo se pasa si existe:** `super(message, undefined)` y `super(message, { cause:
  undefined })` no son equivalentes en todos los runtimes; el condicional evita rarezas al
  serializar el error.
- **`this.name = 'HttpError'`** explícito: al minificar, `constructor.name` se destroza. Sin esto,
  los logs de producción muestran nombres de una letra.

---

## 2. `shared/helpers/env.helper.ts` — variables validadas en arranque

El `fetcher` necesita la URL base de la API. Que se lea de un `process.env` sin validar es la causa
número uno de un `fetch('undefined/users')` que falla en runtime.

```typescript
// ✅ modules/shared/helpers/env.helper.ts
import { z } from 'zod';

export const envVariablesSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  // cada variable nueva se añade aquí
});

export type EnvVariables = z.infer<typeof envVariablesSchema>;

/**
 * Valores validados listos para consumir desde el código.
 * Las claves se enumeran **literalmente**: ver el porqué debajo.
 */
export const ENV: EnvVariables = envVariablesSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
```

El **layout raíz** valida el entorno completo en arranque, incluidas las variables server-only:

```tsx
// ✅ app/layout.tsx
import { envVariablesSchema } from '#/shared/helpers/env.helper';

envVariablesSchema.parse(process.env);
```

**Por qué así:**

- **`envVariablesSchema` es el export principal** y el layout raíz lo parsea contra `process.env`: si
  falta una variable, la app revienta en el arranque con un mensaje claro, no con un bug silencioso
  tres pantallas más adentro.
- **En `ENV` las claves se listan una a una y de forma literal.** Next.js sustituye
  `process.env.NEXT_PUBLIC_*` en build time por **reemplazo textual**, así que un `process.env[key]`
  dinámico —o pasar el objeto `process.env` entero— se resuelve a `undefined` en el bundle del
  cliente. En el servidor `parse(process.env)` sí funciona; por eso el layout puede hacerlo y `ENV`
  no.
- **Consume siempre `ENV.X`**, tipado y validado, nunca `process.env.X` disperso por el código.

---

## 3. `shared/services/fetcher.ts` — cliente HTTP del navegador

Único punto de la app que habla HTTP desde el cliente. Todas las funciones de `modules/*/api/` pasan
por aquí.

El `fetcher` es **deliberadamente agnóstico**: acepta el `RequestInit` nativo tal cual y **devuelve
la `Response`**. Solo se reserva tres responsabilidades transversales: resolver la URL base, mandar
las credenciales y **normalizar cualquier fallo a `HttpError`**. La deserialización (`res.json()`) y
la forma del body las decide cada función de `api/`.

```typescript
// ✅ modules/shared/services/fetcher.ts
import { ENV } from '#/shared/helpers/env.helper';
import { HttpError } from '#/shared/errors/http-error';

export async function fetcher(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${ENV.NEXT_PUBLIC_API_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, { ...options, credentials: 'include' });
  } catch (cause) {
    // Fallo de red: no hay respuesta, así que no hay código de error.
    throw new HttpError('Network error', { cause });
  }

  if (!response.ok) {
    // Solo consumimos el body en el camino de error; en el de éxito lo lee quien llama.
    const text = await response.text();
    const body = (text ? (JSON.parse(text) as unknown) : {}) as {
      code?: string;
      message?: string;
      name?: string;
    };

    throw new HttpError(body.message ?? response.statusText, {
      errorCode: body.code,
      errorName: body.name,
      httpStatus: response.status,
    });
  }

  return response;
}
```

Y así lo reutiliza cualquier función de `api/` de un módulo:

```typescript
// ✅ modules/product/api/product.api.ts
const res = await fetcher(`${API_ROUTES.PRODUCTS}/${id}`);
return res.json() as Promise<{ product: Product }>;
```

**Decisiones y por qué:**

| Decisión | Motivo |
| --- | --- |
| **Devuelve `Response`, no `T`** | Mantiene el fetcher agnóstico del contrato de cada endpoint: quien llama decide si hace `.json()`, `.blob()` o ignora el body (un `204` no tiene nada que parsear). Un fetcher genérico que parsea siempre obliga a meter casos especiales para descargas y respuestas vacías. |
| `RequestInit` nativo sin envoltorio | Cero API propia que aprender: `method`, `headers` y `body` son los de `fetch`. Quien llama serializa (`JSON.stringify` + `Content-Type: application/json`) o pasa un `FormData` **sin** header, para que el navegador ponga el `boundary` multipart. |
| Query params con `URLSearchParams` en la función `api/` | Concatenar a mano rompe con valores que necesitan encoding (`&`, espacios, acentos). Para la paginación se usa `setPaginationInUrl` (ver `references/shared-types.md`). |
| `path.startsWith('http')` salta la base | Permite llamar a URLs absolutas (webhooks, presigned URLs de S3) con el mismo helper. |
| `credentials: 'include'` | La sesión va en cookie httpOnly hacia otro origen (la API). Sin esto, todas las peticiones salen anónimas. |
| `try/catch` **solo** alrededor de `fetch` | `fetch` únicamente rechaza por fallo de red — un 500 resuelve normal. Ese catch es el caso "no hubo respuesta"; el `!response.ok` de abajo es "hubo respuesta y es un error". Dos situaciones distintas, mismo tipo de error de salida. |
| El body de error se lee con `.text()` + `JSON.parse` | Un 500 de un proxy suele devolver HTML o cuerpo vacío; `response.json()` lanzaría un `SyntaxError` opaco que taparía el error real. |
| El body de error se lee como `{ code, message, name }` | Es el contrato de error del backend. Si tu API usa otras claves, este es el **único** sitio a cambiar. |

**Regla de uso:** las funciones de `api/` **nunca** llevan `try/catch` ni comprueban `response.ok`;
eso ya lo hizo el fetcher. El error viaja hasta el provider de TanStack Query, que lo convierte en
toast (ver `references/error-toast-provider.md`).

---

## 4. `shared/services/server-fetcher.ts` — para Server Components

Un fetcher separado, no una bandera dentro del anterior. En el servidor no hay cookies automáticas
ni `credentials: 'include'`: hay que reenviar la cabecera `cookie` a mano.

Mismo contrato que el de cliente —**devuelve la `Response`**— con una sola excepción: un **401
devuelve `null`** en vez de lanzar, porque en el servidor "no hay sesión" es una respuesta esperable,
no un error. De ahí el `Response | null`.

```typescript
// ✅ modules/shared/services/server-fetcher.ts
import 'server-only';

import { ENV } from '#/shared/helpers/env.helper';
import { HttpError } from '#/shared/errors/http-error';

type ServerFetcherOptions = RequestInit & { cookieHeader?: string };

export async function serverFetcher(
  path: string,
  options: ServerFetcherOptions = {},
): Promise<Response | null> {
  const url = `${ENV.NEXT_PUBLIC_API_URL}${path}`;

  const headers = new Headers(options.headers);
  if (options.cookieHeader) headers.set('cookie', options.cookieHeader);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, cache: 'no-store' });
  } catch (cause) {
    throw new HttpError('Network error', { cause });
  }

  // Sin sesión: respuesta esperable en el servidor, no una excepción.
  if (response.status === 401) return null;

  if (!response.ok) {
    const text = await response.text();
    const body = (text ? (JSON.parse(text) as unknown) : {}) as {
      code?: string;
      message?: string;
      name?: string;
    };

    throw new HttpError(body.message ?? response.statusText, {
      errorCode: body.code,
      errorName: body.name,
      httpStatus: response.status,
    });
  }

  return response;
}
```

Uso típico desde un layout protegido o un Server Component:

```typescript
// ✅ modules/auth/api/auth.api-server.ts
import 'server-only';
import { headers } from 'next/headers';
import { serverFetcher } from '#/shared/services/server-fetcher';
import { API_ROUTES } from '#/shared/constants/api-routes';
import type { Session } from '#/auth/types';

export async function getSession(): Promise<Session | null> {
  const cookieHeader = (await headers()).get('cookie') ?? undefined;
  const res = await serverFetcher(API_ROUTES.SESSION, { cookieHeader });
  return res ? (res.json() as Promise<Session>) : null;
}
```

**Diferencias con el fetcher de cliente, y por qué:**

- **`import 'server-only'`** — si alguien lo importa desde un Client Component, el build falla en vez
  de filtrar cookies de sesión al bundle del navegador.
- **`401 → null`, no throw.** En el cliente un 401 es un error que el provider silencia; en el
  servidor lo típico es un layout preguntando "¿hay sesión?", y `null` es la respuesta esperable, no
  una excepción. Por eso el tipo de retorno es `Response | null` y quien llama gatea con
  `if (!session) redirect(...)`. **No** conviertas otros status a `null`: un 500 debe romper
  visiblemente.
- **`cache: 'no-store'` siempre.** Estas peticiones llevan cookie de sesión; cachearlas serviría los
  datos de un usuario a otro.
- **Nada de `credentials: 'include'`.** En el servidor no existe el almacén de cookies del navegador:
  la sesión viaja solo si reenvías la cabecera `cookie` a mano.

---
