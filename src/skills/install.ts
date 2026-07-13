import { spawn } from "node:child_process";
import { access, cp } from "node:fs/promises";
import path from "node:path";

/** Las skills internas viajan en `dist/skills/` (ver scripts/copy-skills.mjs). */
const INTERNAL_SKILLS_DIR = new URL("./skills/", import.meta.url);

/** Donde `skills add --project --copy` deja las skills, y donde copiamos las internas. */
export function skillDir(cwd: string, name: string): string {
  return path.join(cwd, ".claude", "skills", name);
}

export async function isInstalled(cwd: string, name: string): Promise<boolean> {
  try {
    await access(skillDir(cwd, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Convierte el `command` del catálogo en su forma desatendida (docs/installing-skills.md §2).
 * Los comandos que no sean `npx skills add ...` se ejecutan tal cual.
 */
export function toUnattendedArgv(command: string): string[] {
  const tokens = command.split(/\s+/).filter(Boolean);
  const isSkillsAdd =
    tokens[0] === "npx" && tokens[1] === "skills" && tokens[2] === "add";
  if (!isSkillsAdd) return tokens;

  const rest = tokens.slice(3);
  const argv = ["npx", "-y", "skills", "add", ...rest];

  // `--agent claude-code`: el id correcto es `claude-code`, no `claude`.
  if (!rest.includes("--agent")) argv.push("--agent", "claude-code");
  if (!rest.includes("--project")) argv.push("--project");
  if (!rest.includes("--copy")) argv.push("--copy");
  if (!rest.includes("--yes")) argv.push("--yes");

  return argv;
}

export function runExternalSkill(command: string, cwd: string): Promise<void> {
  const [bin, ...args] = toUnattendedArgv(command);
  if (!bin) {
    return Promise.reject(new Error(`Comando vacío en el catálogo: "${command}"`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      // stdin cerrado: red de seguridad por si alguna versión añade un prompt sin flag.
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`\`${command}\` salió con código ${code}`));
    });
  });
}

export async function copyInternalSkill(skillPath: string, cwd: string): Promise<void> {
  const source = new URL(`${skillPath}/`, INTERNAL_SKILLS_DIR);
  await cp(source, skillDir(cwd, skillPath), { recursive: true, errorOnExist: true });
}
