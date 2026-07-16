# ai-ctx

CLI para **preparar el contexto de IA** de un proyecto: instala skills, guías y reglas en la raíz
donde se ejecuta, y genera un índice vivo (`docs/app-context.md`) para que cualquier agente sepa qué
hay configurado y dónde acudir para cada cosa.

Está escrito en TypeScript, se distribuye como ESM puro y se empaqueta con
[tsup](https://tsup.egoist.dev/). El parser de comandos es
[commander.js](https://github.com/tj/commander.js) y los selectores interactivos usan
[`@inquirer/prompts`](https://github.com/SBoudrias/Inquirer.js).

## Instalación / uso

No requiere instalación: se ejecuta con `npx` desde la raíz del proyecto que quieras configurar.

```bash
npx @jucodev/ai-ctx <comando>
npx @jucodev/ai-ctx --help
```

### Autenticación (paquete privado)

`@jucodev/ai-ctx` es un **paquete privado** publicado en el **GitHub Packages npm registry**. Aunque el
repositorio sea público, instalarlo requiere autenticarse con un **Personal Access Token (classic)** de
GitHub que tenga el scope `read:packages`.

Crea un `.npmrc` (en tu `$HOME` para uso global, o en la raíz del proyecto consumidor) con:

```
@jucodev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<TU_GITHUB_PAT_CON_read:packages>
```

A partir de ahí `npx @jucodev/ai-ctx <comando>` funciona con normalidad. Sin este `.npmrc` la descarga
falla con un `401 Unauthorized`, porque los paquetes de GitHub Packages —incluso los públicos— siempre
exigen autenticación.

Los comandos que instalan cosas (`add-skills`, `add-guides`, `add-rules`) son **interactivos** y
necesitan un terminal (TTY): abren un selector donde marcas opciones con **Espacio**, te mueves con
**↑/↓** y confirmas con **Enter**.

## Comandos

| Comando | Qué hace | Dónde escribe |
| --- | --- | --- |
| `add-skills` | Selector de skills por categoría. Copia las internas y ejecuta `npx skills add` para las externas. | `.claude/skills/` |
| `add-guides` | Selector de guías. Copia los markdown elegidos. | `docs/guides/` |
| `add-rules` | Selector de reglas por categoría (frontend/backend/shared), reescribiendo los paths al proyecto. | `docs/rules/<cat>/` |
| `add-context` | Genera/actualiza el índice vivo del proyecto. | `docs/app-context.md` |
| `hello [name]` | Comando de ejemplo (`-u`/`--upper` en mayúsculas). | — |

### `add-rules` — reescritura de paths

Las reglas vienen de un monorepo y sus globs usan placeholders (`{{frontend}}/`, `{{backend}}/`) que
se expanden al instalar:

- **Monorepo** (se detecta por `workspaces` en el `package.json`): se piden los paths base de los
  proyectos afectados por tu selección. Puedes indicar **varios separados por coma** (p.e.
  `apps/dashboard,apps/admin`), que se expanden a un glob `{apps/dashboard,apps/admin}/…`.
- **No monorepo**: se elimina el prefijo y los globs quedan relativos a la raíz (`src/**/*.ts`).

Re-ejecutar **regenera** las reglas ya instaladas con el nuevo set de paths (útil si añades un
proyecto después); esas se reportan como _Actualizadas_.

### `add-context` — índice vivo

`docs/app-context.md` tiene dos partes:

1. Un **índice autogenerado** (entre marcadores `<!-- ai-ctx:index:start/end -->`) del estado real
   del proyecto: reglas por categoría, guías y skills instaladas, con su descripción.
2. Una sección de **Preconfiguración** (texto estático, editable) con las recomendaciones base.

Al regenerar solo se reescribe el bloque entre marcadores; la preconfiguración y cualquier nota que
añadas a mano se conservan. Además, `add-skills`, `add-guides` y `add-rules` lo refrescan
automáticamente al terminar, así que suele estar al día sin llamarlo tú.

## Desarrollo

```bash
npm run build      # empaqueta src/ → dist/ (ESM + .d.ts) y copia los assets de docs/ a dist/
npm run dev        # tsup --watch: recompila en cada guardado
npm run start      # node dist/index.js
npm run typecheck  # tsc --noEmit
```

El binario `ai-ctx` (campo `bin`) apunta a `dist/index.js` y solo existe tras un build. Durante el
desarrollo, ejecútalo directamente:

```bash
npm run build
node dist/index.js add-context
node dist/index.js --help
```

## Mantenimiento

Para añadir skills, guías, reglas o comandos nuevos, consulta
[`docs/maintenance.md`](./docs/maintenance.md). La referencia de instalación desatendida de
skills externas está en [`docs/installing-skills.md`](./docs/installing-skills.md).
