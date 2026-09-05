#!/usr/bin/env node
/**
 * Upserts content/*.json into D1 `content_documents`.
 *
 *   npm run content:sync           # local Miniflare D1 (`npm run dev`)
 *   npm run content:sync -- --remote
 *
 * Edit the JSON by hand (or `npm run archive` for photos), then sync. The
 * site reads D1 through /api/content/* — it does not import the JSON into
 * the client bundle.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const KINDS = ["agenda", "speakers", "archive"];
const remote = process.argv.includes("--remote");

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function main() {
  const now = Date.now();
  const statements = KINDS.map((kind) => {
    const raw = readFileSync(join(ROOT, "content", `${kind}.json`), "utf8");
    JSON.parse(raw); // refuse to ship invalid JSON
    return (
      `INSERT INTO content_documents (kind, payload, updated_at) VALUES (${sqlString(kind)}, ${sqlString(raw)}, ${now})\n` +
      `ON CONFLICT(kind) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;`
    );
  });

  const dir = mkdtempSync(join(tmpdir(), "devfest-content-"));
  const file = join(dir, "sync.sql");
  writeFileSync(file, statements.join("\n") + "\n");

  const args = ["wrangler", "d1", "execute", "devfest-chennai-2026", "--file", file];
  if (remote) args.push("--remote");
  else args.push("--local");

  execFileSync("npx", args, { stdio: "inherit", cwd: ROOT });
  console.log(`\n  ✓ synced ${KINDS.join(", ")} → D1 (${remote ? "remote" : "local"})\n`);
}

main();
