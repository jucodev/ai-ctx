---
title: Error Handling
description: De la excepción de dominio al toast del usuario. Úsala al montar el manejo de errores de un proyecto nuevo o al añadir un error a uno existente. Agnóstica de negocio, framework HTTP y stack de i18n.
---

# Error Handling — de la excepción de dominio al toast del usuario

> **Cuándo usar esta guía:** al montar el manejo de errores de un proyecto nuevo, o cada vez que añades un error a uno existente. Es **agnóstica del negocio, del framework HTTP y del stack de i18n**: describe el patrón, no las entidades de un proyecto concreto.

Todo el código de esta guía es copiable tal cual. Los ejemplos usan un módulo genérico llamado `example`.

---

## 0. Qué asume esta guía

| Pieza                | Qué se usa aquí                                 | ¿Sustituible?                                                                 |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Core del backend     | [`@jucodev/backend-core`](#) ≥ 2.0 (`AppError`) | Sí — §2 explica qué hace la clase; puedes escribirla a mano                   |
| Framework HTTP       | El servidor HTTP del core (Hono por debajo)     | Sí — §5 da la variante sin el core, contra el handler nativo del framework    |
| Cliente HTTP         | `fetch` nativo                                  | Sí — solo importa que el error se deserialice a `HttpError` (§6)              |
| Estado servidor (UI) | TanStack Query v5                               | Sí — §8 da la variante sin TanStack                                           |
| Toasts               | `sonner`                                        | Sí — cualquier lib de toasts                                                  |
| i18n                 | Opcional                                        | Sí — §7 cubre **con** y **sin** traducciones; el resto de la cadena no cambia |

**Convenciones de rutas** (adáptalas a tu proyecto; en esta guía se usan tal cual):

- `@/*` → `src/*` en la **API**.
- `#/*` → `modules/*` en la **app cliente**.
- "App cliente" = cualquier frontend que consume la API. Si tienes varias, cada una lleva su propia copia de `fetcher.ts` + `http-error.ts` (§6).

---

## 1. La cadena completa

```
Error de dominio (subclase de AppError)          ← lo defines en tu app
  ↑ también lo lanzan las bases reutilizables,
    vía factorías de error que les pasa la app (§4)
  → servidor HTTP del core    (lo loguea y lo serializa a JSON + status HTTP)
  → fetcher en la app cliente (deserializa a HttpError)
  → capa de UI                (busca el mensaje por código y muestra el toast)
```

La pieza que lo cose todo es el **código de error** (`PREFIX-NNN`). Es lo único que la API garantiza en producción, y es la clave con la que el cliente busca el mensaje que verá el usuario. Todo lo demás (`message`, `name`) es material de debugging y **desaparece en producción**.

Ese mensaje sale de un diccionario `Record<string, string>` (`código → texto`). Si el proyecto tiene i18n viene de los locales; si no, de una constante. El resto de la cadena es idéntico en ambos casos (§7).

El reparto con el core es constante: **el paquete aporta el mecanismo, la app aporta la taxonomía**. La clase base `AppError` y el manejo de errores del servidor HTTP son genéricos; no conocen ni un solo código de error tuyo.

---

## 2. El `AppError` de la app

Este es el cimiento: **existe uno solo por proyecto** y todos los errores de dominio lo extienden. Es una subclase del `AppError` del paquete que sobrescribe dos métodos: los prefijos de módulo y la política de exposición de detalles.

```ts
// src/shared/domain/types/app-error.type.ts
import { AppError as BaseAppError } from '@jucodev/backend-core';
import { EnvVarsHelper } from '@/shared/domain/helpers/env.helper';

// Un prefijo numérico único por módulo. Ver §2.1.
export const PREFIX_ERRORS = {
  EXAMPLE: '1',
  AUTH: '2',
  USER: '3',
};

/**
 * AppError configurado de la app: los prefijos numéricos vienen de `PREFIX_ERRORS`,
 * y los detalles internos (`message`/`name`) solo se exponen fuera de producción.
 */
export class AppError extends BaseAppError {
  protected prefixErrors() {
    return PREFIX_ERRORS;
  }

  protected exposeInternals() {
    return EnvVarsHelper.getEnvVars().NODE_ENV !== 'production';
  }
}
```

> ⚠️ **Sobrescríbelos como métodos, nunca como propiedades flecha.** El constructor base llama a `prefixErrors()` antes de que se inicialicen los campos de tu subclase: `prefixErrors = () => PREFIX_ERRORS` compila y deja **todos** los errores como `UNKNOWN_ERROR.*`.

Qué te da la clase resultante:

| Miembro                                             | Para qué sirve                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `constructor(code, message, { httpStatus, cause })` | Construye el error. `httpStatus` por defecto: **500**                      |
| `error.getResponse()`                               | Serializa **este** error a la respuesta HTTP con su status                 |
| `AppError.getDefaultResponse()`                     | Serializa un error **no controlado**: status 500, código `000`             |
| `AppError.isAppError(value)`                        | Type guard: ¿es un `AppError`? Es lo que usa el servidor para decidir      |
| `error.name` (derivado)                             | `EXAMPLE_ERROR.NotFoundById` — resuelto solo, **nunca lo escribas a mano** |

Los dos métodos de serialización los llama el servidor HTTP del core (§5); tu código solo construye y lanza.

El `name` se deriva cruzando el prefijo del código contra `PREFIX_ERRORS` y usando `new.target.name` para el resto. Así, el código `1-001` en la clase `NotFoundById` produce `name: "EXAMPLE_ERROR.NotFoundById"`.

> Si no usas el paquete, `AppError` es replicable: una clase que extiende `Error`, guarda `code` y `httpStatus`, y expone `getResponse()`. Lo único no negociable es el contrato de salida JSON de §5.

### 2.1. Registrar el prefijo de un módulo

Cada módulo tiene un prefijo numérico único en `PREFIX_ERRORS`. Al crear un módulo, añade el siguiente número libre:

```ts
export const PREFIX_ERRORS = {
  EXAMPLE: '1',
  AUTH: '2',
  USER: '3',
  // MY_MODULE: '4',  ← el siguiente número libre
};
```

Los códigos resultantes serán `4-001`, `4-002`, etc.

**Nunca reutilices un prefijo ya asignado**, aunque borres el módulo: los códigos viejos siguen vivos en traducciones, logs y tickets de soporte.

> Si un código no encaja con ningún prefijo registrado, el `name` sale como `UNKNOWN_ERROR.*`. Es la señal de que olvidaste registrar el prefijo.

---

## 3. Definir y lanzar un error de dominio

Los errores viven en `src/<module>/domain/errors/<module>.error.ts`, agrupados en un namespace:

```ts
// src/example/domain/errors/example.error.ts
import { AppError, PREFIX_ERRORS } from '@/shared/domain/types/app-error.type';

export namespace ExampleError {
  export class NotFoundById extends AppError {
    constructor(message: string) {
      super(`${PREFIX_ERRORS.EXAMPLE}-001`, message, { httpStatus: 404 });
    }
  }

  export class NameAlreadyTaken extends AppError {
    constructor(message: string) {
      super(`${PREFIX_ERRORS.EXAMPLE}-002`, message, { httpStatus: 409 });
    }
  }
}
```

**Reglas:**

- Extiende siempre el `AppError` **de la app** (§2), nunca `Error` pelado ni el del paquete directamente (sin la clase intermedia no hay prefijos y el `name` sale `UNKNOWN_ERROR.*`).
- Código con formato `PREFIX-NNN`, secuencial, **sin reutilizar números**.
- El `httpStatus` se fija en el constructor de la clase, no en el handler.
- Agrupa los errores en un namespace `<Módulo>Error` — no exportes clases sueltas.
- Nada de excepciones del framework (`HTTPException` de Hono y equivalentes), ni siquiera para 401/403: crea una subclase de `AppError`. El servidor no las reconoce y las responde como un **500**, sea cual sea el status que llevaran.

### Lanzarlo

Lánzalo y ya — el servidor HTTP lo captura, lo loguea y lo responde:

```ts
// src/example/application/example.service.ts
throw new ExampleError.NotFoundById(`Not found example by id: ${id}`);
```

No pongas `try/catch` en los routers para errores de dominio: ya están capturados globalmente. Y los repositorios de infraestructura **nunca** lanzan errores de dominio; solo dejan burbujear los fallos inesperados de la base de datos.

Para envolver un fallo de bajo nivel conservando la traza, pasa `cause`:

```ts
try {
  await externalApi.charge(id);
} catch (cause) {
  throw new BillingError.ChargeFailed(`Charge failed for ${id}`, { cause });
}
```

**No loguees un error antes de lanzarlo**, ni lo captures solo para loguearlo: el servidor ya hace `logger.error(error)` con todo lo que se lanza, con el `traceId` de la request, y lo verías dos veces. El logger inyectado (`this.logger.error(error, 'mensaje')`) queda para los fallos que **no** vas a relanzar — y **nunca `console.log`**.

---

## 4. Errores que nacen dentro de una base reutilizable

Las bases genéricas del core (un `S3Storage`, un cliente de email…) también necesitan lanzar errores — pero **el paquete no conoce tus códigos de error**. Aporta la clase base `AppError`, no la taxonomía: si fijara él los códigos dejaría de ser reutilizable, porque cada proyecto tiene sus prefijos, sus statuses y su política de exposición.

La solución es invertir la dependencia: la base recibe **factorías de error** por constructor y las llama cuando algo falla. La subclase de tu app las rellena con sus propios `AppError`.

```ts
// src/shared/infra/storage/s3-storage.ts — la subclase de la app
@injectable()
export class S3Storage extends BaseS3Storage {
  constructor() {
    const env = EnvVarsHelper.getEnvVars();
    super({
      region: env.AWS_S3_REGION,
      bucket: env.AWS_S3_BUCKET_NAME,
      // El paquete llama a estas funciones; los códigos y statuses son tuyos.
      errors: {
        missingIdAfterUpload: (message) => new StorageError.MissingIdAfterUpload(message),
        notFoundById: (message) => new StorageError.NotFoundFileById(message),
      },
    });
  }
}
```

La taxonomía vive en la app, como la de cualquier otro módulo, con su propio prefijo:

```ts
// src/shared/application/core/errors/storage.error.ts
export namespace StorageError {
  export class MissingIdAfterUpload extends AppError {
    constructor(message: string) {
      super(`${PREFIX_ERRORS.STORAGE}-001`, message, { httpStatus: 500 });
    }
  }

  export class NotFoundFileById extends AppError {
    constructor(message: string) {
      super(`${PREFIX_ERRORS.STORAGE}-002`, message, { httpStatus: 404 });
    }
  }
}
```

> ⚠️ **Las factorías son opcionales, y ese es el peligro.** Si no las pasas, la base cae a un `new Error(message)` pelado. Un `Error` plano **no** es un `AppError`, así que el servidor lo trata como fallo no controlado: el cliente recibe `{"code":"000"}` con **status 500** en lugar del 404 que esperabas, y ninguna traducción encaja. Cuando subclasees una base del paquete, rellena **siempre** el objeto `errors` completo.

---

## 5. El servidor lo captura todo

Un único punto convierte cualquier excepción en respuesta HTTP, y la regla es siempre la misma:

> `AppError` → `error.getResponse()`. Cualquier otra cosa → `AppError.getDefaultResponse()`.

Si usas el `HttpServerService` del core, **ese punto ya existe y no se configura**: `createApp` no tiene opción `onError`. Por cada cosa que lanza un handler o un middleware, el servidor hace dos cosas:

1. La loguea con `logger.error(error)` a través del `LoggerService` bindeado, dentro del contexto de la request — la línea lleva el `traceId`.
2. La responde con la regla de arriba.

```ts
// src/app.ts — no hay nada de errores que declarar
return httpServer.createApp({
  // ...basePath, cors, routers, routes
});
```

| Qué ocurre                                         | Status          | Body                                        | ¿Se loguea? |
| -------------------------------------------------- | --------------- | ------------------------------------------- | ----------- |
| Se lanza una subclase de `AppError`                | su `httpStatus` | `{ code }` (+ detalles fuera de producción) | Sí          |
| Se lanza cualquier otra cosa (`Error`, un string…) | 500             | `{ "code": "000" }`                         | Sí          |
| La petición no encaja con ninguna ruta             | 404             | `{ "code": "000" }`                         | No          |

Tres cosas que se siguen de esto:

- **El servidor necesita el logger.** `HonoHttpServerService` inyecta `LoggerService`: sin ese binding, el contenedor falla al resolver el servidor HTTP.
- **Un `HTTPException` del framework es «cualquier otra cosa».** Sale como `{ "code": "000" }` con 500, sea cual sea el status que llevara. Por eso §3 exige subclases de `AppError` también para 401/403.
- **No registres un `app.onError` propio dentro de un router.** Sustituye al del servidor para las rutas de ese router y te quedas sin log y sin formato.

Así la taxonomía de errores se queda en la app y el servidor HTTP sigue siendo solo framework.

**Variante sin el core** — el mismo criterio contra el handler nativo del framework (aquí Hono). Aquí sí lo escribes tú, y el log también es cosa tuya:

```ts
app.onError((error) => {
  logger.error(error);

  return error instanceof AppError ? error.getResponse() : AppError.getDefaultResponse();
});
```

### El contrato de salida

La respuesta JSON varía según `exposeInternals()` (§2), típicamente `NODE_ENV !== 'production'`.

**Fuera de producción** — con detalles para debugging:

```json
{
  "code": "1-001",
  "message": "Not found example by id: 3f2c…",
  "name": "EXAMPLE_ERROR.NotFoundById"
}
```

**En producción** — solo el código, para no filtrar información interna:

```json
{ "code": "1-001" }
```

Los errores no controlados devuelven **status 500** con `{ "code": "000" }` a secas, en cualquier entorno: no llevan `message` ni `name`, porque no hay nada útil que exponer — el detalle está en el log. Una ruta inexistente devuelve ese mismo body con **status 404**.

> Las respuestas de error **conservan la cabecera `X-Trace-Id`**. Es el puente entre el toast que ve el usuario y la línea de log del servidor: pide al usuario ese id, o loguéalo en el cliente, y encuentras la request exacta.

---

## 6. El lado cliente: `HttpError` + `fetcher`

Dos archivos por app cliente. Si tienes varias apps, son copias idénticas (no hay paquete compartido de frontend).

### `HttpError`

Un `Error` enriquecido con lo que devolvió la API. Es el tipo que verá toda la capa de UI:

```ts
// modules/shared/errors/http-error.ts
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

### `fetcher`

El único sitio del cliente que habla con la red. Es **agnóstico**: acepta el `RequestInit` nativo y
**devuelve la `Response`** —deserializar es cosa de quien llama—. Lo único que se reserva es
resolver la URL base, mandar credenciales y **normalizar todo fallo a `HttpError`**:

```ts
// modules/shared/services/fetcher.ts
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
      errorCode: body.code, // "1-001" — siempre presente si respondió la API
      errorName: body.name, // undefined en producción
      httpStatus: response.status,
    });
  }

  return response;
}
```

Y así lo consume una función de la capa `api/` de un módulo:

```ts
// modules/example/api/example.api.ts
export async function getExampleDetails(id: string): Promise<{ example: Example }> {
  const res = await fetcher(`${API_ROUTES.EXAMPLES}/${id}`);
  return res.json() as Promise<{ example: Example }>;
}
```

Ni un `try/catch` ni un `if (!res.ok)` en toda la capa `api/`: si el `fetcher` devolvió, la respuesta
es buena. Un `204` no tiene body, así que quien llama simplemente no invoca `.json()`.

Tres matices que importan:

- **`body.message` es `undefined` en producción** (la API solo devuelve `code`). `HttpError` cae entonces a `response.statusText` (`"Conflict"`, `"Not Found"`…). Feo, pero solo se ve si falta la entrada en el diccionario.
- **`errorCode` es lo único fiable.** Es la clave con la que se busca el mensaje del usuario.
- **Los fallos de red no tienen `errorCode`.** Si el `fetch` revienta (sin conexión, CORS, DNS), sale un `HttpError('Network error')` sin código. Ese mensaje se muestra crudo: no intentes traducirlo por código, no lo tiene.

---

## 7. El diccionario `código → texto`

El cliente traduce el `errorCode` a un texto para el usuario. La fuente depende del proyecto, pero **su forma es siempre la misma**: `Record<string, string>`, clave = código (`"1-001"`), valor = mensaje. Todo lo que viene después (§8) solo consume esa forma, así que el resto de la cadena no cambia.

### Proyecto **con** i18n

Los mensajes viven en una sección `errors` de cada locale, y se leen del proveedor de i18n (aquí `next-intl` — ver [`i18n-guide.md`](./i18n-guide.md)):

```jsonc
// locales/es.json
{ "errors": { "1-001": "No encontramos ese elemento." } }

