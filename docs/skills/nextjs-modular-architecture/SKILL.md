---
name: nextjs-modular-architecture
description: >-
  Aplica esta skill SIEMPRE que se trabaje en un proyecto frontend con Next.js (App Router) —
  incluso si el usuario no la menciona explícitamente. Dispara al: crear o revisar la estructura
  de carpetas; decidir dónde colocar un componente, hook, tipo, store, constante o esquema;
  montar una ruta del App Router (page, layout, route group, loading/error, middleware/proxy);
  organizar el código por features/módulos; escribir data fetching (fetch, useQuery, useMutation,
  query keys); crear formularios con validación; definir tipos de entidad; configurar aliases de
  imports, i18n, theming o variables de entorno; arrancar un proyecto Next.js desde cero; o cuando
  se quiera comprobar si un archivo sigue la arquitectura establecida. Es la guía de referencia de
  arquitectura modular por dominio para cualquier app Next.js con React, TypeScript, Tailwind,
  shadcn/ui, TanStack Query, react-hook-form, Zod y Zustand.
---

# Arquitectura modular por dominio para Next.js — Patrones y convenciones

Guía **agnóstica al proyecto** para construir y organizar aplicaciones Next.js (App Router) con una
arquitectura **modular orientada al dominio**. Describe patrones, no una implementación concreta.
Todos los ejemplos usan entidades genéricas (`users`, `products`, `orders`, `todos`).

> **Principio rector:** el App Router solo define rutas; **toda la lógica de negocio vive en
> `modules/`**, agrupada por feature. La cohesión conceptual manda: si algo encaja en un módulo
> existente, va ahí; no se crean módulos por tipo técnico (`components/`, `hooks/` globales), sino
> por dominio (`user/`, `product/`, `billing/`).

Este archivo es el **mapa** (siempre en contexto). El detalle y los ejemplos de código de cada tema
viven en `references/` y se leen **solo cuando hacen falta** — ver el índice al final (§6).

---

## 1. Stack y regla de oro del estado

| Capa | Elección por defecto | Por qué |
| --- | --- | --- |
| Framework | Next.js **App Router** (Server Components por defecto) | Streaming, layouts anidados, RSC. Client Components solo cuando hay interactividad. |
| Lenguaje | TypeScript **strict** | Errores en compilación, contratos explícitos. |
| Estilado | **Tailwind CSS** (v4, config CSS-first en `globals.css`) | Utilidades consistentes, theming por tokens. |
| Componentes UI | **shadcn/ui** sobre primitivas headless | Componentes propios, editables, en tu repo. |
| Estado servidor | **TanStack Query** | Caché, revalidación, invalidación y estados de carga/error. |
| Formularios | **react-hook-form + Zod** | Validación declarativa, un solo origen de verdad. |
| Estado cliente global | **Zustand** (último recurso) | Ligero. Solo para estado global genuino. |
| Iconos | Una sola librería (p. ej. `lucide-react`) | Consistencia; no mezclar sets. |

**Regla de oro del estado — elige el mecanismo menos potente que resuelva el problema:**

1. `useState` local → 2. `searchParams` (filtros, paginación, pestañas: compartibles por URL) →
3. **TanStack Query** (cualquier dato del servidor) → 4. **Zustand** (solo estado global de UI que
de verdad no cabe en los anteriores).

Subir de nivel sin necesidad crea fuentes de verdad duplicadas y bugs de sincronización. El estado
del servidor **nunca** va en Zustand ni en `useState`; es de TanStack Query.

---

## 2. Árbol de carpetas de referencia

> **La raíz es siempre la de la app Next.js**, esté sola (standalone) o dentro de un monorepo
> (`apps/<app>/`). Todo lo que sigue cuelga de esa raíz, no de la raíz del monorepo. Los patrones y
> aliases son idénticos; en monorepo la única diferencia es que el `tsconfig.json` de la app extiende
> un `tsconfig.base.json` compartido.

El árbol es el **caso por defecto: sin internacionalización**. La i18n con segmento `[locale]` es
**opcional** — solo si la app es multi-idioma (ver `references/routing-and-i18n.md`).

