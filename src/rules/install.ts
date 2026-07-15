import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RULES_DIR } from "./catalog.js";
import type { Bases } from "./rewrite.js";
import { rewritePaths } from "./rewrite.js";

/** Las reglas aterrizan en `docs/rules/<categoría>/` de la raíz del proyecto destino. */
export function ruleDest(cwd: string, type: string, file: string): string {
  return path.join(cwd, "docs", "rules", type, file);
}

export async function isInstalled(cwd: string, type: string, file: string): Promise<boolean> {
  try {
    await access(ruleDest(cwd, type, file));
    return true;
  } catch {
    return false;
  }
}

export async function installRule(
  type: string,
  file: string,
  cwd: string,
  bases: Bases,
): Promise<void> {
  const source = await readFile(new URL(`${type}/${file}`, RULES_DIR), "utf8");
  const dest = ruleDest(cwd, type, file);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, rewritePaths(source, bases));
}

/**
 * Monorepo si el `package.json` de la raíz declara `workspaces` (array de npm/yarn o el
 * `{ packages: [...] }` de algunas configuraciones). Sin `package.json` legible → no monorepo.
 */
export async function detectWorkspaces(cwd: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { workspaces?: unknown };
    const { workspaces } = pkg;
    if (Array.isArray(workspaces)) return workspaces.length > 0;
    if (workspaces && typeof workspaces === "object") {
      const packages = (workspaces as { packages?: unknown }).packages;
      return Array.isArray(packages) && packages.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}
