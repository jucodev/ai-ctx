# El toast global de errores: `QueryClientProvider`

El último eslabón de la cadena de errores: convierte cada `HttpError` en un toast localizado, en un
solo sitio, sin un `try/catch` en toda la UI.

> Asume el `fetcher` y el `HttpError` de `references/shared-foundations.md`. Si el proyecto tiene
> instalada la guía `error-handling.md`, ahí está la cadena completa de extremo a extremo
> (excepción de dominio en el backend → código de error → toast).

---


El último eslabón: convierte cada `HttpError` en un toast localizado, en un solo sitio.

```tsx
// ✅ modules/shared/providers/QueryClientProvider/QueryClientProvider.component.tsx
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
import { ERROR_MESSAGES } from '#/shared/constants/error-messages';

function resolveMessage(error: unknown): string {
  if (error instanceof HttpError && error.errorCode) {
    return ERROR_MESSAGES[error.errorCode] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Error inesperado';
}

export function QueryClientProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            // 401 lo maneja el guard de rutas — no molestes con un toast.
            if (error instanceof HttpError && error.httpStatus === 401) return;
            toast.error(resolveMessage(error));
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Los formularios que muestran su error inline optan por saltarse el toast global.
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

```typescript
// ✅ modules/shared/constants/error-messages.ts
// Clave = código opaco del backend: `<prefijo de módulo>-<correlativo>`.
export const ERROR_MESSAGES: Record<string, string> = {
  '2-003': 'Ya existe una cuenta con ese email.',
  '2-004': 'No hemos podido crear la cuenta.',
  '4-010': 'Esa persona ya forma parte del equipo.',
};
```

> El `staleTime: 60_000` es el **default global**: los hooks de query lo omiten y solo lo
> sobreescriben en casos concretos (`Infinity` para datos estáticos, `0` para datos que deben
> refetchear en cada mount).

### El diccionario se indexa por **código**, no por nombre de error

Esto es lo que hace que el sistema funcione y suele malentenderse. El backend define sus errores con
un prefijo por módulo y un correlativo:

```typescript
// backend — cada error de dominio nace con su código
export class EmailAlreadyInUse extends AppError {
  constructor(message = 'Email already in use') {
    super(`${PREFIX}-003`, message, { httpStatus: 409 }); // → "2-003"
  }
}
```

**Por qué un código opaco y no `USER_ALREADY_EXISTS`:**

- **En producción el `message` no es de fiar.** Los mensajes del backend son internos, están en
  inglés y —según el entorno— pueden venir genéricos o saneados para no filtrar detalles de
  implementación (nombres de tabla, existencia de una cuenta, motivos de rechazo). El código es lo
  **único** que la API garantiza como contrato público.
- **Un identificador sin semántica no filtra información.** `2-003` viajando en una respuesta o en un
  log no le dice nada a quien esté mirando; `USER_ALREADY_EXISTS` sí.
- **Es estable frente a refactors.** Renombrar la clase `EmailAlreadyInUse` no cambia `2-003`, así
  que no rompe traducciones ni obliga a tocar el frontend.
- **El prefijo agrupa por módulo** (`2-*` auth, `4-*` organización…), lo que hace evidente de dónde
  viene un error al leer un log y evita colisiones cuando dos dominios tienen errores parecidos.

Consecuencias prácticas:

- **El mensaje se resuelve en cascada:** entrada del diccionario para ese código → `message` de la
  API → `'Error inesperado'`. Así nunca hay un toast vacío, y si falta una clave el hueco se nota
  (sale texto crudo) en vez de esconderse tras un genérico. Ojo: en producción la API solo devuelve
  `code`, así que ese `message` será el `statusText` HTTP — motivo de más para tener el diccionario
  completo.
- **Nunca uses `errorName` para elegir el texto** — es depuración, y acopla la UI a los nombres de
  clase del backend.
- **Los fallos de red no tienen `errorCode`**: su `message` (`'Network error'`) se muestra tal cual,
  no intentes traducirlo por código.
- **Cada error nuevo del backend necesita su entrada en el diccionario**, o el usuario verá el
  genérico. Merece la pena revisar que los códigos del backend y las claves del diccionario no se
  desincronicen.
- Si ramificas por un error concreto (p. ej. marcar un campo del formulario), compara **el código**:
  `if (error.errorCode === '2-003') form.setError('email', …)`.

**Puntos que importan:**

- **`useMemo` con deps vacías**, no un `new QueryClient()` en el cuerpo del componente: un re-render
  crearía un cliente nuevo y tiraría toda la caché.
- **`queryCache` y `mutationCache` por separado.** Solo las mutaciones tienen `meta` accesible en
  `onError`, y es lo que permite el opt-out por formulario (`useMutation({ meta: {
  skipGlobalErrorToast: true } })`).
- **El 401 se silencia en queries.** Al expirar la sesión revalidan varias queries a la vez; sin este
  early return el usuario vería cinco toasts idénticos justo antes del redirect.
- Si la app usa i18n, el diccionario sale del sistema de traducción (p. ej. `useMessages().errors`)
  en vez de una constante — la forma `errorCode → mensaje` no cambia, y las claves de los archivos de
  locale son literalmente los códigos:

  ```jsonc
  // locales/es.json
  { "errors": { "2-003": "Ya existe una cuenta con ese email.", "4-010": "…" } }
  ```

**Resultado:** ningún componente ni función `api/` lleva `try/catch`. El flujo completo es
`fetcher → HttpError → provider → toast`, y añadir un error nuevo del backend es **una línea en el
diccionario**, no un cambio de código.
