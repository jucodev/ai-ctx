---
title: Internacionalización con next-intl
description: i18n en Next.js (App Router) con URLs prefijadas por idioma y detección por Accept-Language. Úsala al montar i18n desde cero o al añadir un idioma o una clave.
---

# Internacionalización con next-intl (Next.js App Router)

> **Cuándo usar esta guía:** al montar i18n en un proyecto Next.js (App Router) desde cero, o al añadir un idioma / una clave a uno existente. Es **agnóstica del negocio**: describe el patrón completo con URLs prefijadas por idioma (`/es/...`, `/en/...`) y detección automática por `Accept-Language`.

Todo el código es copiable tal cual. El diccionario de **mensajes de error de la API** vive también aquí (§4.1) — ver [`error-handling.md`](./error-handling.md).

---

## 0. Qué asume esta guía

| Pieza     | Versión / decisión                                                                         |
| --------- | ------------------------------------------------------------------------------------------ |
| Next.js   | App Router. **v16+** usa `proxy.ts`; en v15 el mismo archivo se llama `middleware.ts` (§8) |
| next-intl | v4 — el locale se resuelve desde el **segmento `[locale]` de la URL**                      |
| Routing   | URLs **siempre prefijadas** (`/es/…`, `/en/…`). Sin prefijo → redirect                     |

**Convención de rutas:** `#/*` → `modules/*`. Adáptala a tu proyecto.

### Stack

```bash
npm install next-intl @formatjs/intl-localematcher negotiator
npm install -D @types/negotiator
```

- **next-intl** — provider de i18n para Next.js.
- **@formatjs/intl-localematcher** — negocia el mejor idioma entre lo que pide el usuario y lo que soportas.
- **negotiator** — parsea el header `Accept-Language`.

---

## 1. Estructura de ficheros

```
app/
  [locale]/
    layout.tsx              # <html lang>, NextIntlClientProvider, validación del locale
    page.tsx
locales/
  es.json                   # Traducciones
  en.json
  request.ts                # Config de next-intl (server): qué locale y qué mensajes cargar
modules/shared/
  types/locale.type.ts      # Locales soportados
  helpers/locale.ts         # Detección y validación
  hooks/useLocale.hook.ts   # Hook para Client Components
proxy.ts                    # (Next 15: middleware.ts) redirect + propagación del locale
next.config.ts              # Plugin de next-intl
global.d.ts                 # Tipado de las claves (opcional)
```

---

## 2. Locales soportados

Una sola fuente de verdad. Todo lo demás la deriva:

```ts
// modules/shared/types/locale.type.ts
export enum Locale {
  es = 'es',
  en = 'en',
}

export const SUPPORTED_LOCALES: Locale[] = [Locale.es, Locale.en];
```

---

## 3. Detección y validación del locale

```ts
// modules/shared/helpers/locale.ts
import type { NextRequest } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { Locale, SUPPORTED_LOCALES } from '#/shared/types/locale.type';

export const DEFAULT_LOCALE = Locale.es;

/** Mejor idioma soportado según el header `Accept-Language` del usuario. */
export function getLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language') || '';

  const languages = new Negotiator({
    headers: { 'accept-language': header },
  }).languages();

  try {
    return match(languages, SUPPORTED_LOCALES as string[], DEFAULT_LOCALE) as Locale;
  } catch {
    // `match` lanza si el header trae un tag malformado (p. ej. "*" o basura de un bot).
    return DEFAULT_LOCALE;
  }
}

/** Type guard: ¿este string es uno de nuestros locales? */
export function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}
```

> El `try/catch` no es decorativo: `match` **lanza** ante un `Accept-Language` malformado, y sin él cualquier bot con un header raro tumba la request.

---

## 4. Ficheros de traducción

```json
// locales/es.json
{
  "common": { "welcome": "Bienvenido", "save": "Guardar", "cancel": "Cancelar" },
  "home": { "title": "Página de inicio", "description": "Esta es la descripción principal" }
}
```

```json
// locales/en.json
{
  "common": { "welcome": "Welcome", "save": "Save", "cancel": "Cancel" },
  "home": { "title": "Home page", "description": "This is the main description" }
}
```

**Misma estructura de claves en todos los idiomas.** Una clave que falta en un locale no da error de compilación (salvo que actives el tipado de §12): falla en runtime, en producción, en el idioma que menos miras.

