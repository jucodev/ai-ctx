import { checkbox, input } from "@inquirer/prompts";
import type { Command } from "commander";

export interface Choice<T> {
  name: string;
  value: T;
}

export interface Summary {
  added: string[];
  skipped: string[];
  failed: string[];
  /** Ficheros que ya existían y se han regenerado. */
  updated?: string[];
}

export function requireTty(program: Command, commandName: string): void {
  if (!process.stdout.isTTY) {
    program.error(`${commandName} necesita un terminal interactivo (TTY).`);
  }
}

/** Multi-selector: Space marca, ↑↓ mueven, Enter confirma. `undefined` si el usuario aborta. */
export async function select<T>(
  message: string,
  choices: Choice<T>[],
): Promise<T[] | undefined> {
  try {
    return await checkbox({ message, choices });
  } catch (error) {
    // Ctrl+C o stdin cerrado: salir en silencio, sin stack trace.
    if (error instanceof Error && error.name === "ExitPromptError") return undefined;
    throw error;
  }
}

/**
 * Pide una línea de texto no vacía. Devuelve el valor trimeado, o `undefined` si el usuario aborta
 * (Ctrl+C / stdin cerrado), sin stack trace.
 */
export async function promptText(
  message: string,
  opts: { default?: string } = {},
): Promise<string | undefined> {
  try {
    const value = await input({
      message,
      default: opts.default,
      validate: (raw) => raw.trim().length > 0 || "No puede estar vacío.",
    });
    return value.trim();
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") return undefined;
    throw error;
  }
}

export function reportSummary({ added, skipped, failed, updated = [] }: Summary): void {
  console.log();
  if (added.length > 0) console.log(`✓ Añadidas (${added.length}): ${added.join(", ")}`);
  if (updated.length > 0) console.log(`↻ Actualizadas (${updated.length}): ${updated.join(", ")}`);
  if (skipped.length > 0) console.log(`• Ya existían (${skipped.length}): ${skipped.join(", ")}`);
  if (failed.length > 0) {
    console.log(`✗ Fallidas (${failed.length}): ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}
