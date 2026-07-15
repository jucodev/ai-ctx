# Mantenimiento de `ai-ctx`

Guía para mantener el CLI: cómo añadir skills, guías, reglas y comandos, y cómo viajan los assets al
paquete publicado. Para las convenciones de código (ESM, tsconfig estricto, patrón de comandos), ver
[`CLAUDE.md`](../CLAUDE.md).

---

## Cómo viajan los assets

Los catálogos y ficheros de `docs/` se leen **en runtime**, así que deben acabar dentro del paquete
publicado. El flujo:

```
docs/skills/  docs/guides/  docs/rules/   ──build──►   dist/skills/  dist/guides/  dist/rules/
     (fuente, en el repo)                              (lo que se publica; files: ["dist"])
```

- `npm run build` = `tsup` (bundlea `src/`) + `node scripts/copy-assets.mjs` (copia `docs/<dir>/` a
  `dist/<dir>/`).
- Solo se publica `dist/` (campo `files` del `package.json`). **Si añades un tipo de asset nuevo que
  se lea en runtime, hay que añadir su carpeta al array de `scripts/copy-assets.mjs`.**
- En el código, los assets se localizan con `new URL("./<dir>/", import.meta.url)`, que en runtime
  resuelve a `dist/<dir>/`.

> `docs/app-context.md` **no** es un asset: no se copia a `dist/`. Se genera en el proyecto destino a
> partir de su estado real, y su preconfiguración está embebida como texto en `src/context/render.ts`.

---

## Añadir una skill

Las skills se declaran en [`docs/skills/skills.json`](./skills/skills.json), agrupadas por categoría
(`type`). Hay dos formas:

- **Externa** — se instala con `npx skills add`. Entrada con la URL de `skills.sh`:
  ```json
  { "url": "https://www.skills.sh/owner/repo/skill-name" }
  ```
  El comando desatendido se **deriva** de la URL (ver [`installing-skills.md`](./installing-skills.md)).
- **Interna** — vive en el propio repo. Crea la carpeta `docs/skills/<nombre>/` con su `SKILL.md` y
  añade la entrada:
  ```json
  { "path": "<nombre>" }
  ```

Ambas aterrizan en `.claude/skills/<nombre>/` del proyecto destino. Las ya instaladas se **saltan**.

---

## Añadir una guía

Suelta un markdown en `docs/guides/<nombre>.md` con frontmatter `title` y `description`:

```markdown
---
title: Título legible
description: Una línea que resume la guía
---

# ...
```

Aparece sola en el selector de `add-guides` (el catálogo se descubre leyendo la carpeta; no hay
JSON). Se copia tal cual a `docs/guides/` del destino. Las ya instaladas se **saltan**.

---

## Añadir una regla

Las reglas viven en `docs/rules/<categoría>/<nombre>.md`. Categorías actuales: `frontend`, `backend`,
`shared` (definidas en [`docs/rules/rules.json`](./rules/rules.json); los ficheros se descubren
leyendo cada carpeta). Frontmatter:

```markdown
---
description: Una línea que resume la regla
paths:
  - {{backend}}/src/**/*.ts
  - {{frontend}}/**/*.tsx
---

# ...
```

### Placeholders de path (importante)

Los globs **no** deben llevar rutas concretas del monorepo original. Usa los placeholders, que
`add-rules` expande al instalar:

| Placeholder | Monorepo | No monorepo |
| --- | --- | --- |
| `{{frontend}}/` | el/los path(s) que indique el usuario | se elimina (path relativo a la raíz) |
| `{{backend}}/` | ídem | se elimina |

La sustitución (`src/rules/rewrite.ts`) se aplica al **fichero entero**, no solo al frontmatter: si
pones una ruta de ejemplo en el cuerpo, úsala también con placeholder para que se reescriba igual.
Una regla de solo backend no contiene el token de frontend, así que esa sustitución es no-op.

### Añadir una categoría nueva

1. Crea la carpeta `docs/rules/<nueva>/`.
2. Añade su entrada `{ "type": "<nueva>", "description": "..." }` a `rules.json`.
3. Si usa un placeholder de path nuevo (más allá de front/back), amplía `Bases` y la lógica de
   `rewrite.ts` y de `resolveBases` en `src/commands/add-rules.ts`.

---

## El índice `app-context.md`

Generado por `src/context/`:

- `scan.ts` — `scanProject(cwd)` lee el estado real del destino (`docs/rules/`, `docs/guides/`,
  `.claude/skills/`). Best-effort: carpeta ausente → sección vacía.
- `render.ts` — el bloque de índice (entre marcadores) y el scaffold inicial. **La preconfiguración
  recomendada es el texto de `renderPreconfig()`; edítalo aquí.**
- `write.ts` — `refreshContext(cwd)` crea el fichero, o sustituye solo el bloque entre marcadores
  conservando el resto.

Los marcadores `<!-- ai-ctx:index:start -->` / `<!-- ai-ctx:index:end -->` delimitan lo único que se
regenera. Si cambias su formato, actualiza `INDEX_START`/`INDEX_END` en `render.ts` (los ficheros ya
existentes en proyectos destino seguirán con los marcadores viejos hasta que se vuelva a crear el
bloque).

Cada `add-*` llama a `refreshContext` al terminar de instalar, así que el índice se mantiene solo.

---

## Añadir un comando

Sigue el patrón modular (detallado en [`CLAUDE.md`](../CLAUDE.md) y en la skill `commander-cli`):

1. Crea `src/commands/<nombre>.ts` que exporte `register<Nombre>Command(program)`.
2. Regístralo en `src/commands/index.ts` (import con extensión `.js` por NodeNext).
3. Si es interactivo, empieza con `requireTty(program, "<nombre>")` y usa los helpers de
   `src/ui.ts` (`select`, `promptText`, `reportSummary`).
4. Si instala algo, refresca el índice al final: `await refreshContext(cwd)`.

---

## Verificación antes de publicar

```bash
npm run typecheck
npm run build
ls dist/rules dist/guides dist/skills   # los assets viajaron a dist/
```

Prueba de punta a punta contra un proyecto de usar y tirar (fuera de este repo), pilotando los
selectores con `expect` en una pty:

- `add-rules` en un monorepo (con `workspaces` en `package.json`) y sin él → globs reescritos /
  prefijo eliminado.
- `add-context` → índice con lo instalado + preconfiguración; re-ejecutar preserva ediciones
  manuales.
- Abortar un selector con Ctrl+C debe salir limpio, sin crear nada.
