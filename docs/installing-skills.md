# Instalar skills externas desde `ai-ctx`

Este documento describe cómo `ai-ctx` debe instalar, de forma **desatendida** (sin
prompts interactivos), las skills externas declaradas en
[`skills.json`](./skills/skills.json), usando el CLI oficial
[`skills`](https://www.npmjs.com/package/skills) (`npx skills add`).

Es la referencia para implementar el comando `add-skills <categoría>`, que recorrerá
un bloque del JSON y ejecutará un `npx skills add ...` por cada skill.

> Verificado con `skills` **v1.5.16**.

---

## 1. De la URL de `skills.sh` al comando

Cada entrada del JSON es una URL de `skills.sh` con el patrón:

```
https://www.skills.sh/{owner}/{repo}/{skill}
                       └─────┬─────┘  └──┬──┘
                             │           └─ --skill {skill}
                             └─ https://github.com/{owner}/{repo}
```

- **Primeros dos segmentos** (`owner/repo`) → repositorio de GitHub.
- **Último segmento** (`skill`) → nombre de la skill (`--skill`).

No hace falta guardar el comando en el JSON: se **deriva** de la URL.

### Ejemplos

| URL en `skills.json` | `repo` derivado | `skill` derivado |
| --- | --- | --- |
| `.../anthropics/skills/skill-creator` | `https://github.com/anthropics/skills` | `skill-creator` |
| `.../vercel-labs/skills/find-skills` | `https://github.com/vercel-labs/skills` | `find-skills` |
| `.../wshobson/agents/typescript-advanced-types` | `https://github.com/wshobson/agents` | `typescript-advanced-types` |
| `.../greensock/gsap-skills/gsap-core` | `https://github.com/greensock/gsap-skills` | `gsap-core` |

---

## 2. El comando desatendido (el que usará la CLI)

```bash
npx -y skills add https://github.com/{owner}/{repo} \
  --skill {skill} \
  --agent claude-code \
  --project \
  --copy \
  --yes
```

En una línea (plantilla a generar por cada skill):

```bash
npx -y skills add https://github.com/{owner}/{repo} --skill {skill} --agent claude-code --project --copy --yes
```

### Qué responde cada flag

`skills add` es interactivo por defecto: pregunta agentes, scope, método de
instalación y una confirmación. Cada prompt tiene su flag equivalente, así que con
estos flags **no se selecciona nada**:

| Prompt interactivo | Flag | Valor elegido |
| --- | --- | --- |
| Additional agents | `--agent claude-code` | Solo Claude Code |
| Installation scope | `--project` | Proyecto (`./.claude/skills/`), no global |
| Installation method | `--copy` | Copia (ver §3) |
| Confirmación + security assessment | `--yes` | Aceptar |
| `npx` "¿instalo el paquete `skills`?" | `-y` (el de `npx`) | Sí |

**Resultado:** copia real de la skill en `./.claude/skills/{skill}/` dentro del
proyecto destino. La salida muestra `copy → Claude Code`.

### Notas de robustez

- **`--agent` usa el id `claude-code`**, no `claude`. `claude` da error
  `Invalid agents: claude`.
- **Cierra `stdin`** al lanzar el proceso (`stdio` sin stdin / `</dev/null`) como red
  de seguridad, por si una versión futura añade un prompt sin flag equivalente.
- **Ejecuta las skills en secuencia**, no en paralelo: comparten `skills-lock.json` y
  la salida se mezclaría.
- El comando se ejecuta con `cwd` = **proyecto destino** (por defecto
  `process.cwd()`, donde el usuario invoca `ai-ctx`).

---

## 3. Por qué `--copy` y no symlink

El CLI `skills` ofrece dos métodos de instalación:

- **Symlink** (recomendado por ellos): crea un almacén canónico compartido
  (`./.agents/skills/`, pseudo-agente `universal`) y enlaza cada agente hacia él.
- **Copy**: copia independiente dentro del directorio de cada agente.

Hallazgos tras probarlo a fondo:

- La lista **completa** de flags de `skills add` (v1.5.16) es:
  `agent, all, branch, copy, depth, force, full-depth, global, json, list,
  metadata, owner, project, skill, subagent, yes`.
  **No existe `--symlink` ni `--method`.** El único flag de método es `--copy`.
- El prompt "installation method" **solo aparece en modo interactivo**. En modo
  desatendido, con **un único agente** (`claude-code`), el método por defecto es
  **copy**.
- El **symlink solo se activa con un almacén canónico** (incluyendo el agente
  `universal`), es decir, en instalaciones multi-agente. **No es posible "solo Claude
  Code + symlink" de forma desatendida.**

**Decisión:** usamos `--copy` (explícito). Para el caso de uso de `ai-ctx` —copiar
config de IA a otros proyectos y **commitearla con el repo**— la copia es
preferible: es autocontenida, portable y no depende de un `./.agents/` canónico. El
symlink solo aporta cuando varios agentes comparten una copia en la misma máquina.

> Alternativa (solo si algún día se requiere symlink): añadir el agente `universal`
> (`--agent claude-code --agent universal --yes`), que crea el store canónico
> `./.agents/skills/`. Deja de ser "solo Claude Code".

---

## 4. Lanzarlo desde Node

```ts
import { spawn } from "node:child_process";

function addSkill(repoUrl: string, skill: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "-y", "skills", "add", repoUrl,
        "--skill", skill,
        "--agent", "claude-code",
        "--project",
        "--copy",
        "--yes",
      ],
      {
        cwd: targetDir,                          // proyecto destino
        stdio: ["ignore", "inherit", "inherit"], // sin stdin; log en vivo
        shell: process.platform === "win32",
      },
    );
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`skills add ${skill} salió con código ${code}`)),
    );
  });
}
```

Para `add-skills <categoría>`: lee el bloque cuyo `type` coincide, deriva
`repoUrl` + `skill` de cada URL (§1) y llama a `addSkill(...)` **en secuencia**.

---

## 5. Estructura de `skills.json`

Array de bloques; cada bloque agrupa skills por categoría:

```jsonc
[
  {
    "type": "common",          // categoría (argumento de `add-skills <categoría>`)
    "description": "...",       // texto informativo
    "list": [
      { "url": "https://www.skills.sh/anthropics/skills/skill-creator" }
    ]
  }
]
```

`add-skills common` instalaría todas las skills del bloque `type: "common"`.
