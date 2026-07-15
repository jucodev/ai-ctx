# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ai-ctx` is a Node.js CLI that **prepares a project's AI context**: run from a target project's root, it installs skills, guides and rules into it, and generates a living index (`docs/app-context.md`) so any agent knows what is configured and where to find it.

It is built with [commander.js](https://github.com/tj/commander.js), uses [`@inquirer/prompts`](https://github.com/SBoudrias/Inquirer.js) for the interactive selectors, is written in TypeScript, ships as pure ESM (`"type": "module"`), and is bundled with [tsup](https://tsup.egoist.dev/).

For humans, [`README.md`](./README.md) is the usage overview and [`docs/maintenance.md`](./docs/maintenance.md) is the maintenance guide (how to add skills/guides/rules, and how assets ship). This file focuses on the conventions Claude must follow when editing the code.

## Commands

```bash
npm run build      # bundle src/ → dist/ (ESM + .d.ts + sourcemaps) via tsup
npm run dev        # tsup --watch: recompile on every save
npm run start      # node dist/index.js
npm run typecheck  # tsc --noEmit (type check only, no output)
```

There is no test runner or linter configured yet (`npm test` is a placeholder that exits 1).

## Running the CLI

The binary is `ai-ctx`, mapped to `dist/index.js` via the `bin` field. It only exists after a build.

```bash
# During development — build once, then run directly:
npm run build
node dist/index.js hello Juan -u
node dist/index.js --help

# Or keep `npm run dev` running in one terminal and `node dist/index.js <cmd>` in another.

# As a global `ai-ctx` command (after build):
npm link            # one-time; undo with: npm unlink -g ai-ctx
ai-ctx hello Juan -u
```

Available commands (plus the built-in `--help` / `--version`):

| Command | What it does | Writes to (target project) |
| --- | --- | --- |
| `add-skills` | Interactive selector of skills by category. Copies internal skills, runs `npx skills add` for external ones. Skips already-installed. | `.claude/skills/` |
| `add-guides` | Interactive selector of guides; copies the chosen markdown. Skips already-installed. | `docs/guides/` |
| `add-rules` | Interactive selector of rules by category (frontend/backend/shared); rewrites path placeholders to the target. Re-running regenerates existing rules. | `docs/rules/<cat>/` |
| `add-context` | Generates/updates the living project index. Also auto-run by the three `add-*` commands after they install. | `docs/app-context.md` |
| `hello [name] [-u\|--upper]` | Sample command. | — |

The three `add-*` installers are interactive and require a TTY (`requireTty`).

## Architecture

Command registration is modular and centralized, not defined inline in the entrypoint:

- `src/index.ts` — creates the commander `program` (name, description, version) and calls `registerCommands(program)`. Keep this file thin; it should not define command logic.
- `src/commands/index.ts` — the single registration hub. `registerCommands` calls each `register<Name>Command` in turn. **Every new command must be wired in here.**
- `src/commands/<name>.ts` — one file per command, each exporting a `register<Name>Command(program: Command): void` that attaches the command, its args/options, and its `.action()` handler.

Command logic delegates to per-feature modules, and interactive concerns live in one shared UI helper:

- `src/ui.ts` — shared interactive helpers: `requireTty`, `select` (multi-select checkbox), `promptText` (text input), `reportSummary`. All swallow `ExitPromptError` so Ctrl+C exits cleanly. Reuse these instead of calling `@inquirer/prompts` directly.
- `src/skills/`, `src/guides/`, `src/rules/`, `src/context/` — one module per feature. Each has a `catalog`/`scan` (discovers what's available/installed), an `install`/`write` (does the filesystem work), and — for rules — `rewrite.ts` (expands the `{{frontend}}`/`{{backend}}` path placeholders per target). `src/context/write.ts` exposes `refreshContext(cwd)`, which the `add-*` commands call after installing.

### Assets pipeline (important)

Catalogs and asset files under `docs/` are read **at runtime**, so they must be inside the published package:

- `npm run build` runs tsup **and** `node scripts/copy-assets.mjs`, which copies `docs/skills/`, `docs/guides/`, `docs/rules/` → `dist/…`. Only `dist/` is published (`files: ["dist"]`).
- Code locates them with `new URL("./<dir>/", import.meta.url)`, which resolves to `dist/<dir>/` at runtime.
- **If you add a new runtime-read asset directory, add it to the array in `scripts/copy-assets.mjs`** or it won't ship.
- `docs/app-context.md` is **not** an asset: it's generated in the target project from its real state, and its preconfig text is embedded in `src/context/render.ts`.

See [`docs/maintenance.md`](./docs/maintenance.md) for how to add a skill/guide/rule and the path-placeholder details.

### Adding a new command

1. Create `src/commands/<name>.ts` exporting `register<Name>Command(program)` (mirror `hello.ts`, or `add-guides.ts` for an interactive installer).
2. Import and call it inside `registerCommands` in `src/commands/index.ts`.
3. If it's interactive, start the action with `requireTty(program, "<name>")` and use the `src/ui.ts` helpers.
4. If it installs anything into the target project, call `await refreshContext(cwd)` at the end so `docs/app-context.md` stays current.

For commander.js best practices — options vs. arguments, input coercion and validation with `InvalidArgumentError`, async actions, error handling, help/hooks — use the **`commander-cli`** skill (`.claude/skills/commander-cli/`).

## Conventions that matter

- **ESM + NodeNext resolution:** relative imports MUST use a `.js` extension even though the source is `.ts` (e.g. `import { registerHelloCommand } from "./hello.js"`). Omitting it fails type check and build. This is required by `moduleResolution: "NodeNext"`.
- **tsconfig is strict**, with extras beyond `strict`: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`).
- **`ignoreDeprecations: "6.0"`** is set in tsconfig as a workaround: TypeScript 6 flags `baseUrl` as deprecated, and tsup's `.d.ts` generation injects it internally, which otherwise breaks the DTS build step. Remove once tsup no longer requires it.
- The executable shebang (`#!/usr/bin/env node`) is injected by tsup via `banner` in `tsup.config.ts` — do not add it to `src/index.ts` manually.
