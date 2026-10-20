/* eslint-disable @typescript-eslint/no-require-imports -- Transpile the actual pure TS modules with the existing dependency. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { analyze, defaultSettings, parseAnalysisData, istTime, MINUTE } = require('../../lib/post-event-analysis.ts');
const { attentionEvents, eventOverview, eventTakeaway, matchesCategory, readableDuration } = require('../../lib/post-event-overview.ts');
const agenda = [{ id: 'talk', title: 'Talk', track: 'd7-auditorium', hall: 'D7', start: '2026-10-17T09:00:00+05:30', end: '2026-10-17T10:00:00+05:30', type: 'talk', speakerSlugs: [], prerequisites: [] }];
function report(values, range = {}) {
  const t = (minute) => istTime('2026-10-17T09:00') + minute * MINUTE;
  const entries = [ [0, { kind: 'session', zone: 'd7-auditorium', session: 'talk', status: 'started' }], ...values.map(([minute, occupied]) => [minute, { kind: 'occupancy', zone: 'd7-auditorium', occupied }]), [60, { kind: 'session', zone: 'd7-auditorium', session: 'talk', status: 'ended' }] ];
  const audit = entries.map(([minute, payload], i) => ({ revision: i + 1, actor: 'lead', changed_at: t(minute), payload }));
  return eventOverview(analyze(parseAnalysisData(audit, agenda, 'test'), { ...defaultSettings, freshness: 5, maxGap: 10, high: 0, ...range }));
}
test('full and empty duration stop at freshness expiry, never fill gaps', () => {
  const result = report([[0, 100], [20, 0]]);
  assert.equal(result.fullMs, 5 * MINUTE);
  assert.equal(result.emptyMs, 5 * MINUTE);
  assert.equal(result.events[0].measuredMs, 10 * MINUTE);
});
test('carried occupancy includes gaps and labels only waits longer than 40 minutes', () => {
  const result = report([[0, 100], [45, 0]], { freshness: null, maxGap: null });
  assert.equal(result.fullMs, 45 * MINUTE);
  assert.equal(result.emptyMs, 15 * MINUTE);
  assert.equal(result.events[0].average, 75);
  assert.deepEqual(result.events[0].longGaps.map((gap) => (gap.end - gap.start) / MINUTE), [45]);
  assert.equal(result.drops.length, 1);
  assert.equal(report([[0, 100], [40, 0]], { freshness: null }).events[0].longGaps.length, 0);
  assert.equal(report([[0, 100]], { freshness: null }).events[0].longGaps.length, 1);
});
test('carried occupancy clips to custom ranges and does not fill before the first report', () => {
  assert.equal(report([[10, 100]], { freshness: null }).fullMs, 50 * MINUTE);
  const event = report([[0, 100]], { freshness: null, start: '2026-10-17T09:45', end: '2026-10-17T09:50' }).events[0];
  assert.equal(event.fullMs, 5 * MINUTE);
  assert.equal(event.summary.peak, 100);
  assert.equal(event.longGaps[0].end - event.longGaps[0].start, 50 * MINUTE);
});
test('low attendance uses covered time, not an average of update counts', () => {
  const result = report([[0, 100], [1, 0]]);
  assert.equal(result.low.length, 1);
  assert.ok(Math.abs(result.low[0].average - 100 / 6) < 0.00001);
});
test('no measurements remain unknown, not empty or low', () => {
  const result = report([]);
  assert.equal(result.low.length, 0);
  assert.equal(result.empty.length, 0);
  assert.equal(result.hasMeasurements, false);
  assert.equal(result.missing, 1);
  assert.equal(eventTakeaway(result.events[0]), 'No occupancy reports');
});
test('duration clips exactly to a custom range', () => {
  assert.equal(report([[0, 100]], { start: '2026-10-17T09:02', end: '2026-10-17T09:04' }).fullMs, 2 * MINUTE);
});
test('a mid-event drop from moderate attendance is visible', () => {
  const result = report([[0, 45], [3, 20]]);
  assert.equal(result.drops.length, 1);
  assert.equal(result.drops[0].drop.drop, 25);
  assert.equal(matchesCategory(result.drops[0], 'drops'), true);
  assert.equal(eventTakeaway(result.drops[0], 'drops'), '45% → 20% during the event');
});
test('recorded drops include small falls, long gaps and falls near the end, within the selected range', () => {
  const values = [[0, 80], [3, 75], [30, 60], [40, 90], [58, 85]];
  const event = report(values).events[0];
  assert.deepEqual(event.recordedDrops.map(({ from, to }) => [from.occupied, to.occupied]), [[80, 75], [75, 60], [90, 85]]);
  assert.equal(event.drop, undefined);
  assert.deepEqual(report(values, { start: '2026-10-17T09:30' }).events[0].recordedDrops.map(({ from, to }) => [from.occupied, to.occupied]), [[90, 85]]);
});
test('small durations and combined hours have unambiguous labels', () => {
  assert.equal(readableDuration(1), '<1 min');
  assert.equal(readableDuration(80 * MINUTE), '1h 20m');
  assert.equal(readableDuration(0), '0 min');
});

test('full periods merge contiguous reports without bridging a gap', () => {
  const result = report([[0, 100], [3, 100], [20, 100]]);
  assert.equal(result.full[0].fullPeriods.length, 2);
  assert.equal(result.full[0].fullPeriods[0].end - result.full[0].fullPeriods[0].start, 8 * MINUTE);
  assert.equal(eventTakeaway(result.full[0], 'full'), 'Full for 13 min');
});
test('25% is not labeled low and a tiny known interval is not rounded to zero', () => {
  assert.equal(report([[0, 25]]).low.length, 0);
  assert.equal(readableDuration(1000), '<1 min');
});
test('default highlights mix quiet, dropping and full events without duplicates', () => {
  const base = report([[0, 10]]).events[0];
  const event = (key, changes) => ({ ...base, ...changes, summary: { ...base.summary, run: { ...base.summary.run, key } } });
  const low = event('low', { lowAttendance: true, emptyMs: 0 });
  const drop = event('drop', { lowAttendance: false, drop: { drop: 40 } });
  const full = event('full', { lowAttendance: false, fullMs: 1000 });
  const empty = event('empty', { lowAttendance: true, emptyMs: 1000 });
  const result = attentionEvents({ events: [low, drop, full, empty], low: [low, empty], drops: [drop], full: [full], empty: [empty] });
  assert.deepEqual(result.map((item) => item.summary.run.key), ['low', 'drop', 'full', 'empty']);
});

test('a still-fresh report before the selected range supports its peak', () => {
  const event = report([[0, 100]], { start: '2026-10-17T09:02', end: '2026-10-17T09:04' }).events[0];
  assert.equal(event.summary.peak, 100);
  assert.equal(event.summary.timeToPeak, 0);
});
