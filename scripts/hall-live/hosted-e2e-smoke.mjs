// Local integration rehearsal only: synthetic auth fixture, committed coordinator,
// isolated D1/DO, full runner scheduling, observer delivery, audit and restoration.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const exec = promisify(execFile);
const injectDrop = process.argv.includes("--inject-drop");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hall-e2e-smoke-"));
fs.chmodSync(dir, 0o700);
const { stdout: source } = await exec("git", [
  "show",
  "HEAD:workers/hall-live/index.ts",
]);
const bundled = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
 import {HallCoordinator as Base} from './workers/hall-live/index.ts';
 export class HallCoordinator extends Base { accepted=0; subscribe(r){ const response=super.subscribe(r); if (${injectDrop} && ++this.accepted===1) { const ws=this.ctx.getWebSockets().at(-1); ws.close(1011,'Local recovery probe'); } return response; } }
 export default {async fetch(r,env){
  const u=new URL(r.url), stub=env.HALL.get(env.HALL.idFromName('smoke'));
  if(u.pathname==='/test/audit'){return Response.json((await env.DB.prepare("SELECT revision,actor,json_extract(payload,'$.sequence') sequence,json_extract(payload,'$.zone') zone,json_extract(payload,'$.phase') phase FROM hall_audit WHERE json_extract(payload,'$.loadTest')=? ORDER BY revision").bind(u.searchParams.get('runId')).all()).results);}
  if(u.pathname==='/api/halls'||u.pathname==='/api/halls/socket'){u.pathname=u.pathname.endsWith('socket')?'/socket':'/snapshot';return stub.fetch(new Request(u,r));}
  if(u.pathname==='/api/admin/halls'){
   const id=r.headers.get('cookie')?.match(/authjs.session-token=(fixture-[123])/)[1];if(!id)return new Response(null,{status:401});
   const actor={id,organizer:true,zones:['d7-auditorium','agent-wars']};
   if(r.method==='GET'){u.pathname='/access';return stub.fetch(new Request(u,{method:'POST',body:JSON.stringify(actor)}));}
   if(r.headers.get('origin')!==u.origin)return new Response(null,{status:403});
   u.pathname='/write';return stub.fetch(new Request(u,{method:'POST',body:JSON.stringify({actor,mutation:await r.json()})}));
  }
  return new Response(null,{status:404});
 }};`,
  },
  plugins: [
    {
      name: "committed-coordinator",
      setup(b) {
        b.onLoad({ filter: /workers\/hall-live\/index\.ts$/ }, () => ({
          contents: source,
          loader: "ts",
        }));
      },
    },
  ],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:workers"],
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    host: "127.0.0.1",
    port: 8787,
    workers: [
      {
        name: "smoke",
        modules: true,
        script: bundled.outputFiles[0].text,
        compatibilityDate: "2026-10-01",
        d1Databases: { DB: "smoke" },
        durableObjects: {
          HALL: { className: "HallCoordinator", useSQLite: true },
        },
      },
    ],
  }),
);
try {
  await mf.ready;
  const db = await mf.getD1Database("DB");
  for (const file of [
    "migrations/0014_hall_live.sql",
    "migrations/0015_hall_manual_sessions.sql",
  ]) {
    const sql = fs.readFileSync(file, "utf8").replace(/^--.*$/gm, "");
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
  await db.batch(
    ["d7-auditorium", "agent-wars"].map((zone) =>
      db
        .prepare("INSERT INTO hall_occupancy VALUES(?,48,0,0,?)")
        .bind(zone, "fixture"),
    ),
  );
  fs.writeFileSync(
    path.join(dir, "halls-before.sql"),
    "-- Isolated local fixture backup\n",
    { mode: 0o600 },
  );
  const sessions = [];
  for (let n = 1; n <= 3; n++) {
    const cookieFile = path.join(dir, `actor-${n}.cookie`);
    fs.writeFileSync(cookieFile, `authjs.session-token=fixture-${n}`, {
      mode: 0o600,
    });
    sessions.push({ cookieFile });
  }
  const manifest = path.join(dir, "organizers.json");
  fs.writeFileSync(manifest, JSON.stringify({ sessions }), { mode: 0o600 });
  const output = "/tmp/hall-hosted-e2e-smoke.json";
  try {
    const r = await exec(
      process.execPath,
      [
        "scripts/hall-live/hosted-e2e.mjs",
        manifest,
        dir,
        output,
        "--local-smoke",
      ],
      { maxBuffer: 1024 * 1024 },
    );
    console.log(r.stdout);
  } catch (e) {
    console.log(e.stdout);
    if (!injectDrop)
      throw Error("Local end-to-end smoke runner failed; inspect its report");
  }
  const report = JSON.parse(fs.readFileSync(output, "utf8"));
  if (injectDrop)
    assert.ok(
      report.setupRecoveredAfterDrop === 1 || report.unexpectedCloses === 1,
      "The injected setup disconnect must be observed and recovered",
    );
  assert.equal(report.committedUpdates, 12);
  assert.equal(report.convergedAfterWrites, 20);
  assert.equal(report.occupancyValuesRestored, true);
  assert.equal(report.lifecycleUnchanged, true);
  assert.equal(report.missedContinuousDeliveries, 0);
  assert.equal(report.remainingSockets, 0);
  console.log(
    "Local scheduling, authenticated fixture routing, audit, reconnect, every-revision delivery and guarded restoration passed.",
  );
} finally {
  await mf.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
}
