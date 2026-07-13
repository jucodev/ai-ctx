import { cp } from "node:fs/promises";

// El catálogo y las skills internas se leen en runtime, así que deben viajar
// dentro del paquete publicado (`files: ["dist"]`).
await cp(
  new URL("../docs/skills/", import.meta.url),
  new URL("../dist/skills/", import.meta.url),
  { recursive: true },
);
