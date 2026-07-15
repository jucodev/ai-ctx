import { readdir, readFile } from "node:fs/promises";

export interface Guide {
  /** Nombre del fichero, p.e. "i18n-guide.md". */
  file: string;
  title: string;
  description: string;
}

/** Las guías se copian a `dist/guides/` durante el build (scripts/copy-assets.mjs). */
export const GUIDES_DIR = new URL("./guides/", import.meta.url);

export async function loadGuides(): Promise<Guide[]> {
  const entries = await readdir(GUIDES_DIR);
  const files = entries.filter((file) => file.endsWith(".md")).sort();

  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(new URL(file, GUIDES_DIR), "utf8");
      const meta = parseFrontmatter(raw);
      return {
        file,
        title: meta.title ?? file,
        description: meta.description ?? "",
      };
    }),
  );
}

/** Lee el frontmatter `---` inicial. Solo interesan `title` y `description`. */
function parseFrontmatter(raw: string): Record<string, string> {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    meta[key] = value.replace(/^["'](.*)["']$/, "$1");
  }
  return meta;
}
