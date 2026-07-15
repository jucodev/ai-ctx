import type { Command } from "commander";
import { refreshContext } from "../context/write.js";

export function registerAddContextCommand(program: Command): void {
  program
    .command("add-context")
    .description("Genera/actualiza docs/app-context.md (índice del proyecto)")
    .action(async () => {
      await refreshContext(process.cwd());
      console.log("↻ app-context.md actualizado");
    });
}
