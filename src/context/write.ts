import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { INDEX_END, INDEX_START, renderIndexBlock, renderScaffold } from "./render.js";
import { scanProject } from "./scan.js";

/** El índice vivo del proyecto aterriza en `docs/app-context.md` de la raíz destino. */
export function contextDest(cwd: string): string {
  return path.join(cwd, "docs", "app-context.md");
}

/**
 * Regenera el bloque de índice de `docs/app-context.md` a partir del estado real del proyecto.
 *
 * - Fichero ausente → se crea el scaffold completo (índice + preconfiguración).
 * - Fichero con marcadores → se sustituye solo lo que hay entre ellos; preconfig y notas manuales
 *   quedan intactas.
 * - Fichero sin marcadores (editado a mano) → se inserta el bloque arriba conservando el resto.
 */
export async function refreshContext(cwd: string): Promise<void> {
  const index = await scanProject(cwd);
  const block = renderIndexBlock(index);
  const dest = contextDest(cwd);

  const existing = await readIfPresent(dest);

  let next: string;
  if (existing === undefined) {
    next = renderScaffold(index);
  } else if (existing.includes(INDEX_START) && existing.includes(INDEX_END)) {
    next = replaceBlock(existing, block);
  } else {
    next = `${block}\n\n${existing}`;
  }

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, next);
}

async function readIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

/** Reemplaza el contenido entre los marcadores (incluidos) por el bloque nuevo. */
function replaceBlock(content: string, block: string): string {
  const start = content.indexOf(INDEX_START);
  const end = content.indexOf(INDEX_END) + INDEX_END.length;
  return content.slice(0, start) + block + content.slice(end);
}
