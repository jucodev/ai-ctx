---
name: commander-cli
description: >-
  Best practices for building Node.js/TypeScript command-line tools with the
  commander.js package. Use this skill whenever the user is building, extending,
  or refactoring a CLI with commander — defining commands, subcommands,
  arguments, or options; wiring action handlers; adding argument/option
  validation and coercion; customizing help, version, or error output; adding
  lifecycle hooks; or structuring a growing CLI into per-command modules. Trigger
  it even when the user doesn't name "commander" explicitly but is clearly
  working on a Node/TS command-line interface (e.g. `program.command(...)`,
  `.option(...)`, a `bin` field, an `ai-ctx`/`my-cli` style tool, or a
  `src/commands/` layout).
---

# Building CLIs with commander.js

Commander is the de-facto argument parser for Node CLIs. It handles parsing,
help, and dispatch so you can focus on behavior. The goal of this skill is a CLI
that is **predictable for users** (good help, clear errors, sensible exit codes)
and **maintainable for developers** (commands isolated in their own modules,
validation pushed to the edges, types flowing through).

Everything below assumes ESM + TypeScript, since that's the modern default. If
the project already has a convention (check `src/commands/`, `tsconfig.json`,
`package.json` `"type"`), follow it over anything here.

## Mental model

- A `program` (a `Command`) is the root. It can hold **options**, **arguments**,
  an **action**, and **subcommands** — which are themselves `Command`s, so the
  whole thing is recursive.
- **Options** are flags (`-f`, `--file`). **Arguments** are positional operands.
- Each command's `.action()` receives its arguments first, then its resolved
  options object, then the `Command` instance itself.
- Commander parses, validates what it can, then calls the deepest matched
  command's action. Your job is to make the *shape* of the command declarative
  (so help and errors come for free) and keep imperative logic in the action.

## The one rule that saves the most pain: don't define everything in one file

A CLI that starts as 20 lines in `index.ts` becomes unreadable at 200. Structure
it so each command owns a file and there's a single place that wires them up.
This is also what makes commands unit-testable and lets several people add
commands without merge conflicts.

```
src/
├── index.ts            # creates program, sets name/description/version, parses
├── commands/
│   ├── index.ts        # registerCommands(program): calls each register<X>Command
│   ├── hello.ts        # export function registerHelloCommand(program): void
│   └── build.ts
```

`src/index.ts` stays thin — it should not contain command logic:

```ts
import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

const program = new Command();
program
  .name("my-cli")
  .description("What this tool does")
  .version("1.0.0");

registerCommands(program);
program.parseAsync();
```

Each command exports a `register<Name>Command`:

```ts
import type { Command } from "commander";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Bundle the project")
    .argument("<entry>", "entry file")
    .option("-o, --outdir <dir>", "output directory", "dist")
    .action((entry: string, options: { outdir: string }) => {
      // ...
    });
}
```

And the hub imports and calls each one — **every new command gets wired in
here**:

```ts
import type { Command } from "commander";
import { registerBuildCommand } from "./build.js";
import { registerHelloCommand } from "./hello.js";

export function registerCommands(program: Command): void {
  registerHelloCommand(program);
  registerBuildCommand(program);
}
```

> ESM note: with `"moduleResolution": "NodeNext"`, relative imports **must** carry
> a `.js` extension even in `.ts` source (`"./build.js"`). Use `import type` for
> type-only imports if `verbatimModuleSyntax` is on.

## Options — reach for the right kind

| Need | Pattern |
| --- | --- |
| Boolean flag | `.option("-d, --debug", "enable debug")` |
| Required value | `.option("-f, --file <path>", "file to read")` (`<>` = value required) |
| Optional value | `.option("-c, --cheese [type]", "add cheese")` (`[]` = value optional) |
| Default | `.option("-p, --port <n>", "port", "3000")` |
| Repeatable / list | custom coercion (see below) |
| Negatable | `.option("--no-color", "disable color")` |
| Mandatory option | `.requiredOption("-u, --user <name>", "user")` |

Read resolved options with `program.opts()` (root) or the `options` argument in
an action (per-command). Option names become camelCase keys: `--out-dir` →
`options.outDir`.

**Negatable options** (`--no-x`) default the value to `true` and flip it to
`false` when passed. If you pair `--cheese <type>` with `--no-cheese`, the
negated form sets it to `false`, so branch on `=== false`.

For anything richer than a flag with a default, prefer the **`Option` class**
via `.addOption()`. It's the same capability the string form has, plus choices,
env fallback, conflicts, and implications — all of which surface in help and
error messages automatically instead of living as hand-rolled `if`s in your
action:

```ts
import { Option } from "commander";

program
  .addOption(new Option("-d, --drink <size>", "drink size")
    .choices(["small", "medium", "large"]))
  .addOption(new Option("-p, --port <number>", "port")
    .env("PORT").argParser(Number).default(3000))
  .addOption(new Option("--secret <token>").hideHelp())
  .addOption(new Option("--no-server", "disable the server").conflicts("port"));
```

