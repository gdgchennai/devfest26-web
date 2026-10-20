/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks transpile the real TS modules and isolate offline test dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
// Exercise the actual pure TypeScript module without adding a test/runtime dependency.
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const m = require('../../lib/post-event-analysis.ts');
const t = (minute) => m.istTime('2026-10-17T09:00') + minute * m.MINUTE;
const agenda = [{ id: 'talk', title: 'Talk', track: 'd7-auditorium', hall: 'D7', start: '2026-10-17T09:00:00+05:30', end: '2026-10-17T10:00:00+05:30', type: 'talk', speakerSlugs: [], prerequisites: [] }];
const row = (revision, minute, payload, actor = 'lead') => ({ revision, changed_at: t(minute), actor, payload });
const start = (rev, minute = 0) => row(rev, minute, { kind: 'session', zone: 'd7-auditorium', session: 'talk', status: 'started' });
const end = (rev, minute = 60) => row(rev, minute, { kind: 'session', zone: 'd7-auditorium', session: 'talk', status: 'ended' });
const reading = (rev, minute, occupied, actor) => row(rev, minute, { kind: 'occupancy', zone: 'd7-auditorium', occupied }, actor);
const data = (audit) => m.parseAnalysisData(audit, agenda, 'test');
const settings = (changes = {}) => ({ ...m.defaultSettings, freshness: 5, maxGap: 10, ...changes });
test('uses IST independently of the computer timezone', () => {
  assert.equal(new Date(t(0)).toISOString(), '2026-10-17T03:30:00.000Z');
  assert.equal(m.istInput(t(0)), '2026-10-17T09:00');
});
test('imports raw, Wrangler and bundle formats without losing payload values', () => {
  const audit = [start(1), { ...reading(2, 1, 80), payload: JSON.stringify(reading(2, 1, 80).payload) }];
  assert.equal(data(audit).audit[1].payload.occupied, 80);
  assert.equal(data([{ results: audit, success: true }]).audit.length, 2);
  assert.equal(m.parseAnalysisData({ audit, agenda, actors: { lead: 'A' } }, [], 'test').actors.lead, 'A');
});
test('rejects duplicates, unsupported mutations and invalid percentages', () => {
  assert.throws(() => data([start(1), start(1)]), /Duplicate/);
  assert.throws(() => data([reading(1, 0, 101)]), /Invalid/);
  assert.throws(() => data([row(1, 0, { kind: 'surprise' })]), /unsupported/);
});
test('replays context before a custom range and clips coverage to it', () => {
  const result = m.analyze(data([start(1), reading(2, 8, 80), end(3)]), settings({ start: '2026-10-17T09:10', end: '2026-10-17T09:20' }));
  assert.equal(result.readings.length, 0);
  assert.equal(result.segments[0].start, t(10));
  assert.equal(result.segments[0].end, t(13));
  assert.equal(result.coverage, 30);
});
test('freshness gaps are unknown and averages use covered time only', () => {
  const result = m.analyze(data([start(1), reading(2, 0, 80), reading(3, 20, 20), end(4)]), settings());
  assert.ok(Math.abs(result.coverage - 100 / 6) < 0.00001);
  assert.equal(result.average, 50);
  assert.equal(result.segments.length, 2);
});
test('reset ends validity without inventing a recorded end', () => {
  const result = m.analyze(data([start(1), reading(2, 0, 80), row(3, 2, { kind: 'reset' })]), settings());
  assert.equal(result.segments[0].end, t(2));
  assert.equal(result.runs[0].end, undefined);
  assert.equal(result.runs[0].resetEnded, true);
});
test('default carry fills long gaps but stops at lifecycle boundaries', () => {
  const audit = [start(1), reading(2, 0, 100), row(3, 50, { kind: 'reset' }), start(4, 52), end(5)];
  const result = m.analyze(data(audit), m.defaultSettings);
  assert.equal(result.segments[0].end, t(50));
  assert.equal(result.summaries[1].coverage, 0);
  assert.equal(m.validateSettings({}).freshness, null);
});
test('occupancy cannot transfer to a restarted event', () => {
  const result = m.analyze(data([start(1), reading(2, 0, 80), end(3, 1), start(4, 2), end(5, 30)]), settings());
  assert.equal(result.runs.length, 2);
  assert.equal(result.summaries[1].coverage, 0);
  assert.equal(result.segments[0].end, t(1));
});
test('filtered-out reporters still supersede previous reports', () => {
  const result = m.analyze(data([start(1), reading(2, 0, 80, 'one'), reading(3, 2, 30, 'two'), end(4)]), settings({ actors: ['one'] }));
  assert.equal(result.segments[0].end, t(2));
});
test('schedule overrides replace inherited shifts and preserve duration', () => {
  const run = m.reconstruct(data([start(1)])).runs[0];
  const adjusted = m.shifted(run, settings({ shift: 45, trackShifts: { 'd7-auditorium': 30 }, eventShifts: { talk: 15 } }));
  assert.equal(adjusted.start, t(15));
  assert.equal(adjusted.end, t(75));
  assert.equal(run.start, t(0));
});
test('drop flags require within-run, recent readings and confirmations', () => {
  const audit = [start(1), reading(2, 1, 90), reading(3, 4, 50), reading(4, 7, 45), end(5)];
  const result = m.analyze(data(audit), settings({ confirmations: 2 }));
  assert.equal(result.flags.length, 1);
  assert.equal(result.flags[0].drop, 40);
  assert.equal(m.analyze(data(audit), settings({ maxGap: 2 })).flags.length, 0);
});
test('does not flag normal closing readings within the end buffer', () => {
  assert.equal(m.analyze(data([start(1), reading(2, 54, 90), reading(3, 58, 30), end(4)]), settings()).flags.length, 0);
});
test('point-only mode reports no assumed coverage', () => {
  const result = m.analyze(data([start(1), reading(2, 1, 80), end(3)]), settings({ carry: false }));
  assert.equal(result.readings.length, 1);
  assert.equal(result.coverage, 0);
  assert.equal(result.average, undefined);
});
test('inferred windows are opt-in and never generate departure claims', () => {
  const audit = [reading(1, 1, 90), reading(2, 4, 20)];
  assert.equal(m.analyze(data(audit), settings()).readings.length, 0);
  const result = m.analyze(data(audit), settings({ infer: true }));
  assert.equal(result.readings.length, 2);
  assert.equal(result.runs[0].inferred, true);
  assert.equal(result.actions.length, 2);
  assert.equal(result.flags.length, 0);
});
test('flags incomplete revision history and validates custom ranges', () => {
  assert.ok(m.reconstruct(data([start(4), reading(6, 1, 80)])).issues.length >= 2);
  assert.throws(() => m.validateSettings({ end: '2026-10-17T08:00' }), /valid range/);
  assert.throws(() => m.validateSettings({ freshness: -1 }));
});
test('CSV prevents formulas and escapes quotes', () => {
  assert.equal(m.csv([['=HYPERLINK()', 'A"B', 80]]), '"\'=HYPERLINK()","A""B","80"');
});

test('preserves mutation metadata and numeric negative CSV values', () => {
  const input = reading(1, 0, 80);
  input.payload.loadTest = 'setup-run';
  assert.equal(data([input]).audit[0].payload.loadTest, 'setup-run');
  assert.equal(m.csv([[-20]]), '\"-20\"');
});

test('unknown event IDs terminate old attribution instead of reusing a previous event', () => {
  const audit = [start(1), reading(2, 1, 90), row(3, 2, { kind: 'session', zone: 'd7-auditorium', session: 'removed-from-agenda', status: 'started' }), reading(4, 3, 20)];
  const result = m.analyze(data(audit), settings({ outside: true }));
  assert.equal(result.readings[1].runKey, undefined);
  assert.equal(result.segments[0].end, t(2));
  assert.equal(result.flags.length, 0);
  assert.ok(result.history.issues.some((s) => s.includes('Unknown event')));
});