### 4.1. La sección `errors` — mensajes de la API

Si el backend sigue [`error-handling.md`](./error-handling.md), sus errores llegan al cliente como un **código** (`"1-001"`), y el diccionario `código → texto` vive aquí, bajo la clave `errors`:

```jsonc
// locales/es.json
{ "errors": { "1-001": "No encontramos ese elemento.", "1-002": "Ese nombre ya está en uso." } }

// locales/en.json
{ "errors": { "1-001": "We couldn't find that item.", "1-002": "That name is already taken." } }
```

Se lee con `useMessages()` y se consume en el `QueryClientProvider`. Es la única sección de los locales cuyas claves **no** las eliges tú: las fija la API.

---

## 5. Config de next-intl en el servidor

Este fichero le dice a next-intl **qué locale** aplica a la request y **qué mensajes** cargar.

```ts
// locales/request.ts
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isValidLocale } from '#/shared/helpers/locale';

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` es el segmento [locale] de la URL. Es la fuente de verdad.
  const requested = await requestLocale;
  const locale = isValidLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
```

> **El locale sale del segmento `[locale]`, no de un header.** Es lo que next-intl v4 te da ya resuelto, no puede desincronizarse de la URL, y no depende de nada que haga el proxy. Si alguna vez ves que la app ignora el idioma de la URL y se queda en el idioma por defecto, empieza a mirar por aquí (§14).

---

## 6. Plugin en `next.config.ts`

```ts
// next.config.ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./locales/request.ts');

const nextConfig: NextConfig = {
  // tu config aquí
};

export default withNextIntl(nextConfig);
```

> **Gotcha de monorepo:** si el repo tiene varias apps con versiones distintas de Next, `next-intl` puede resolver el tipo `NextConfig` de la versión hoisted en la raíz y no de la que usa tu app. El wiring funciona; lo que rompe es TypeScript. Se arregla casteando en el punto de entrega, sin tocar el objeto de config:
>
> ```ts
> export default withNextIntl(nextConfig as unknown as Parameters<typeof withNextIntl>[0]);
> ```

---

## 7. Layout con locale

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isValidLocale } from '#/shared/helpers/locale';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: paramLocale } = await params;

  // /xx/lo-que-sea no es un idioma: 404, no lo sirvas en el idioma por defecto.
  if (!isValidLocale(paramLocale)) notFound();

  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        {/* Hace los mensajes accesibles en Client Components.
            En next-intl v4 no hace falta pasar `messages`: los hereda de request.ts. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**El `notFound()` no es opcional.** Sin él, `/xx/pricing` renderiza la página entera en el idioma por defecto: contenido duplicado bajo infinitas URLs, que Google indexa y penaliza.

---

## 8. Proxy (middleware)

> Desde **Next.js v16** el fichero `middleware.ts` se llama `proxy.ts` y la función exportada pasa de `middleware` a `proxy`. Codemod oficial:
>
> ```bash
> npx @next/codemod@canary middleware-to-proxy .
> ```

El proxy tiene **una** responsabilidad: garantizar que toda URL lleva locale. Si no lo lleva, lo detecta y redirige.

```ts
// proxy.ts   (Next 15: middleware.ts, y exporta `middleware`)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SUPPORTED_LOCALES } from '#/shared/types/locale.type';
import { getLocale } from '#/shared/helpers/locale';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const localeInPathname = SUPPORTED_LOCALES.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  // Ya lleva locale → seguir. next-intl lo lee del segmento [locale] (§5).
  if (localeInPathname) return NextResponse.next();

  // No lleva locale → detectarlo y redirigir a la URL prefijada.
  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Excluye _next, api y archivos estáticos: no tienen idioma.
    '/((?!_next|api|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|pdf|woff|woff2|ttf|eot|json)).*)',
  ],
};
```

### 8.1. Si necesitas el locale **fuera** del árbol `[locale]`

Route handlers, el layout raíz o cualquier código que no cuelgue de `app/[locale]/` no tienen segmento del que leer. Ahí sí hay que inyectar el locale como header — y **tiene que ser un _request_ header**:

```ts
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-locale', locale);

return NextResponse.next({ request: { headers: requestHeaders } });
```

Y se lee con `headers()`:

```ts
import { headers } from 'next/headers';

