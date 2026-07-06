import type { Command } from "commander";
import { registerHelloCommand } from "./hello.js";

/**
 * Registra todos los subcomandos de la CLI.
 * Añade aquí cada nuevo comando conforme lo vayas creando.
 */
export function registerCommands(program: Command): void {
  registerHelloCommand(program);
}
