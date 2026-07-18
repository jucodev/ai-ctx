# Constantes, estilado/design system y variables de entorno

## 1. Constantes centralizadas

Nada de "magic strings". Rutas, endpoints, cookies, headers, search params y mensajes viven en
`shared/constants/`, organizados por responsabilidad:

| Archivo | Contenido |
| --- | --- |
| `api-routes.ts` | Prefijos de endpoints del backend (`API_ROUTES`) — solo prefijos, el segmento se concatena en la función `api/` |
| `app-routes.ts` | Rutas del frontend (`APP_ROUTES`) |
| `cookies.ts` | Nombres de cookies |
| `form-messages.ts` | Mensajes de validación reutilizables (`FORM_VALIDATION_MSG`) |
| `error-messages.ts` | Mapa `errorCode → mensaje` para el toast global (`ERROR_MESSAGES`). Con i18n, el diccionario vive en los locales bajo la clave `errors` |
| `search-params.ts` | Nombres de URL search params |

```typescript
const url = `${API_ROUTES.PRODUCTS}/${id}`;  // ✅ siempre referencia la constante
const url = `/api/products/${id}`;            // ❌ nunca hardcodees el path
```

**Por qué importa:** un cambio de ruta o de mensaje es una edición en un único sitio, y el
autocompletado evita typos que romperían en runtime.

---

## 2. Estilado y design system

- **Tailwind v4 con config CSS-first**: los tokens de tema se declaran en `globals.css` dentro de un
  bloque `@theme`. Ese archivo es la **fuente de verdad** de los tokens; no inventes nombres.
- **Dos capas de color**: tokens semánticos de shadcn (`bg-background`, `text-foreground`,
  `text-muted-foreground`, `bg-card`, `border-border`, `bg-destructive`…) que se adaptan a
  light/dark automáticamente — **prefiérelos** para estilado de componentes; y escalas de marca
  (`brand-50…900`) para expresión explícita de marca (heros, badges).
- **shadcn/ui** para todo componente: instala por CLI (`npx shadcn@latest add <component>`) y quedan
  en `components/ui/`, editables como código propio. Antes de crear UI a mano, busca en el registry.
  Si un componente no existe, créalo en `components/ui/` siguiendo las convenciones de shadcn
  (variantes con `cva`, helper `cn()`, primitiva headless cuando aplique).
- **`cn()`** (`clsx` + `tailwind-merge`) para combinar clases y resolver conflictos de Tailwind. Vive
  en `shared/helpers/styles.ts` y se importa como `#/shared/helpers/styles`. Ojo: el CLI de shadcn
  genera su propio `cn()` en `lib/utils.ts` al inicializar — no dejes las dos copias vivas: haz que
  `lib/utils.ts` re-exporte la de `shared/helpers/styles` (o apunta el alias `utils` de
  `components.json` ahí) para que haya **una sola** implementación.
- **Una sola librería de iconos**; nombres verificados antes de usarlos.
- Nunca HTML crudo si existe el equivalente shadcn; nunca estilos inline.

```tsx
// ✅ tokens semánticos + cn() para clases condicionales
<button className={cn('bg-primary text-primary-foreground px-4 py-2 rounded-md', disabled && 'opacity-50')}>
```

---

## 3. Variables de entorno validadas al arranque

Valida el entorno con Zod en un único helper y **falla rápido** si falta algo. Nunca leas
`process.env.X` disperso por el código.

```typescript
// ✅ shared/helpers/env.helper.ts
import { z } from 'zod';

export const envVariablesSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ANALYTICS_KEY: z.string().min(1).optional(),
});

export type EnvVariables = z.infer<typeof envVariablesSchema>;

// Claves enumeradas LITERALMENTE: Next sustituye `process.env.NEXT_PUBLIC_*` por reemplazo
// textual en build, así que pasar `process.env` entero deja `undefined` en el bundle cliente.
export const ENV: EnvVariables = envVariablesSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ANALYTICS_KEY: process.env.NEXT_PUBLIC_ANALYTICS_KEY,
});
```

El **layout raíz** valida el entorno completo en el arranque (ahí sí vale `process.env`, es
servidor):

```tsx
// ✅ app/layout.tsx
import { envVariablesSchema } from '#/shared/helpers/env.helper';

envVariablesSchema.parse(process.env);
```

**Reglas:** cada variable nueva se añade al schema **y** a `.env.example` (con valor de ejemplo,
nunca real). Prefijo `NEXT_PUBLIC_*` → disponible en cliente y servidor; sin prefijo → solo servidor.
Consume siempre `ENV.X`, tipado y validado, no `process.env.X`.

**Por qué importa:** un despliegue con una env mal puesta revienta en el arranque con un mensaje
claro, no con un bug silencioso en producción tres pantallas más adentro.
