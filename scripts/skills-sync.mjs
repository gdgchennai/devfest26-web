#!/usr/bin/env node
/**
 * Keeps `.agents/skills/` a mirror of `.claude/skills/`.
 *
 *   npm run skills:sync    # copy .claude/skills over .agents/skills (removes files that no longer exist)
 *   npm run skills:check   # fail if the two differ
 *
 * Why two copies: Claude Code (and Cursor, as a compatibility path) read `.claude/skills/`;
 * Antigravity reads `.agents/skills/` and doesn't look in `.claude/`. A symlink would be one
 * copy, but git on Windows only checks symlinks out as real links with Developer Mode on, so we
 * commit a plain copy instead. `.claude/skills/` is the source: edit there, then run `skills:sync`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, ".claude/skills");
const DEST = join(ROOT, ".agents/skills");
const check = process.argv.includes("--check");

/** Every file under `dir`, as a sorted list of paths relative to it (forward slashes). */
function files(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else found.push(relative(dir, p).split(sep).join("/"));
    }
  })(dir);
  return found.sort();
}

// Compare text ignoring line endings, so a CRLF checkout on Windows isn't reported as drift.
const text = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const src = files(SRC);
const dest = files(DEST);
const missing = src.filter((f) => !dest.includes(f));
const stale = dest.filter((f) => !src.includes(f));
const changed = src.filter((f) => dest.includes(f) && text(join(SRC, f)) !== text(join(DEST, f)));

if (check) {
  if (!missing.length && !stale.length && !changed.length) {
    console.log(`skills:check OK — .agents/skills matches .claude/skills (${src.length} files).`);
    process.exit(0);
  }
  console.error("skills:check FAILED — .agents/skills is out of step with .claude/skills:");
  for (const f of missing) console.error(`  missing  ${f}`);
  for (const f of changed) console.error(`  differs  ${f}`);
  for (const f of stale) console.error(`  stale    ${f}`);
  console.error("Edit .claude/skills, then run `npm run skills:sync`.");
  process.exit(1);
}

for (const f of stale) rmSync(join(DEST, f));
for (const f of [...missing, ...changed]) {
  mkdirSync(join(DEST, f, ".."), { recursive: true });
  copyFileSync(join(SRC, f), join(DEST, f));
}
// Drop skill folders emptied by the removals above.
for (const name of existsSync(DEST) ? readdirSync(DEST) : []) {
  const p = join(DEST, name);
  if (statSync(p).isDirectory() && files(p).length === 0) rmSync(p, { recursive: true });
}
console.log(`skills:sync — ${missing.length} added, ${changed.length} updated, ${stale.length} removed (${src.length} files in total).`);