## Coercion: turn strings into real values at the boundary

Commander hands you strings. Convert (and reject bad input) in a parser function
so your action receives typed, validated values — and the error message is
consistent with every other commander error. Throw `InvalidArgumentError` to
signal bad input; commander prints it and exits non-zero.

```ts
import { InvalidArgumentError } from "commander";

function parsePositiveInt(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) {
    throw new InvalidArgumentError("Must be a positive integer.");
  }
  return n;
}

// Repeatable option that collects into an array (note the [] default):
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

program
  .option("-p, --port <number>", "port", parsePositiveInt, 3000)
  .option("-i, --include <glob>", "repeatable", collect, []);
```

The same third-argument-is-a-parser convention works on `.argument()`:

```ts
program
  .command("add")
  .argument("<first>", "first number", parsePositiveInt)
  .argument("[second]", "second number", parsePositiveInt, 1000)
  .action((first: number, second: number) => console.log(first + second));
```

Why this matters: validating in the parser (not in the action) means invalid
input is rejected *before* any side effects run, and the failure looks like a
normal CLI usage error rather than a stack trace.

## Arguments

- `<required>` must be supplied; `[optional]` may be omitted.
- A trailing `<items...>` (or `[items...]`) is **variadic** — collects the rest
  into an array. Only the last argument can be variadic.
- Declare them with `.argument("<name>", "desc")` (chainable) or `.arguments()`.

Action signature is `(...args, options, command)` — positional args in
declaration order, then the options object, then the command.

## Actions and async

Return a promise from an async action and call `program.parseAsync()` (not
`.parse()`) so the process waits for it and rejections surface properly.

```ts
program
  .command("deploy")
  .option("--env <name>", "environment", "staging")
  .action(async (options: { env: string }) => {
    await doDeploy(options.env);
  });

await program.parseAsync();
```

Keep actions thin: parse/validate declaratively, then delegate to a plain
function that has no knowledge of commander. That function is trivially
unit-testable and reusable.

## Errors, exit codes, and help

Let commander own usage errors — don't reinvent them:

- **`program.error(message, { exitCode, code })`** — report a runtime failure the
  commander way (styled, correct exit code). Prefer it over
  `console.error` + `process.exit`.
- **`.requiredOption(...)` / `Option.makeOptionMandatory()`** — enforce presence
  declaratively; commander emits `error: required option '...' not specified`.
- **`.showHelpAfterError()`** — print help after a usage error so users see how
  to fix it. **`.showSuggestionAfterError()`** — "did you mean" for typos.
- **`.exitOverride()`** — make commander throw a `CommanderError` instead of
  calling `process.exit`, so you can catch and handle it (essential for tests and
  embedding). Wrap `parse` in try/catch.
- **`.configureOutput({...})`** — redirect/format stdout/stderr writes.

```ts
program.exitOverride();
try {
  program.parse(process.argv);
} catch (err) {
  // CommanderError has .code and .exitCode; handle or rethrow
}
```

Exit-code convention: `0` success, non-zero failure. Commander uses `1` for
usage errors by default; use distinct codes for distinct failure classes when
scripts consume your CLI.

Customize help with `.addHelpText("before" | "after" | ..., text)` for examples,
and always set `.name()`, `.description()`, `.version()` — help and `--version`
are generated from them.

## Hooks — cross-cutting behavior without repetition

Register logic that runs around actions instead of copy-pasting into every
command:

```ts
program
  .option("-v, --verbose", "verbose logging")
  .hook("preAction", (thisCommand, actionCommand) => {
    if (thisCommand.opts().verbose) {
      console.error(`> ${actionCommand.name()}`, actionCommand.opts());
    }
  });
```

`preAction`/`postAction` wrap the action; `preSubcommand` runs before dispatching
to a subcommand. Good for logging, timing, auth checks, config loading.

## Growing up: standalone executable subcommands

For large tools (git-style), a subcommand can live in its own executable file
(`my-cli-install`, `my-cli-search`) that commander finds and spawns. Use
`.command("install", "description")` **with a description string and no action** —
that signature tells commander it's an external executable. This keeps startup
fast (only the invoked subcommand loads) at the cost of process spawn overhead.
Most CLIs don't need this; reach for it only when load time or team boundaries
demand it.

## Adding a new command — checklist

1. Create `src/commands/<name>.ts` exporting `register<Name>Command(program)`.
2. Declare args/options/description; push validation into parser functions.
3. Keep the action thin; delegate to a testable plain function.
4. Wire it into `registerCommands` in `src/commands/index.ts`.
5. Build and smoke-test: `--help` on the new command, plus one real invocation.

## Deeper reference

For the full option/argument/error API with more examples (every `Option`
method, config toggles like `enablePositionalOptions`/`passThroughOptions`,
`addCommand`, testing patterns), read `references/api-cheatsheet.md`.
