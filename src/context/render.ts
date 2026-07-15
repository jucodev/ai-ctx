import type { ContextIndex, IndexEntry } from "./scan.js";

/** Marcadores del bloque autogenerado. Solo lo que hay entre ellos se regenera en cada refresh. */
export const INDEX_START = "<!-- ai-ctx:index:start -->";
export const INDEX_END = "<!-- ai-ctx:index:end -->";

/** El bloque de índice, marcadores incluidos. Es lo único que `refreshContext` reescribe. */
export function renderIndexBlock(index: ContextIndex): string {
  const sections = [
    section("Rules (`docs/rules/`)", renderRules(index.rules)),
    section("Guides (`docs/guides/`)", renderList(index.guides)),
    section("Skills (`.claude/skills/`)", renderList(index.skills)),
  ];
  return [INDEX_START, "", sections.join("\n\n"), "", INDEX_END].join("\n");
}

function section(heading: string, body: string): string {
  return `### ${heading}\n\n${body}`;
}

/** El fichero completo la primera vez que se crea: intro + índice + preconfiguración estática. */
export function renderScaffold(index: ContextIndex): string {
  return [
    "# App Context",
    "",
    "Índice de lo que hay configurado en este proyecto y dónde acudir para cada cosa.",
    "El bloque de índice se regenera con `ai-ctx add-context`; edita libremente el resto.",
    "",
    renderIndexBlock(index),
    "",
    renderPreconfig(),
    "",
  ].join("\n");
}

function renderRules(groups: ContextIndex["rules"]): string {
  if (groups.length === 0) return EMPTY;
  return groups
    .map((group) => [`**${group.category}**`, "", renderList(group.entries)].join("\n"))
    .join("\n\n");
}

function renderList(entries: IndexEntry[]): string {
  if (entries.length === 0) return EMPTY;
  return entries.map((entry) => renderItem(entry)).join("\n");
}

function renderItem({ label, description }: IndexEntry): string {
  return description ? `- \`${label}\` — ${description}` : `- \`${label}\``;
}

const EMPTY = "_(vacío)_";

function renderPreconfig(): string {
  return [
    "## Preconfiguración",
    "",
    "Recomendaciones base para trabajar mejor en este proyecto:",
    "",
    "- **agent-browser**: tenlo instalado (https://github.com/vercel-labs/agent-browser) y úsalo",
    "  para cualquier QA que hagas.",
    "- **Backend**: consulta las skills de `@jucodev/backend-core` para desarrollar cualquier cosa",
    "  de backend.",
  ].join("\n");
}
