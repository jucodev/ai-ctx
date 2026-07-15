import { cp } from "node:fs/promises";

// El catálogo, las skills internas y las guías se leen en runtime, así que deben
// viajar dentro del paquete publicado (`files: ["dist"]`).
for (const dir of ["skills", "guides"]) {
  await cp(
    new URL(`../docs/${dir}/`, import.meta.url),
    new URL(`../dist/${dir}/`, import.meta.url),
    { recursive: true },
  );
}
