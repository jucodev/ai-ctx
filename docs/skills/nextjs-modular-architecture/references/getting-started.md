# Arrancar desde cero y checklist de feature

## 1. Arrancar un proyecto desde cero — orden recomendado

Sigue este orden: cada paso apoya al siguiente y evita retrabajo.

1. **Scaffold + TypeScript strict.** Crea la app Next.js (App Router) — standalone o como
   `apps/<app>/` en tu monorepo. Activa `strict` y define los aliases `@/*` y `#/*` en el
   `tsconfig.json` de la app (en monorepo, extendiendo el `tsconfig.base.json` compartido).
2. **Tailwind + shadcn.** Instala Tailwind v4, declara los tokens de tema en `globals.css` (`@theme`)
   e inicializa shadcn (`components.json`). El CLI de shadcn ya genera un `cn()` en `lib/utils.ts`:
   deja **una sola** implementación —la de `shared/helpers/styles.ts`— y que la otra la re-exporte.
3. **Capa `shared/` mínima.** Crea, en este orden y copiando el código de las referencias en vez de
   improvisarlo:
   - `HttpError`, `env.helper` con Zod, `services/fetcher` y `services/server-fetcher` →
     **`references/shared-foundations.md`**
   - tipos base (`Entity` + `OnlyProps`, `PaginationParams/Result`) y `url.helper` →
     **`references/shared-types.md`**
   - las constantes (`api-routes`, `app-routes`, `form-messages`, `error-messages`) →
     `references/conventions.md`
4. **Providers globales.** Monta el `QueryClientProvider` (con manejo global de errores → toast, en
   **`references/error-toast-provider.md`**) y el `Toaster` en el `layout.tsx` raíz. **Decide aquí si la app llevará i18n**
   (`references/routing-and-i18n.md`): si sí, añade el segmento `[locale]` y el provider de i18n; si
   no, deja `app/` sin `[locale]` y sáltate todo lo de locales.
5. **Auth y guard.** Cliente de auth en `lib/`, `getMe`/sesión server-side en un módulo `auth/`, y el
   proxy que protege rutas (`proxy.ts` en Next 16+, `middleware.ts` en Next ≤15; resuelve locale solo
   si hay i18n). Route groups `(auth)` y `(app)`.
6. **Primer módulo de feature.** Elige un dominio y crea `modules/<feature>/` completo: `types.ts` →
   `api/` → `queries/keys/` → `queries/hooks/` → `components/` → `pages/`. Conecta el page desde
   `app/` con un thin wrapper.
7. **Repite por feature.** Cada nueva capacidad es un módulo nuevo o una extensión de uno existente.
   Sube a `shared/` solo cuando algo lo usen 2+ módulos.

**Por qué este orden:** la infraestructura transversal (fetcher, errores, constantes, providers)
existe antes que el primer feature, así que los módulos nacen ya enchufados a los patrones en vez de
reinventarlos y refactorizarse después.

---

## 2. Checklist para añadir una feature

- [ ] ¿Encaja en un módulo existente? Si no, crea `modules/<feature>/`.
- [ ] Define la entidad y enums en `types.ts` (extiende `Entity` si es del backend).
- [ ] Escribe las funciones de red en `api/` usando `fetcher` y `API_ROUTES`.
- [ ] Crea la query key factory en `queries/keys/`.
- [ ] Crea los hooks `useQuery`/`useMutation` en `queries/hooks/` (uno por archivo, invalidaciones
      correctas).
- [ ] Construye los componentes en `components/` (presentacionales, props con `Pick`, barrel).
- [ ] Si hay formulario: schema Zod aparte + tipo derivado + `onSubmit` por callback.
- [ ] Crea el page component en `pages/` que orquesta hooks y estado local.
- [ ] Añade el thin wrapper en `app/` que renderiza el page.
- [ ] Rutas, mensajes y endpoints nuevos → a `shared/constants/`. Envs nuevas → al `env.helper` y a
      `.env.example`.
- [ ] Nada de `fetch` crudo, `any`, query keys inline, estilos inline ni lógica en `app/`.
- [ ] Pasa el linter y `tsc --noEmit` antes de dar por terminada la tarea.
