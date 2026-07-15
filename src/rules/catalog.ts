import { readdir, readFile } from "node:fs/promises";

export interface RuleCategory {
  type: string;
  description: string;
  /** Nombres de fichero de la categoría, p.e. ["api-functions.md", ...]. */
  files: string[];
}

/** Las reglas y su catálogo se copian a `dist/rules/` durante el build (scripts/copy-assets.mjs). */
export const RULES_DIR = new URL("./rules/", import.meta.url);

const CATALOG_URL = new URL("rules.json", RULES_DIR);

interface CatalogEntry {
  type: string;
  description: string;
}

export async function loadCatalog(): Promise<RuleCategory[]> {
  const raw = await readFile(CATALOG_URL, "utf8");
  const entries = JSON.parse(raw) as CatalogEntry[];

  return Promise.all(
    entries.map(async ({ type, description }) => {
      const dirEntries = await readdir(new URL(`${type}/`, RULES_DIR));
      const files = dirEntries.filter((file) => file.endsWith(".md")).sort();
      return { type, description, files };
    }),
  );
}
