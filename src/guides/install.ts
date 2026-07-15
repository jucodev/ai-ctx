import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { GUIDES_DIR } from "./catalog.js";

/** Las guías aterrizan en `docs/guides/` de la raíz del proyecto destino. */
export function guideDest(cwd: string, file: string): string {
  return path.join(cwd, "docs", "guides", file);
}

export async function isInstalled(cwd: string, file: string): Promise<boolean> {
  try {
    await access(guideDest(cwd, file));
    return true;
  } catch {
    return false;
  }
}

export async function copyGuide(file: string, cwd: string): Promise<void> {
  const dest = guideDest(cwd, file);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(new URL(file, GUIDES_DIR), dest);
}
