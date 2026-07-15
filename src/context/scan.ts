import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export interface IndexEntry {
  /** Etiqueta con la que se lista el ítem, p.e. "backend/architecture-boundaries.md". */
  label: string;
  description: string;
}

export interface RuleGroup {
  category: string;
  entries: IndexEntry[];
}

export interface ContextIndex {
  rules: RuleGroup[];
  guides: IndexEntry[];
  skills: IndexEntry[];
}

/**
 * Escanea el estado real del proyecto destino: qué reglas, guías y skills hay instaladas. Cada
 * fuente es best-effort — si la carpeta no existe (o no se puede leer) esa parte queda vacía, no es
 * un error: un proyecto puede tener solo reglas, o solo skills.
 */
export async function scanProject(cwd: string): Promise<ContextIndex> {
  const [rules, guides, skills] = await Promise.all([
    scanRules(cwd),
    scanGuides(cwd),
    scanSkills(cwd),
  ]);
  return { rules, guides, skills };
}

/** `docs/rules/<categoría>/*.md`, agrupadas por categoría, descripción del frontmatter. */
async function scanRules(cwd: string): Promise<RuleGroup[]> {
  const rulesDir = path.join(cwd, "docs", "rules");
  const categories = await listDirs(rulesDir);

  const groups: RuleGroup[] = [];
  for (const category of categories) {
    const dir = path.join(rulesDir, category);
    const files = await listMarkdown(dir);

    const entries: IndexEntry[] = [];
    for (const file of files) {
      const description = await readDescription(path.join(dir, file));
      entries.push({ label: `${category}/${file}`, description });
    }
    if (entries.length > 0) groups.push({ category, entries });
  }
  return groups;
}

/** `docs/guides/*.md`, con `title` (si lo hay) y `description` del frontmatter. */
async function scanGuides(cwd: string): Promise<IndexEntry[]> {
  const dir = path.join(cwd, "docs", "guides");
  const files = await listMarkdown(dir);

  const entries: IndexEntry[] = [];
  for (const file of files) {
    const meta = await readMeta(path.join(dir, file));
    const title = meta.title;
    entries.push({
      label: title ? `${file} (${title})` : file,
      description: meta.description ?? "",
    });
  }
  return entries;
}

/**
 * Entradas de `.claude/skills/`: carpetas de skills internas y symlinks a `.agents/skills/<name>`
 * de las externas. La descripción sale del frontmatter de `<name>/SKILL.md`, recortada a una línea.
 */
async function scanSkills(cwd: string): Promise<IndexEntry[]> {
  const dir = path.join(cwd, ".claude", "skills");

  let names: string[];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    names = dirents
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }

  const entries: IndexEntry[] = [];
  for (const name of names) {
    const description = await readDescription(path.join(dir, name, "SKILL.md"));
    entries.push({ label: name, description: truncate(description) });
  }
  return entries;
}

/** Nombres de subdirectorios ordenados; `[]` si la carpeta no existe. */
async function listDirs(dir: string): Promise<string[]> {
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    return dirents
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Ficheros `.md` ordenados; `[]` si la carpeta no existe. */
async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((file) => file.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

async function readMeta(file: string): Promise<Record<string, string>> {
  try {
    return parseFrontmatter(await readFile(file, "utf8"));
  } catch {
    return {};
  }
}

async function readDescription(file: string): Promise<string> {
  return (await readMeta(file)).description ?? "";
}

/** Recorta a una línea escaneable: primera frase o corte a ~140 chars. */
function truncate(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 140) return oneLine;
  return `${oneLine.slice(0, 139).trimEnd()}…`;
}
