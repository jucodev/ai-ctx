import { checkbox } from "@inquirer/prompts";
import type { Command } from "commander";
import type { SkillEntry } from "../skills/catalog.js";
import { isInternal, loadCatalog, skillName } from "../skills/catalog.js";
import { copyInternalSkill, isInstalled, runExternalSkill } from "../skills/install.js";

interface Selected {
  name: string;
  entry: SkillEntry;
}

export function registerAddSkillsCommand(program: Command): void {
  program
    .command("add-skills")
    .description("Añade skills al proyecto actual")
    .action(async () => {
      if (!process.stdout.isTTY) {
        program.error("add-skills necesita un terminal interactivo (TTY).");
      }

      const catalog = await loadCatalog();

      let types: string[];
      try {
        types = await checkbox({
          message: "Selecciona las categorías de skills a añadir",
          choices: catalog.map((category) => ({
            name: `${category.type} — ${category.description}`,
            value: category.type,
          })),
        });
      } catch (error) {
        // Ctrl+C o stdin cerrado: salir en silencio, sin stack trace.
        if (error instanceof Error && error.name === "ExitPromptError") return;
        throw error;
      }

      if (types.length === 0) {
        console.log("No has seleccionado ninguna categoría. No se ha añadido nada.");
        return;
      }

      await installSkills(collectSkills(catalog, types));
    });
}

/** Aplana las categorías elegidas, deduplicando skills que aparezcan en varias. */
function collectSkills(
  catalog: Awaited<ReturnType<typeof loadCatalog>>,
  types: string[],
): Selected[] {
  const byName = new Map<string, SkillEntry>();

  for (const category of catalog) {
    if (!types.includes(category.type)) continue;
    for (const entry of category.list) {
      const name = skillName(entry);
      if (!byName.has(name)) byName.set(name, entry);
    }
  }

  return [...byName].map(([name, entry]) => ({ name, entry }));
}

/** Las skills se instalan en secuencia: comparten `skills-lock.json`. */
async function installSkills(skills: Selected[]): Promise<void> {
  const cwd = process.cwd();
  const added: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const { name, entry } of skills) {
    if (await isInstalled(cwd, name)) {
      skipped.push(name);
      continue;
    }

    try {
      if (isInternal(entry)) await copyInternalSkill(entry.path, cwd);
      else await runExternalSkill(entry.command, cwd);
      added.push(name);
    } catch (error) {
      failed.push(name);
      console.error(`✗ ${name}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log();
  if (added.length > 0) console.log(`✓ Añadidas (${added.length}): ${added.join(", ")}`);
  if (skipped.length > 0) console.log(`• Ya existían (${skipped.length}): ${skipped.join(", ")}`);
  if (failed.length > 0) {
    console.log(`✗ Fallidas (${failed.length}): ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}
