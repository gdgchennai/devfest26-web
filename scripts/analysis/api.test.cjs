/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks transpile the real TS modules and isolate offline test dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const model = require('../../lib/post-event-analysis.ts');
const schemas = require('../../lib/schemas.ts');
const agenda = require('../../content/agenda.json');
let access, records, queries, fail;
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/admin') return { requireAccessApi: async () => access };
  if (name === '@/lib/db') return { getDb: async () => ({ prepare(sql) { queries.push(sql); return { async all() { if (fail) throw new Error('offline'); return { results: records }; } }; } }) };
  if (name === '@/lib/post-event-analysis') return model;
  if (name === '@/lib/schemas') return schemas;
  if (name === '@/content/agenda.json') return agenda;
  return originalLoad.call(this, name, ...args);
};
const { GET } = require('../../app/api/admin/analysis/route.ts');
Module._load = originalLoad;
function reset() { access = { isSuper: true }; records = []; queries = []; fail = false; }
test('unauthenticated and track-scoped users cannot read whole-event audit', async () => {
  reset(); access = Response.json({ error: 'unauthorized' }, { status: 401 });
  assert.equal((await GET()).status, 401);
  assert.equal(queries.length, 0);
  access = { isSuper: false };
  assert.equal((await GET()).status, 403);
  assert.equal(queries.length, 0);
});
test('authorized endpoint only selects audit and display names, with no-store caching', async () => {
  reset(); records = [{ revision: 1, actor: 'lead', actor_name: 'Lead', changed_at: 1792207800000, payload: '{"kind":"occupancy","zone":"d7-auditorium","occupied":80}' }];
  const response = await GET(), body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.audit[0].payload.occupied, 80);
  assert.equal(body.actors.lead, 'Lead');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT /);
  assert.doesNotMatch(queries[0], /email|google_sub|INSERT|UPDATE|DELETE/);
});
test('refuses oversized histories instead of silently truncating', async () => {
  reset(); records = Array(50001).fill({});
  assert.equal((await GET()).status, 413);
});
test('database failures produce an actionable error without leaking details', async () => {
  reset(); fail = true;
  const response = await GET();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Import/);
});
