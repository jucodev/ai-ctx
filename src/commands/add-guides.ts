import type { Command } from "commander";
import { loadGuides } from "../guides/catalog.js";
import { copyGuide, isInstalled } from "../guides/install.js";
import { reportSummary, requireTty, select } from "../ui.js";

export function registerAddGuidesCommand(program: Command): void {
  program
    .command("add-guides")
    .description("Añade guías al proyecto actual")
    .action(async () => {
      requireTty(program, "add-guides");

      const guides = await loadGuides();

      const files = await select(
        "Selecciona las guías a añadir",
        guides.map((guide) => ({
          name: `${guide.title} — ${guide.description}`,
          value: guide.file,
        })),
      );
      if (!files) return;

      if (files.length === 0) {
        console.log("No has seleccionado ninguna guía. No se ha añadido nada.");
        return;
      }

      await installGuides(files);
    });
}

async function installGuides(files: string[]): Promise<void> {
  const cwd = process.cwd();
  const added: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const file of files) {
    if (await isInstalled(cwd, file)) {
      skipped.push(file);
      continue;
    }

    try {
      await copyGuide(file, cwd);
      added.push(file);
    } catch (error) {
      failed.push(file);
      console.error(`✗ ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }

  reportSummary({ added, skipped, failed });
}