```
<raíz de la app Next.js>           # standalone, o apps/<app>/ dentro de un monorepo
├── app/                           # App Router — SOLO rutas (thin wrappers)
│   ├── globals.css                # Tailwind + tokens de tema (@theme)
│   ├── layout.tsx                 # Layout raíz: providers, fuentes, <html>
│   ├── (auth)/                    # Route group público (login, registro…)
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (app)/                     # Route group protegido
│   │   ├── layout.tsx             # Guard de sesión server-side + shell
│   │   └── dashboard/page.tsx
│   └── favicon.ico
│   # ↑ Si HAY i18n: envuelve (auth)/(app)/layout raíz bajo app/[locale]/
├── modules/                       # TODA la lógica de negocio, por feature
│   ├── <feature>/                 # p. ej. user, product, billing
│   │   ├── api/                   # Funciones de red (usan `fetcher`, nunca fetch crudo)
│   │   ├── queries/
│   │   │   ├── keys/              # Query key factories (`*.keys.ts`)
│   │   │   └── hooks/             # useQuery / useMutation (`use*Query.ts`, `use*Mutation.ts`)
│   │   ├── components/            # Componentes UI (una carpeta por componente)
│   │   ├── pages/                 # Page components (uno por ruta)
│   │   ├── layouts/               # Layouts propios del módulo (shells)
│   │   ├── hooks/                 # Custom hooks del módulo (`use*.hook.ts`)
│   │   ├── stores/                # Zustand (`*.store.ts`) — solo si hace falta
│   │   ├── providers/             # Context providers del módulo
│   │   ├── types.ts               # Entidades, enums, tipos del dominio
│   │   ├── const.ts               # Constantes del módulo (opcional)
│   │   └── helpers.ts             # Utilidades puras del módulo (opcional)
│   └── shared/                    # Transversal (solo si lo usan 2+ módulos)
│       ├── services/              # fetcher, server-fetcher, logger, etc.
│       ├── components/            # UI reutilizable entre módulos
│       ├── constants/             # api-routes, app-routes, cookies, error-messages…
│       ├── errors/                # HttpError y afines
│       ├── helpers/               # cn(), env.helper, url.helper, formatters
│       ├── hooks/                 # hooks compartidos
│       ├── layouts/               # layouts compartidos
│       ├── providers/             # QueryClientProvider, etc.
│       └── types/                 # Entity, PaginationParams/Result…
├── components/ui/                 # Primitivas shadcn instaladas por CLI
├── lib/                           # Clientes a nivel de app (auth client, sdk…)
├── proxy.ts                       # (opcional) guard de rutas [+ locale si hay i18n]
│                                  #   Next 16+: proxy.ts · Next ≤15: middleware.ts
├── locales/                       # SOLO si hay i18n: en.json, es.json, request config
├── components.json                # Config de shadcn
├── next.config.ts
└── tsconfig.json                  # standalone; en monorepo extiende un tsconfig.base.json
```

**Por qué esta separación:** `app/` cambia con las URLs; `modules/` cambia con el negocio. Al
mantenerlos aparte reorganizas rutas sin tocar lógica, y mover un feature es copiar una carpeta.

---

## 3. Aliases de imports

Define **dos aliases** en el `tsconfig.json` de la app (relativos a la raíz de la app; en monorepo,
extiende además el `tsconfig.base.json` compartido):

```jsonc
{
  // "extends": "../../tsconfig.base.json",  // ← solo en monorepo
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"],            // raíz de la app (components/ui, lib, app)
      "#/*": ["./modules/*"]      // atajo a los módulos de negocio
    }
  }
}
```

```typescript
import { fetcher } from '#/shared/services/fetcher';        // ✅ estable
import { Button } from '@/components/ui/button';            // ✅ estable
import { fetcher } from '../../../shared/services/fetcher'; // ❌ se rompe al mover el archivo
```

Los `../../../` acoplan el archivo a su ubicación. Con `#/` y `@/` mueves módulos sin reescribir
imports y el origen de cada símbolo se lee de un vistazo.

---

## 4. Anatomía de un módulo (feature)

Cada módulo es autocontenido y expone su superficie a través de barrels (`index.ts` con `export *`):

```
modules/product/
├── api/product.api.ts                    # red
├── queries/keys/product.keys.ts          # query keys
├── queries/hooks/useProductsQuery.ts     # useQuery
├── queries/hooks/useCreateProductMutation.ts
├── components/ProductCard/…               # UI
├── pages/ProductsPage/…                   # page component
├── hooks/useProductFilters.hook.ts        # lógica de UI/negocio del módulo
├── stores/product.store.ts                # (opcional) estado global
├── types.ts                               # entidades y enums
└── helpers.ts                             # utilidades puras
```

