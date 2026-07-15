/**
 * Lee el frontmatter `---` inicial y devuelve solo las claves escalares (una línea: `key: value`).
 * Los bloques de array (p.e. el `paths:` de las reglas, con `- item` en líneas siguientes) se
 * ignoran: la clave queda con valor vacío y sus ítems se saltan al no tener `:`. Interesan
 * `title`, `description` y `name`.
 */
export function parseFrontmatter(raw: string): Record<string, string> {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;
    if (line.trimStart().startsWith("-")) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    meta[key] = value.replace(/^["'](.*)["']$/, "$1");
  }
  return meta;
}
