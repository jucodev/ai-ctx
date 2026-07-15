/**
 * Bases con las que expandir los placeholders de path de las reglas.
 * Cadena vacía = quitar el placeholder (proyecto no monorepo, paths relativos a la raíz).
 */
export interface Bases {
  frontend: string;
  backend: string;
}

const FRONTEND_TOKEN = "{{frontend}}/";
const BACKEND_TOKEN = "{{backend}}/";

/**
 * Expande los placeholders `{{frontend}}` / `{{backend}}` que las reglas usan en lugar de rutas
 * concretas. Se aplica sobre el fichero completo: los placeholders viven en los globs del
 * frontmatter, pero también hay alguna ruta de ejemplo en el cuerpo. Los tokens son disjuntos, así
 * que el orden no importa; un fichero que solo use uno deja el otro reemplazo como no-op.
 */
export function rewritePaths(content: string, bases: Bases): string {
  return content
    .replaceAll(FRONTEND_TOKEN, prefix(bases.frontend))
    .replaceAll(BACKEND_TOKEN, prefix(bases.backend));
}

function prefix(base: string): string {
  return base ? `${base}/` : "";
}
