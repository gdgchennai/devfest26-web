import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Lists the brand-shape SVGs in public/brand-shapes, as public URLs.
 *
 * Server-only (reads the filesystem) — call it from a Server Component and
 * pass the result down as a prop; never import this into a "use client"
 * file. Whatever's in that folder is what ships, so adding or removing an
 * SVG there is the entire authoring step, no manifest to keep in sync.
 */
export function getBrandShapes(): string[] {
  const dir = join(process.cwd(), "public", "brand-shapes");
  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".svg"))
    .sort()
    .map((file) => `/brand-shapes/${file}`);
}