**Fronteras entre módulos (críticas):**

- Un módulo **nunca** importa de la carpeta `api/` de otro. Si necesita datos de otro dominio, usa
  el **hook de query** que ese módulo expone. Así el acoplamiento vive en la interfaz pública, no en
  los detalles internos.
- Lo que usan **2+ módulos** sube a `modules/shared/`. Lo específico de un dominio **nunca** va a
  `shared/`.
- Antes de crear un módulo nuevo, revisa los existentes: si encaja en uno, úsalo.

---

## 5. Convenciones de nombres (referencia rápida)

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Carpeta de módulo | kebab/singular por dominio | `product/`, `user/` |
| Carpeta de componente | PascalCase | `ProductCard/` |
| Componente | `[Name].component.tsx` | `ProductCard.component.tsx` |
| Page component | `[Feature]Page` | `ProductsPage`, `ProductDetailPage` |
| Tipos de props | `[Name].type.ts` | `ProductCard.type.ts` |
| Schema de form | `[Name].schema.ts` (`formSchema`) | `ProductForm.schema.ts` |
| Función de red | `get[Entities]` / `get[Entity]Details` / `create·update·delete[Entity]` | `getProducts`, `getProductDetails` |
| Query hook | `use[Entity]Query.ts` · `use[Entity]DetailsQuery.ts` | `useProductsQuery.ts` |
| Mutation hook | `use[Create\|Update\|Delete][Entity]Mutation.ts` | `useCreateProductMutation.ts` |
| Query keys | `[entity].keys.ts` (`entityKeys`) | `product.keys.ts` |
| Custom hook | `use[Name].hook.ts` (carpeta propia si crece) | `useProductFilters.hook.ts` |
| Store | `[domain].store.ts` (`use[Domain]Store`) | `product.store.ts` |
| Barrel | `index.ts` (solo `export *`) | |

**Named exports** siempre, nunca `export default`. **Código, nombres y rutas en inglés**
(`/settings`, no `/configuracion`), aunque el texto de UI esté traducido. Los `index.ts` solo
re-exportan, nunca contienen lógica.

---

## 6. Índice de referencias — lee el archivo que aplique a tu tarea

Consulta el archivo correspondiente **solo cuando estés trabajando en ese tema**. Cada uno contiene
las reglas detalladas, ejemplos ✅/❌ y el "por qué".

| Si vas a… | Lee |
| --- | --- |
| Escribir (o revisar) la capa de red de `shared/`: `HttpError`, `env.helper`, `fetcher`, `server-fetcher` — **código completo listo para copiar** | **`references/shared-foundations.md`** |
| Definir `Entity`/`OnlyProps`, la paginación (`PaginationParams`/`PaginationResult`) o el `url.helper` | **`references/shared-types.md`** |
| Montar el manejo global de errores: `QueryClientProvider` + diccionario `errorCode → mensaje` | **`references/error-toast-provider.md`** |
| Montar rutas del App Router, layouts, route groups, server vs client, el proxy/middleware, o añadir i18n | **`references/routing-and-i18n.md`** |
| Escribir data fetching: funciones `api/`, query keys, `useQuery`/`useMutation`, invalidación, manejo de errores (`fetcher`/`HttpError`), fetching server-side | **`references/data-layer.md`** |
| Crear componentes UI, page components, custom hooks o formularios (react-hook-form + Zod) | **`references/components-hooks-forms.md`** |
| Definir tipos de entidad/enums o estado global con Zustand | **`references/types-and-state.md`** |
| Centralizar constantes, aplicar theming/design system (Tailwind + shadcn) o validar variables de entorno | **`references/conventions.md`** |
| Arrancar un proyecto desde cero, o seguir el checklist al añadir una feature | **`references/getting-started.md`** |

**Regla anti-antipatrones (aplica siempre, sin necesidad de abrir referencias):** nada de `fetch`
crudo (usa `fetcher`), `any` (usa `unknown`), query keys inline, estilos inline, lógica de negocio
en `app/`, ni caché de servidor en Zustand/`useState`.