// locales/en.json
{ "errors": { "1-001": "We couldn't find that item." } }
```

```ts
import { useMessages } from 'next-intl';

const messages = useMessages();
const errorMessages = (messages.errors ?? {}) as Record<string, string>;
```

Añade la clave en **todos** los locales. Si falta en uno no hay error de compilación: se cuela el `message` crudo de la API.

### Proyecto **sin** i18n

Una constante. Mismo contrato, cero dependencias:

```ts
// modules/shared/constants/error-messages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  '1-001': 'No encontramos ese elemento.',
  '1-002': 'Ese nombre ya está en uso.',
};
```

```ts
const errorMessages = ERROR_MESSAGES;
```

> Con `Record<string, string>` TypeScript no valida qué códigos existen. Si quieres que te avise al añadir un error nuevo, tipa las claves con una unión (`type ErrorCode = '1-001' | '1-002'`) y declara la constante como `Record<ErrorCode, string>`. Es opcional, pero convierte un olvido silencioso en un error de compilación.

**En ambos casos el resto es idéntico.** Lo único que cambia es de dónde sale `errorMessages`.

---

## 8. Mostrar el error: el `QueryClientProvider`

Un solo componente engancha `queryCache.onError` y `mutationCache.onError`, así que **ningún `useQuery`/`useMutation` necesita manejar el error para que el usuario lo vea**.

```tsx
// modules/shared/providers/QueryClientProvider/QueryClientProvider.component.tsx
'use client';

