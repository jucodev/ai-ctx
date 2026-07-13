import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

const program = new Command();

program
  .name("ai-ctx")
  .description("CLI para gestionar contexto de IA")
  .version("1.0.0");

registerCommands(program);

await program.parseAsync();
