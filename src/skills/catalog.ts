import { readFile } from "node:fs/promises";

export interface ExternalSkill {
  url: string;
  command: string;
}

export interface InternalSkill {
  path: string;
}

export type SkillEntry = ExternalSkill | InternalSkill;

export interface SkillCategory {
  type: string;
  description: string;
  list: SkillEntry[];
}

/** El catálogo se copia a `dist/skills/` durante el build (scripts/copy-skills.mjs). */
const CATALOG_URL = new URL("./skills/skills.json", import.meta.url);

export async function loadCatalog(): Promise<SkillCategory[]> {
  const raw = await readFile(CATALOG_URL, "utf8");
  return JSON.parse(raw) as SkillCategory[];
}

export function isInternal(entry: SkillEntry): entry is InternalSkill {
  return "path" in entry;
}

/**
 * Nombre con el que la skill acaba en `.claude/skills/`: el `path` para las
 * internas, el último segmento de la URL para las externas (que coincide con el
 * valor de `--skill` de su `command`).
 */
export function skillName(entry: SkillEntry): string {
  if (isInternal(entry)) return entry.path;

  const segments = entry.url.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) {
    throw new Error(`No se puede derivar el nombre de la skill desde la URL: ${entry.url}`);
  }
  return last;
}
