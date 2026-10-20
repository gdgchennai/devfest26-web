/** Explicit read-only hosted export. Importing this module never contacts Cloudflare. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const query = "SELECT a.revision, a.actor, a.changed_at, a.payload, COALESCE(NULLIF(u.display_name,''),NULLIF(u.name,''),a.actor) AS actor_name FROM hall_audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.revision LIMIT 50001";
export function buildExport(envelopes, agenda) {
  if (!Array.isArray(envelopes) || envelopes.length !== 1 || envelopes[0].success !== true || !Array.isArray(envelopes[0].results)) throw new Error("Cloudflare did not return a successful audit SELECT. Existing export was retained.");
  const rows = envelopes[0].results;
  if (rows.length > 50_000) throw new Error("History exceeds the dashboard's 50,000-record import limit; export a bounded period with lifecycle context instead.");
  const actors = Object.fromEntries(rows.map((r) => [r.actor, r.actor_name || r.actor]));
  const audit = rows.map(({ revision, actor, changed_at, payload }) => ({ revision, actor, changed_at, payload: typeof payload === "string" ? JSON.parse(payload) : payload }));
  return { audit, agenda, actors, source: "Read-only hosted D1 export", exportedAt: new Date().toISOString() };
}
export async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) throw new Error("Usage: npm run analysis:pull [-- --dry-run]");
  const output = resolve(root, ".wrangler/post-event-analysis/history.json");
  if (dryRun) {
    console.log(`Read-only SELECT from devfest-chennai-2026 using workers/hall-live/wrangler.jsonc.\n${query}\nOutput: ${output}\nDry run: no Cloudflare request or file write.`);
    return;
  }
  console.log("Reading hosted hall audit history. No database writes or deployments.");
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("wrangler/package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const cli = resolve(dirname(pkgPath), typeof pkg.bin === "string" ? pkg.bin : pkg.bin.wrangler);
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [cli, "d1", "execute", "devfest-chennai-2026", "--remote", "--config", "workers/hall-live/wrangler.jsonc", "--command", query, "--json"], { cwd: root, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024, timeout: 120_000 });
  } catch {
    throw new Error("Cloudflare read failed. Check Wrangler login/permissions (npx wrangler login). Existing export was retained.");
  }
  const agenda = JSON.parse(await readFile(resolve(root, "content/agenda.json"), "utf8"));
  const bundle = buildExport(JSON.parse(stdout), agenda);
  const json = JSON.stringify(bundle, null, 2);
  if (Buffer.byteLength(json) > 10 * 1024 * 1024) throw new Error("Export exceeds the dashboard's 10 MiB import limit. Existing export was retained.");
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, json, { mode: 0o600, flag: "wx" });
  await rename(temporary, output);
  console.log(`Saved ${bundle.audit.length} audit records to ${output}\nOpen /admin/analysis on localhost and choose Import audit JSON. The file is git-ignored; no hosted state was changed.`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