import { useMemo } from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider as TanstackProvider,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { HttpError } from '#/shared/errors/http-error';
// CON i18n:  import { useMessages } from 'next-intl';
// SIN i18n:  import { ERROR_MESSAGES } from '#/shared/constants/error-messages';

export function QueryClientProvider({ children }: { children: React.ReactNode }) {
  // CON i18n:
  const messages = useMessages();
  const errorMessages = (messages.errors ?? {}) as Record<string, string>;
  // SIN i18n:
  // const errorMessages = ERROR_MESSAGES;

  // Único punto que conoce el diccionario.
  const resolveMessage = (error: unknown): string => {
    if (error instanceof HttpError && error.errorCode) {
      return errorMessages[error.errorCode] ?? error.message;
    }
    return error instanceof Error ? error.message : 'Error inesperado';
  };

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            // Sesión caducada: el guard de auth redirige al login, no llenamos de toasts.
            if (error instanceof HttpError && error.httpStatus === 401) return;
            toast.error(resolveMessage(error));
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Los forms que pintan su propio error inline renuncian al toast global.
            if (mutation.meta?.skipGlobalErrorToast) return;
            toast.error(resolveMessage(error));
          },
        }),
      }),
    [],
  );

  return <TanstackProvider client={queryClient}>{children}</TanstackProvider>;
}
```

Se monta **una sola vez**, envolviendo el árbol de la app (en Next.js App Router, en el `layout.tsx` raíz), junto al `<Toaster />` de la librería de toasts:

```tsx
<QueryClientProvider>
  {children}
  <Toaster position="top-right" richColors />
