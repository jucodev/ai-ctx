import { checkbox } from "@inquirer/prompts";
import type { Command } from "commander";

export interface Choice<T> {
  name: string;
  value: T;
}

export interface Summary {
  added: string[];
  skipped: string[];
  failed: string[];
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

export function reportSummary({ added, skipped, failed }: Summary): void {
  console.log();
  if (added.length > 0) console.log(`✓ Añadidas (${added.length}): ${added.join(", ")}`);
  if (skipped.length > 0) console.log(`• Ya existían (${skipped.length}): ${skipped.join(", ")}`);
  if (failed.length > 0) {
    console.log(`✗ Fallidas (${failed.length}): ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}
