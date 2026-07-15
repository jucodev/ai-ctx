import type { Command } from "commander";
import { refreshContext } from "../context/write.js";
import type { SkillCategory, SkillEntry } from "../skills/catalog.js";
import { isInternal, loadCatalog, skillName } from "../skills/catalog.js";
import { copyInternalSkill, isInstalled, runExternalSkill } from "../skills/install.js";
import { reportSummary, requireTty, select } from "../ui.js";

interface Selected {
  name: string;
  entry: SkillEntry;
}

export function registerAddSkillsCommand(program: Command): void {
  program
    .command("add-skills")
    .description("Añade skills al proyecto actual")
    .action(async () => {
      requireTty(program, "add-skills");

      const catalog = await loadCatalog();

      const types = await select(
        "Selecciona las categorías de skills a añadir",
        catalog.map((category) => ({
          name: `${category.type} — ${category.description}`,
          value: category.type,
        })),
      );
      if (!types) return;

      if (types.length === 0) {
        console.log("No has seleccionado ninguna categoría. No se ha añadido nada.");
        return;
      }

      await installSkills(collectSkills(catalog, types));
    });
}

/** Aplana las categorías elegidas, deduplicando skills que aparezcan en varias. */
function collectSkills(catalog: SkillCategory[], types: string[]): Selected[] {
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

  reportSummary({ added, skipped, failed });

  await refreshContext(cwd);
  console.log("↻ app-context.md actualizado");
}
