import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const dataModule = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const imports = {
  "server-only": "",
  "@opennextjs/cloudflare":
    "export const getCloudflareContext = async () => ({env:globalThis.__hallAccess.env});",
  "@/auth": "export const auth = async () => globalThis.__hallAccess.session;",
  "@/lib/admin":
    'export const getAccess = async () => globalThis.__hallAccess.access; export const manageableTracks = a => a.isSuper ? ["d7-auditorium","d7-amphitheater"] : [...a.roles.keys()]; export const grantableTracks = a => a.isSuper ? ["d7-auditorium","d7-amphitheater"] : [...a.roles].filter(([,r]) => r === "admin").map(([t]) => t);',
};
const compiled = ts
  .transpileModule(fs.readFileSync("lib/hall-access.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(/(?:from\s+|import\s+)["']([^"']+)["']/g, (match, id) =>
    match.replace(
      id,
      dataModule(
        imports[id] ??
          (() => {
            throw Error(id);
          })(),
      ),
    ),
  );
const previous = process.env.NEXT_PUBLIC_HALL_ISOLATED;
globalThis.__hallAccess = {
  env: {},
  session: { user: { uid: "real-user" } },
  access: null,
};
try {
  delete process.env.NEXT_PUBLIC_HALL_ISOLATED;
  const { hallActor } = await import(dataModule(compiled));
  const req = new Request("https://event.example/api/admin/halls", {
    headers: { cookie: "hall-dev=organizer", "x-role": "organizer" },
  });
  assert.equal(
    await hallActor(req),
    null,
    "fixture cookie cannot grant production access",
  );
  for (const role of ["admin", "track_lead"]) {
    globalThis.__hallAccess.access = {
      isSuper: false,
      roles: new Map([["d7-auditorium", role]]),
    };
    const actor = await hallActor(req);
    assert.equal(actor.organizer, false);
    assert.deepEqual(actor.zones, ["d7-auditorium"]);
    assert.deepEqual(
      actor.adminZones,
      role === "admin" ? ["d7-auditorium"] : [],
    );
  }
  globalThis.__hallAccess.access = { isSuper: true, roles: new Map() };
  assert.equal((await hallActor(req)).organizer, true);
  process.env.NEXT_PUBLIC_HALL_ISOLATED = "1";
  assert.equal(
    await hallActor(req),
    null,
    "isolated build fails closed without runtime opt-in",
  );
  globalThis.__hallAccess.env = { HALL_LOCAL_TEST: "1" };
  assert.equal(
    await hallActor(req),
    null,
    "remote host cannot use fixture role",
  );
  assert.equal(
    (
      await hallActor(
        new Request("http://127.0.0.1:8787/", {
          headers: { cookie: "hall-dev=organizer" },
        }),
      )
    ).organizer,
    true,
  );
  console.log(
    "Access adapter: production super/admin/lead mapping, forged cookie/header rejection, runtime and host gates passed.",
  );
} finally {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_HALL_ISOLATED;
  else process.env.NEXT_PUBLIC_HALL_ISOLATED = previous;
  delete globalThis.__hallAccess;
}
