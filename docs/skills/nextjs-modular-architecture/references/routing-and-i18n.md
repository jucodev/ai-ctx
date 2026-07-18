# App Router, rutas e internacionalización

Detalle de cómo se organizan las rutas del App Router y cómo se añade i18n (opcional). Para el mapa
general y el árbol de carpetas, ver `SKILL.md`.

## 1. Las rutas de `app/` son thin wrappers

Los archivos de `app/` **no contienen lógica ni UI de negocio**. Solo importan el page/layout del
módulo y lo renderizan.

```tsx
// ✅ app/(app)/dashboard/products/page.tsx
import { ProductsPage } from '#/product/pages/ProductsPage';

export default function Page() {
  return <ProductsPage />;
}
```

```tsx
// ❌ Evitar — lógica y fetching metidos directamente en app/
export default function Page() {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['products', q], queryFn: () => fetch(...) });
  return <div>{/* 200 líneas de JSX */}</div>;
}
```

**Por qué importa:** mantener `app/` fino desacopla el enrutado del contenido, hace triviales los
tests del page component (se importa sin el runtime de Next) y evita mezclar responsabilidades.

## 2. Server vs Client Components

- **Por defecto, Server Component.** No añadas `'use client'` salvo que uses hooks (`useState`,
  `useEffect`, TanStack Query), manejadores de eventos (`onClick`) o APIs del navegador.
- Los **layouts server-side** son el lugar para guards de sesión y data fetching inicial (leen
  cookies, redirigen). Los **page components de módulo** suelen ser `'use client'` porque orquestan
  queries e interacción.

```tsx
// ✅ app/(app)/layout.tsx — guard de sesión en el servidor
import { redirect } from 'next/navigation';
import { getMe } from '#/auth/api/me.api-server';
import { AppShell } from '#/app/layouts/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me?.user) redirect('/login');
  return <AppShell user={me.user}>{children}</AppShell>;
}
```

## 3. Route groups y layouts anidados

Usa **route groups** `(nombre)` para agrupar rutas que comparten layout sin añadir segmento a la
URL. Patrón típico: `(auth)` para lo público y `(app)`/`(dashboard)` para lo protegido, cada uno con
su `layout.tsx`.

## 4. Proxy (antes Middleware)

> **Naming según versión de Next.js:** desde **Next 16**, el Middleware pasó a llamarse **Proxy**
> (misma funcionalidad, mejor nombre). El archivo es **`proxy.ts`** en la raíz del proyecto (junto a
> `app/`) y la función exportada se llama **`proxy`**. En **Next ≤ 15** es `middleware.ts` con una
> función `middleware` — la API interna (`NextRequest`/`NextResponse`, redirecciones) es idéntica;
> solo cambia el nombre del archivo y de la función. Usa el que corresponda a tu versión.

Centraliza aquí las decisiones de **enrutado transversal**: protección de rutas (redirigir a login
sin sesión, redirigir fuera de auth con sesión) y —**solo si la app tiene i18n**— la resolución de
locale. Una app sin internacionalización tiene un proxy más simple que solo hace el guard de sesión,
o incluso puede no tener proxy si todas las rutas son públicas. No lo uses para data fetching lento:
es para checks optimistas y redirecciones, no para gestión de sesión completa.

```typescript
// ✅ proxy.ts (Next 16+) — lee cookie de sesión, decide redirecciones, sin lógica de negocio
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIES.SESSION_TOKEN)?.value;
  const isAuthed = token ? await verifySession(token).catch(() => false) : false;

  if (isProtectedPath(request.nextUrl.pathname) && !isAuthed) {
    return NextResponse.redirect(new URL(APP_ROUTES.LOGIN, request.url));
  }
  return NextResponse.next();
}
```

**Por qué importa:** el guard vive en un único punto de entrada en vez de repetirse en cada page;
las rutas y cookies salen de constantes (ver `references/conventions.md`), no de strings sueltos.

## 5. Internacionalización — OPCIONAL

**La i18n no es parte del esqueleto base.** Muchas apps son de un solo idioma y **no deben** llevar
segmento `[locale]`, ni `locales/`, ni lógica de locale en el proxy — añadirlo sin necesidad mete un
nivel de anidamiento y complejidad a cambio de nada. Añádela **solo si la app es multi-idioma**. Si
no sabes si el proyecto la necesita, no la metas: es más fácil añadirla después que quitarla.

**Cuándo NO añadirla (caso por defecto):** app de un idioma → `app/layout.tsx`, `app/(auth)/…`,
`app/(app)/…` directamente en la raíz de `app/`. Sin `locales/`.

**Cuándo SÍ, y cómo:** si es multi-idioma, envuelve las rutas en un segmento dinámico `[locale]` y
añade la infraestructura de i18n:

```
app/
└── [locale]/                 # ← el ÚNICO cambio estructural respecto al árbol base
    ├── layout.tsx            # valida el locale, monta el provider de i18n
    ├── (auth)/…
    └── (app)/…
locales/                      # en.json, es.json, … + config de la librería (p. ej. request.ts)
```

- Usa una librería de i18n (p. ej. `next-intl`), con diccionarios en `locales/*.json`.
- **El locale se lee del segmento `[locale]` de la URL**, que es la única fuente de verdad (en
  next-intl v4, vía `requestLocale` en `locales/request.ts`). El proxy solo detecta el idioma
  (`Accept-Language`) cuando la URL **no** lo lleva, y **redirige** a la URL prefijada.
- ⚠️ **No resuelvas el locale desde un header** en el árbol `[locale]`: es la causa nº 1 de "la app
  ignora el idioma de la URL y sirve siempre el por defecto". El header solo hace falta para código
  que **no** cuelga de `app/[locale]/` (route handlers, layout raíz), y entonces debe inyectarse como
  **request** header: `NextResponse.next({ request: { headers } })`.
- El layout de `[locale]` valida el segmento y hace `notFound()` si no es un idioma soportado — sin
  eso, `/xx/pricing` renderiza la web entera en el idioma por defecto y Google la indexa como
  contenido duplicado.
- El diccionario `errors` alimenta el toast global de errores (ver `references/data-layer.md`).
- Antes de fijar los idiomas soportados, **confirma con el usuario** cuáles quiere.

> **Código completo del patrón** (detección, `request.ts`, layout, proxy, metadata/SEO, tipado de
> claves y gotchas): guía `i18n-guide.md`. Es la referencia canónica de i18n; esta sección solo
> explica dónde encaja en la arquitectura.

Nada más de la arquitectura cambia: módulos, capa de datos, componentes y hooks son idénticos con o
sin i18n.
