import type { Command } from "commander";
import { registerAddSkillsCommand } from "./add-skills.js";
import { registerHelloCommand } from "./hello.js";

/**
 * Registra todos los subcomandos de la CLI.
 * Añade aquí cada nuevo comando conforme lo vayas creando.
 */
export function registerCommands(program: Command): void {
  registerHelloCommand(program);
  registerAddSkillsCommand(program);
}