const locale = (await headers()).get('x-locale');
```

> ⚠️ **El error clásico.** Esto **no funciona**:
>
> ```ts
> const response = NextResponse.next({ request });
> response.headers.set('x-locale', locale); // ❌ response header
> return response;
> ```
>
> `response.headers.set(...)` añade un header a la **respuesta que va al navegador**. `headers()` en el servidor devuelve los headers de la **request entrante**, y Next solo los reescribe cuando pasas `request: { headers }` a `NextResponse.next()` (internamente los reenvía como `x-middleware-request-*`). Con la versión de arriba, `headers().get('x-locale')` es **`null`** y todo cae al idioma por defecto — de forma silenciosa, que es lo peor: la app "funciona", solo que siempre en un idioma. Es un fallo difícil de ver si tu idioma por defecto es el que más usas.

---

## 9. Usar traducciones

### Server Components

```tsx
// app/[locale]/page.tsx
import { getTranslations, getLocale } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <main>
      <h1>{t('home.title')}</h1>
      <p>{t('home.description')}</p>
      <span>Idioma actual: {locale}</span>
    </main>
  );
}
```

### Client Components

Un hook envuelve las tres cosas que necesitas: traducir, saber el idioma y cambiarlo.

```tsx
// modules/shared/hooks/useLocale.hook.ts
'use client';

import { useCallback } from 'react';
import { useTranslations, useLocale as useLocaleIntl } from 'next-intl';
import { Locale } from '#/shared/types/locale.type';

export function useLocale() {
  const t = useTranslations();
  const locale = useLocaleIntl() as Locale;

  // Cambia el idioma con recarga completa: el servidor debe cargar el otro diccionario.
  const setLocaleRedirecting = useCallback((newLocale: Locale) => {
    if (typeof window === 'undefined') return;

    const { pathname, search, hash } = window.location;
    // Sustituye el primer segmento: /es/dashboard -> /en/dashboard
    const [, , ...rest] = pathname.split('/');
    const newPath = `/${newLocale}/${rest.join('/')}${search}${hash}`;

    window.location.href = newPath;
  }, []);

  return { t, locale, setLocaleRedirecting };
}
```

```tsx
'use client';

import { useLocale } from '#/shared/hooks/useLocale.hook';
import { Locale } from '#/shared/types/locale.type';

export function LanguageSwitcher() {
  const { t, locale, setLocaleRedirecting } = useLocale();

  return (
    <header>
      <h1>{t('common.welcome')}</h1>
      <button onClick={() => setLocaleRedirecting(Locale.en)} disabled={locale === Locale.en}>
        EN
      </button>
      <button onClick={() => setLocaleRedirecting(Locale.es)} disabled={locale === Locale.es}>
        ES
      </button>
    </header>
  );
}
```

> **`window.location.href`, no `router.push`.** Un `push` hace navegación cliente: el árbol de servidor no se vuelve a renderizar con el otro diccionario y te quedas con la mitad de la UI en el idioma viejo. Se necesita recarga completa. Ese remonte, además, es lo que permite que el `QueryClientProvider` capture el diccionario de errores del nuevo idioma (ver [`error-handling.md`](./error-handling.md#8-mostrar-el-error-el-queryclientprovider)).

---

## 10. Interpolación, plurales y formatos

```json
// locales/es.json
{
  "greeting": "Hola, {name}",
  "items": "Tienes {count, plural, one {# elemento} other {# elementos}}",
  "updatedAt": "Actualizado el {date, date, long}"
}
```

```tsx
t('greeting', { name: 'Juan' }); // → "Hola, Juan"
t('items', { count: 3 }); // → "Tienes 3 elementos"
t('items', { count: 1 }); // → "Tienes 1 elemento"
t('updatedAt', { date: new Date() }); // → "Actualizado el 13 de julio de 2026"
```

El `#` dentro de un bloque `plural` se sustituye por el número. Las reglas de plural las aplica `Intl` según el idioma — no las codifiques a mano con ternarios.

---

## 11. Metadata y SEO

```tsx
// app/[locale]/layout.tsx
import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('metadata')]);

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      // `languages` genera los <link rel="alternate" hreflang>: le dice a Google
      // que estas URLs son el mismo contenido en otro idioma, no contenido duplicado.
      languages: {
        es: `${BASE_URL}/es`,
        en: `${BASE_URL}/en`,
      },
    },
    openGraph: {
      title: t('og.title'),
      description: t('og.description'),
      locale,
    },
  };
}
```

