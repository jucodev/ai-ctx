# commander.js API cheatsheet

Deeper reference for `commander-cli`. Read the section you need; don't load the
whole thing unless you're doing something broad.

## Contents
- [Program setup](#program-setup)
- [Commands](#commands)
- [Arguments](#arguments)
- [Options — string form](#options--string-form)
- [Options — Option class](#options--option-class)
- [Coercion / custom processing](#coercion--custom-processing)
- [Actions](#actions)
- [Help](#help)
- [Errors & exit](#errors--exit)
- [Hooks](#hooks)
- [Parsing config toggles](#parsing-config-toggles)
- [Testing patterns](#testing-patterns)
- [Common pitfalls](#common-pitfalls)

## Program setup

```ts
import { Command } from "commander";
const program = new Command();
program.name("my-cli").description("...").version("1.2.3", "-V, --version");
```

- `.version(str, flags?, description?)` — customizes the version flag.
- Prefer `program.parseAsync(argv?)` when any action is async; else `.parse()`.
- `.parse()` defaults to `process.argv`. For custom argv:
  `.parse(["build", "x"], { from: "user" })`.

## Commands

```ts
const build = program.command("build");           // returns the subcommand
program.command("serve <dir>", "start server");    // desc as 2nd arg => external exe
program.addCommand(makeBuildCommand());            // attach a pre-built Command
```

- `.command("name")` returns the **new** command; further chaining configures the
  subcommand, not the parent. `.addCommand(cmd)` attaches one you built elsewhere
  (good for the per-file module pattern; return a `Command` from the module).
- `.alias("b")` adds an alias. `.summary()` sets the short one-liner shown in the
  parent's command list (vs full `.description()`).
- Default command: `.command("start", { isDefault: true })`.
- Hidden command: `.command("internal", { hidden: true })`.

## Arguments

```ts
program.command("copy")
  .argument("<source>", "source path")
  .argument("[dest]", "destination", "./")           // optional w/ default
  .argument("<files...>", "files", parseList);        // variadic (must be last)
```

- `<x>` required, `[x]` optional, `x...` variadic.
- 3rd arg is a parser fn, 4th is the default.
- `.arguments("<a> [b]")` declares several at once (no per-arg description).

## Options — string form

```ts
.option("-d, --debug", "boolean flag")
.option("-p, --port <number>", "required value")
.option("-c, --cheese [type]", "optional value")
.option("-p, --port <n>", "with default", "3000")
.option("--no-color", "negate a default-true boolean")
.requiredOption("-u, --user <name>", "must be provided")
```

- Value placeholder `<>` required, `[]` optional, absent = boolean.
- camelCase mapping: `--dry-run` → `opts().dryRun`.
- Repeated boolean short flags combine: `-vvv`.
- `--no-x` sets `x` to false; if `x` also takes a value elsewhere, the negated
  form yields `false` — test with `=== false`.

## Options — Option class

`.addOption(new Option(...))` unlocks:

```ts
new Option("-d, --drink <size>").choices(["small", "medium", "large"])
new Option("-p, --port <n>").env("PORT")            // fallback to env var
new Option("--timeout <s>").default(60, "one minute") // default + help label
new Option("--donate [amt]").preset("20").argParser(parseFloat) // preset when flag given w/o value
new Option("--secret").hideHelp()
new Option("--disable-server").conflicts("port")     // mutually exclusive
new Option("--free-drink").implies({ drink: "small" }) // sets another option
new Option("-c, --cheese <type>").makeOptionMandatory() // == requiredOption
```

Resolution priority (highest first): CLI > env > config default > preset/default.

## Coercion / custom processing

Parser signature: `(value: string, previous: T) => T`. Throw
`InvalidArgumentError` (import from commander) for bad input.

```ts
import { InvalidArgumentError } from "commander";

const myParseInt = (v: string) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new InvalidArgumentError("Not a number.");
  return n;
};
const increaseVerbosity = (_: string, prev: number) => prev + 1;
const collect = (v: string, prev: string[]) => prev.concat([v]);
const commaList = (v: string) => v.split(",");

program
  .option("-i, --integer <n>", "int", myParseInt)
  .option("-v, --verbose", "repeatable", increaseVerbosity, 0)  // -vvv => 3
  .option("-c, --collect <val>", "repeatable", collect, [])
  .option("-l, --list <items>", "comma list", commaList);
```

`InvalidArgumentError` is the current name; `InvalidOptionArgumentError` is
deprecated but works on options.

## Actions

Signature: `(...args, options, command)`.

```ts
program.command("greet")
  .argument("<name>")
  .option("-l, --loud")
  .action((name: string, options: { loud?: boolean }, command: Command) => {
    // command.opts(), command.args, command.optsWithGlobals()
  });
```

- `command.optsWithGlobals()` merges parent (global) options with local ones.
- Async: return a promise, call `program.parseAsync()`.
- Access parent program options from a subcommand action via
  `command.parent?.opts()` or `optsWithGlobals()`.

## Help

- Auto-generated from name/description/options/arguments.
- `.addHelpText("beforeAll" | "before" | "after" | "afterAll", strOrFn)` — inject
  examples/notes. The fn form receives `{ error, command }`.
- `.helpOption("-h, --help", "show help")` / `.helpOption(false)` to disable.
- `.showHelpAfterError("(add --help for usage)")` — help/hint after usage errors.
- `.configureHelp({ sortSubcommands: true, ... })` — tweak formatting.
- `program.help()` / `command.help()` prints help and exits;
  `.helpInformation()` returns it as a string.

## Errors & exit

```ts
program.error("Something went wrong", { exitCode: 2, code: "my.error" });
program.exitOverride();              // throw CommanderError instead of exiting
program.showSuggestionAfterError();  // "did you mean --foo?"
program.configureOutput({
  writeErr: (str) => process.stderr.write(`[cli] ${str}`),
});
```

- `CommanderError` has `.code` (e.g. `commander.missingArgument`) and `.exitCode`.
- With `exitOverride`, `--help`/`--version` also throw (with `.exitCode` 0) —
  handle those codes gracefully.

## Hooks

```ts
program.hook("preAction", (thisCommand, actionCommand) => {});
program.hook("postAction", (thisCommand, actionCommand) => {});
program.hook("preSubcommand", (thisCommand, subcommand) => {});
```

Hooks may be async (awaited under `parseAsync`). Register on the program (or any
command) to cover it and its subcommands.

## Parsing config toggles

- `.enablePositionalOptions()` — allow options after positional args to be parsed
  by subcommands (lets a global `--verbose` precede the subcommand and a
  same-named local one follow it).
- `.passThroughOptions()` — stop parsing unknown options as commander's once a
  positional arg is seen; pass the rest through to the action (useful when
  wrapping another tool).
- `.allowUnknownOption()` / `.allowExcessArguments(false)`.
- `.storeOptionsAsProperties(false)` is the modern default (options live on
  `opts()`, not on the command instance).

## Testing patterns

Build a fresh `Command` per test, use `exitOverride`, and capture output via
`configureOutput`. Parse with `{ from: "user" }`.

```ts
function makeProgram() {
  const p = new Command();
  p.exitOverride();
  p.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerCommands(p);
  return p;
}

// await makeProgram().parseAsync(["greet", "Sam"], { from: "user" });
// expect a thrown CommanderError for bad input.
```

Because the recommended structure delegates real work to plain functions,
prefer unit-testing those directly and reserve commander-level tests for
parsing/validation/dispatch.

## Common pitfalls

- **`.parse()` with an async action** — the process may exit before the promise
  settles. Use `parseAsync`.
- **Chaining onto `.command()` expecting the parent** — `.command()` returns the
  *subcommand*. Capture the program separately if you need to keep configuring it.
- **Validating inside the action instead of a parser** — side effects can run
  before validation; errors look like crashes. Validate in the parser and throw
  `InvalidArgumentError`.
- **Missing `.js` extension in ESM/NodeNext imports** — type check and build fail.
- **Reading options off the command instance** — use `opts()` /
  `optsWithGlobals()`, not properties.
- **Forgetting to wire a new command into the registration hub** — the file
  exists but the command never appears.
