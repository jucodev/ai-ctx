import type { Command } from "commander";
import { refreshContext } from "../context/write.js";
import type { RuleCategory } from "../rules/catalog.js";
import { loadCatalog } from "../rules/catalog.js";
import { detectWorkspaces, installRule, isInstalled } from "../rules/install.js";
import type { Bases } from "../rules/rewrite.js";
import { promptText, reportSummary, requireTty, select } from "../ui.js";

export function registerAddRulesCommand(program: Command): void {
  program
    .command("add-rules")
    .description("Añade rules al proyecto actual")
    .action(async () => {
      requireTty(program, "add-rules");

      const catalog = await loadCatalog();

      const types = await select(
        "Selecciona las categorías de rules a añadir",
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

      const selected = catalog.filter((category) => types.includes(category.type));

      const bases = await resolveBases(selected);
      if (!bases) return;

      await installRules(selected, bases);
    });
}

/**
 * Las reglas heredan paths del monorepo original. En un monorepo destino se piden los paths base
 * de los proyectos afectados por la selección; si no lo es, las bases quedan vacías y los prefijos
 * se eliminan. `undefined` si el usuario aborta un prompt.
 */
async function resolveBases(selected: RuleCategory[]): Promise<Bases | undefined> {
  const bases: Bases = { frontend: "", backend: "" };

  if (!(await detectWorkspaces(process.cwd()))) return bases;

  const needsFrontend = selected.some((c) => c.type === "frontend" || c.type === "shared");
  const needsBackend = selected.some((c) => c.type === "backend" || c.type === "shared");

  if (needsFrontend) {
    const frontend = await promptText(
      "Path(s) del proyecto frontend, separa con coma si hay varios (p.e. apps/dashboard,apps/admin)",
    );
    if (frontend === undefined) return undefined;
    bases.frontend = toBase(frontend);
  }

  if (needsBackend) {
    const backend = await promptText(
      "Path(s) del proyecto backend, separa con coma si hay varios (p.e. apps/api,apps/worker)",
      { default: "apps/api" },
    );
    if (backend === undefined) return undefined;
    bases.backend = toBase(backend);
  }

  return bases;
}

/**
 * Convierte la entrada del usuario en el prefijo con el que se expande el placeholder. Un solo
 * path se usa tal cual; varios se envuelven en una brace-list glob (`{a,b}`), la misma forma que
 * el consumidor de las reglas ya interpreta. Cada path se normaliza quitando la `/` final.
 */
function toBase(raw: string): string {
  const paths = raw
    .split(",")
    .map((p) => p.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (paths.length <= 1) return paths[0] ?? "";
  return `{${paths.join(",")}}`;
}

/**
 * Las reglas se generan en secuencia. Re-ejecutar regenera las que ya existen con los paths
 * nuevos (así se incorpora un proyecto añadido después); se reportan aparte como actualizadas.
 */
async function installRules(selected: RuleCategory[], bases: Bases): Promise<void> {
  const cwd = process.cwd();
  const added: string[] = [];
  const updated: string[] = [];
  const failed: string[] = [];

  for (const { type, files } of selected) {
    for (const file of files) {
      const label = `${type}/${file}`;
      const existed = await isInstalled(cwd, type, file);

      try {
        await installRule(type, file, cwd, bases);
        (existed ? updated : added).push(label);
      } catch (error) {
        failed.push(label);
        console.error(`✗ ${label}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  reportSummary({ added, updated, skipped: [], failed });

  await refreshContext(cwd);
  console.log("↻ app-context.md actualizado");
}