</QueryClientProvider>
```

### Las decisiones de diseño, explicadas

**`queryCache` y `mutationCache`, no `defaultOptions`.** En TanStack Query v5 las queries **no tienen `onError` a nivel de hook** (se eliminó), así que `queryCache.onError` es el único enganche global posible. En mutations sí existe `onError` por hook, pero un `defaultOptions.mutations.onError` quedaría **sobrescrito** por el del hook; `mutationCache.onError`, en cambio, se dispara siempre, **además** del handler del hook. Es justo lo que queremos: un comportamiento global que los hooks complementen, no reemplacen.

**Los 401 en queries no muestran toast.** Una sesión caducada no debe llenar la pantalla de toasts mientras se redirige al login. Aplica solo a **queries**: un 401 al enviar un formulario sí avisa, porque ahí el usuario está esperando una respuesta.

**Las mutations pueden renunciar al toast global** cuando el formulario ya muestra el error bajo el campo:

```ts
useMutation({
  mutationFn: createExample,
  meta: { skipGlobalErrorToast: true },
});
```

Úsalo cuando duplicar el mensaje (toast + inline) sería ruido. Si no lo pones, el toast sale siempre. `meta` es un `Record<string, unknown>` libre; para tiparlo, amplía la interfaz `Register` de TanStack Query:

```ts
// modules/shared/types/tanstack-query.d.ts
import '@tanstack/react-query';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { skipGlobalErrorToast?: boolean };
  }
}
```

**El `useMemo` con deps vacías** crea el `QueryClient` una sola vez: recrearlo en cada render tiraría toda la caché. Como consecuencia, `resolveMessage` captura el `errorMessages` del **primer render**. Con `next-intl` en App Router no es problema (cambiar de idioma recarga y remonta el layout — ver [`i18n-guide.md`](./i18n-guide.md)), pero si tu app cambia el idioma **sin** remontar, guarda el diccionario en un `useRef` y léelo dentro del handler.

**Fallbacks encadenados.** El mensaje que ve el usuario es, en orden: entrada del diccionario para ese código → `message` de la API (solo fuera de producción) → `statusText` HTTP → `'Error inesperado'`. Nunca hay un toast vacío.

> Añade al diccionario solo los códigos que el usuario puede provocar **y entender**. Un `000` (error inesperado) o un fallo interno no necesitan un mensaje bonito: necesitan un log y el `X-Trace-Id`.

### Variante sin TanStack Query

El patrón no depende de TanStack: lo único imprescindible es que **un solo punto** convierta `HttpError` → texto. Extrae `resolveMessage` a su propio módulo y llámalo desde donde captures el error:

```ts
// modules/shared/helpers/resolve-error-message.ts
import { HttpError } from '#/shared/errors/http-error';
import { ERROR_MESSAGES } from '#/shared/constants/error-messages';

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof HttpError && error.errorCode) {
    return ERROR_MESSAGES[error.errorCode] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Error inesperado';
}
```

```ts
try {
  await createExample(data);
} catch (error) {
  toast.error(resolveErrorMessage(error));
}
```

---

## Resumen de responsabilidades

| Capa                                    | Responsabilidad                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Core reutilizable (`backend-core`)      | Aporta el **mecanismo**: la clase `AppError`, el servidor que loguea y serializa, factorías de error |
| `shared/domain/types/app-error.type.ts` | Configura el `AppError` de la app (sobrescribe `prefixErrors()`, `exposeInternals()`)                |
| `domain/errors/`                        | Define la clase, el código (`PREFIX-NNN`) y el status HTTP                                           |
| `shared/infra/` (subclases del core)    | Rellena las factorías de error de las bases (`S3Storage`…)                                           |
| `application/` o `presentation/`        | Lanza el error                                                                                       |
| Servidor HTTP del core                  | Loguea el error y lo serializa a JSON con el status correcto                                         |
| `http-error.ts` + `fetcher.ts`          | Deserializan la respuesta y lanzan `HttpError` con `errorCode`                                       |
| `QueryClientProvider`                   | Busca el mensaje por código y muestra el toast                                                       |
| `locales/*.json` **o** `ERROR_MESSAGES` | Diccionario `código → texto` (con i18n o sin él)                                                     |

## Checklist: montar el manejo de errores en un proyecto nuevo

- [ ] `shared/domain/types/app-error.type.ts`: subclase del `AppError` del paquete que sobrescribe `prefixErrors()` y `exposeInternals()` como métodos (§2).
- [ ] `LoggerService` bindeado en el contenedor: el servidor HTTP lo inyecta para loguear los errores (§5). No hay `onError` que enganchar.
- [ ] `http-error.ts` y `fetcher.ts` en cada app cliente (§6).
- [ ] Diccionario `código → texto`: sección `errors` en los locales, o constante `ERROR_MESSAGES` (§7).
- [ ] `QueryClientProvider` (o el `resolveErrorMessage` equivalente) montado en el layout raíz, junto al `<Toaster />` (§8).

## Checklist: añadir un error nuevo

- [ ] Clase en `domain/errors/<module>.error.ts`, dentro del namespace, con código secuencial y `httpStatus`.
- [ ] Prefijo del módulo registrado en `PREFIX_ERRORS` (solo la primera vez).
- [ ] Lanzado desde el service o el use case — **nunca** desde el repositorio.
- [ ] Si lo lanza una base del core, la factoría correspondiente está rellenada en la subclase de `shared/infra/` (§4).
- [ ] Mensaje añadido al diccionario de cada app cliente que pueda recibirlo: en **todos** los `locales/*.json` si hay i18n, o en `ERROR_MESSAGES` si no.
- [ ] Si el formulario pinta el error inline, la mutation lleva `meta: { skipGlobalErrorToast: true }`.
