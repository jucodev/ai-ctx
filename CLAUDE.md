# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ai-ctx` is a Node.js CLI built with [commander.js](https://github.com/tj/commander.js). It is written in TypeScript, ships as pure ESM (`"type": "module"`), and is bundled with [tsup](https://tsup.egoist.dev/).

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

Currently available commands: `hello [name] [-u|--upper]`, plus the built-in `--help` / `--version`.

## Architecture

Command registration is modular and centralized, not defined inline in the entrypoint:

- `src/index.ts` — creates the commander `program` (name, description, version) and calls `registerCommands(program)`. Keep this file thin; it should not define command logic.
- `src/commands/index.ts` — the single registration hub. `registerCommands` calls each `register<Name>Command` in turn. **Every new command must be wired in here.**
- `src/commands/<name>.ts` — one file per command, each exporting a `register<Name>Command(program: Command): void` that attaches the command, its args/options, and its `.action()` handler.

### Adding a new command

1. Create `src/commands/<name>.ts` exporting `register<Name>Command(program)` (mirror `hello.ts`).
2. Import and call it inside `registerCommands` in `src/commands/index.ts`.

For commander.js best practices — options vs. arguments, input coercion and validation with `InvalidArgumentError`, async actions, error handling, help/hooks — use the **`commander-cli`** skill (`.claude/skills/commander-cli/`).

## Conventions that matter

- **ESM + NodeNext resolution:** relative imports MUST use a `.js` extension even though the source is `.ts` (e.g. `import { registerHelloCommand } from "./hello.js"`). Omitting it fails type check and build. This is required by `moduleResolution: "NodeNext"`.
- **tsconfig is strict**, with extras beyond `strict`: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`).
- **`ignoreDeprecations: "6.0"`** is set in tsconfig as a workaround: TypeScript 6 flags `baseUrl` as deprecated, and tsup's `.d.ts` generation injects it internally, which otherwise breaks the DTS build step. Remove once tsup no longer requires it.
- The executable shebang (`#!/usr/bin/env node`) is injected by tsup via `banner` in `tsup.config.ts` — do not add it to `src/index.ts` manually.