Y el `sitemap.ts` debe emitir **una entrada por idioma**, no solo la del idioma por defecto.

---

## 12. Tipado de las claves (opcional, muy recomendable)

```ts
// global.d.ts
import type esMessages from './locales/es.json';

type Messages = typeof esMessages;

declare global {
  interface IntlMessages extends Messages {}
}
```

Con esto `t('home.titl')` es un error de TypeScript. Convierte el fallo más común de i18n (una clave mal escrita o que solo existe en un idioma) en algo que se ve en el editor y no en producción.

> Toma el idioma **por defecto** como fuente del tipo. Si además quieres que falte-una-clave-en-otro-idioma sea un error, añade un test que compare las claves de todos los JSON.

---

## 13. El flujo, de principio a fin

```
Request del usuario
      │
      ▼
proxy.ts
  ¿La URL lleva locale?
    · No → detecta con Accept-Language → redirect a /{locale}/...
    · Sí → NextResponse.next()
      │
      ▼
app/[locale]/layout.tsx
  · isValidLocale(params.locale) → si no, notFound()
  · <html lang={locale}> + <NextIntlClientProvider>
      │
      ▼
locales/request.ts
  · Lee el locale del segmento [locale] (requestLocale)
  · Carga locales/{locale}.json
      │
      ▼
Server Components → getTranslations(), getLocale()
Client Components → useTranslations(), useLocale()
```

---

## 14. Gotchas

| Síntoma                                                              | Causa / solución                                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La app ignora el idioma de la URL y siempre sirve el por defecto** | Estás resolviendo el locale desde un header que el servidor no ve. Léelo del segmento con `requestLocale` (§5); si necesitas el header, inyéctalo como **request** header (§8.1) |
| El idioma no cambia al pulsar el switcher                            | Estás usando `router.push`. Hace falta recarga completa: `window.location.href` (§9)                                                                                             |
| Una clave sale como `home.title` en crudo                            | Falta en ese locale. Actívalo en compilación con el tipado de §12                                                                                                                |
| `/xx/pricing` renderiza la web en el idioma por defecto              | Falta el `notFound()` en el layout (§7) — contenido duplicado indexable                                                                                                          |
| Las imágenes o `/api` pasan por el proxy                             | Amplía las exclusiones del `matcher` (§8)                                                                                                                                        |
| Excepción intermitente en el proxy con tráfico de bots               | `match()` lanza ante un `Accept-Language` malformado — falta el `try/catch` (§3)                                                                                                 |
| Error de tipos en `next.config.ts` al añadir el plugin (monorepo)    | Versiones distintas de Next entre apps: castea en el punto de entrega (§6)                                                                                                       |

---

## Checklist: montar i18n en un proyecto nuevo

- [ ] `locale.type.ts` con el enum + `SUPPORTED_LOCALES` (§2).
- [ ] `locale.ts` con `getLocale` (**con `try/catch`**), `isValidLocale` y `DEFAULT_LOCALE` (§3).
- [ ] Un `locales/<locale>.json` por idioma, con la misma estructura de claves (§4).
- [ ] `locales/request.ts` leyendo el locale de **`requestLocale`** (§5).
- [ ] Plugin en `next.config.ts` (§6).
- [ ] `app/[locale]/layout.tsx` con `notFound()` para locales inválidos + `NextIntlClientProvider` (§7).
- [ ] `proxy.ts` (o `middleware.ts`) con el redirect y el `matcher` (§8).
- [ ] `global.d.ts` con el tipado de claves (§12).
- [ ] Si el proyecto consume una API con [`error-handling.md`](./error-handling.md): sección `errors` en cada locale (§4.1).

## Checklist: añadir un idioma

- [ ] Nuevo valor en el enum `Locale` y en `SUPPORTED_LOCALES`.
- [ ] Nuevo `locales/<locale>.json` con **todas** las claves traducidas (incluida la sección `errors`).
- [ ] Nueva entrada en `alternates.languages` de la metadata y en el `sitemap` (§11).
- [ ] Nuevo botón en el switcher de idioma (§9).
