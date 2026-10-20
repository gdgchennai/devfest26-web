/** Pure historical analysis. Never writes to the hall coordinator or its database. */
import { z } from "zod";
import type { AgendaSession } from "./schemas";
import { agendaSchema } from "./schemas";

export const MINUTE = 60_000;
export const DEFAULT_START = "2026-10-17T09:00";
export const DEFAULT_END = "2026-10-17T18:00";
export const istTime = (value: string) => Date.parse(`${value}:00+05:30`);
export function istInput(ms: number) {
  return new Date(ms + 330 * MINUTE).toISOString().slice(0, 16);
}
export function formatTime(ms: number | undefined, date = false) {
  if (ms === undefined || !Number.isFinite(ms)) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", ...(date ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(ms);
}
const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("occupancy"), zone: z.string(), occupied: z.number().int().min(0).max(100) }).passthrough(),
  z.object({ kind: z.literal("session"), zone: z.string(), session: z.string(), status: z.enum(["started", "ended"]) }).passthrough(),
  z.object({ kind: z.literal("reset") }).passthrough(),
  z.object({ kind: z.literal("clock"), now: z.number().nullable() }).passthrough(),
  z.object({ kind: z.literal("promotions") }).passthrough(),
]);
export type Mutation = z.infer<typeof mutationSchema>;
export type AuditRow = { revision: number; actor: string; changed_at: number; payload: Mutation };
export type AnalysisData = { audit: AuditRow[]; agenda: AgendaSession[]; actors: Record<string, string>; source: string; loadedAt: number };
const rowSchema = z.object({
  revision: z.number().int().positive(), actor: z.string().min(1),
  changed_at: z.number().int().nonnegative().max(8_640_000_000_000_000), payload: z.unknown(),
});
/** Accept a raw SELECT export, Wrangler's result envelopes, or a dashboard bundle. */
export function parseAnalysisData(input: unknown, fallbackAgenda: AgendaSession[], source: string): AnalysisData {
  const bundle = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
  let rows: unknown = bundle?.audit ?? input;
  if (Array.isArray(rows) && rows[0] && typeof rows[0] === "object" && "results" in rows[0]) rows = rows.flatMap((r) => (r as { results: unknown[] }).results);
  if (bundle?.results) rows = bundle.results;
  if (!Array.isArray(rows) || rows.length > 50_000) throw new Error("Import an array of up to 50,000 audit records, or an analysis JSON bundle.");
  const revisions = new Set<number>();
  const audit = rows.map((raw, index) => {
    const result = rowSchema.safeParse(raw);
    if (!result.success) throw new Error(`Invalid audit row ${index + 1}: revision, actor, changed_at and payload are required.`);
    const row = result.data;
    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { throw new Error(`Invalid JSON payload at revision ${row.revision}.`); }
    }
    const mutation = mutationSchema.safeParse(payload);
    if (!mutation.success) throw new Error(`Invalid or unsupported mutation at revision ${row.revision}.`);
    if (revisions.has(row.revision)) throw new Error(`Duplicate revision ${row.revision}; combine exports without duplicate rows.`);
    revisions.add(row.revision);
    return { ...row, payload: mutation.data };
  }).sort((a, b) => a.revision - b.revision);
  const actors = z.record(z.string(), z.string()).parse(bundle?.actors ?? {});
  return { audit, actors, agenda: bundle?.agenda ? agendaSchema.parse(bundle.agenda) : fallbackAgenda, source, loadedAt: Date.now() };
}
export type Run = {
  key: string; session: AgendaSession; start?: number; end?: number;
  boundaryEnd?: number; inferred: boolean; resetEnded?: boolean;
};
export type Reading = { revision: number; time: number; zone: string; occupied: number; actor: string; runKey?: string; boundary?: number };
export type History = { runs: Run[]; readings: Reading[]; issues: string[]; actions: (AuditRow & { zone: string; runKey?: string })[] };
export function reconstruct(data: AnalysisData): History {
  const sessions = new Map(data.agenda.map((s) => [s.id, s]));
  const runs: Run[] = [], readings: Reading[] = [], issues: string[] = [];
  const actions: History["actions"] = [];
  const active = new Map<string, Run>();
  const openReadings = new Map<string, Reading[]>();
  function boundary(zone: string, time: number) {
    for (const reading of openReadings.get(zone) ?? []) reading.boundary = time;
    openReadings.delete(zone);
  }
  let previous: AuditRow | undefined;
  for (const row of data.audit) {
    if (previous && row.revision !== previous.revision + 1) issues.push(`Missing revisions between ${previous.revision} and ${row.revision}. Attribution across this gap may be incomplete.`);
    if (previous && row.changed_at < previous.changed_at) issues.push(`Server time moved backwards at revision ${row.revision}; inspect this interval.`);
    previous = row;
    const m = row.payload;
    if (m.kind === "clock") { issues.push(`Test clock action at revision ${row.revision}; audit times remain real server timestamps.`); continue; }
    if (m.kind === "reset") {
      for (const run of active.values()) { run.boundaryEnd = row.changed_at; run.resetEnded = true; }
      for (const zone of openReadings.keys()) boundary(zone, row.changed_at);
      active.clear();
    } else if (m.kind === "session") {
      const session = sessions.get(m.session);
      if (!session || session.track !== m.zone) {
        boundary(m.zone, row.changed_at);
        const previousRun = active.get(m.zone);
        if (previousRun) previousRun.boundaryEnd = row.changed_at;
        active.delete(m.zone);
        actions.push({ ...row, zone: m.zone });
        issues.push(`Unknown event/track at revision ${row.revision}; use the event-day agenda export.`);
        continue;
      }
      boundary(m.zone, row.changed_at);
      let run = active.get(m.zone);
      if (m.status === "started") {
        if (run) { run.boundaryEnd = row.changed_at; issues.push(`Event ${run.session.title} has no end before the next start.`); }
        run = { key: `${m.session}:${row.revision}`, session, start: row.changed_at, inferred: false };
        active.set(m.zone, run); runs.push(run);
      } else {
        if (!run || run.session.id !== m.session) {
          run = { key: `${m.session}:end:${row.revision}`, session, end: row.changed_at, boundaryEnd: row.changed_at, inferred: false };
          runs.push(run); issues.push(`End without matching start for ${session.title}.`);
        } else { run.end = row.changed_at; run.boundaryEnd = row.changed_at; active.delete(m.zone); }
      }
      actions.push({ ...row, zone: m.zone, runKey: run.key });
    } else if (m.kind === "occupancy") {
      const reading: Reading = { revision: row.revision, time: row.changed_at, zone: m.zone, occupied: m.occupied, actor: row.actor, runKey: active.get(m.zone)?.key };
      readings.push(reading);
      const pending = openReadings.get(m.zone) ?? [];
      pending.push(reading); openReadings.set(m.zone, pending);
      actions.push({ ...row, zone: m.zone, runKey: reading.runKey });
    }
  }
  if (data.audit.length && data.audit[0].revision !== 1) issues.push("The export starts after revision 1; earlier lifecycle context may be missing.");
  return { runs, readings, issues: [...new Set(issues)], actions };
}
export type Settings = {
  start: string; end: string; tracks: string[]; events: string[]; actors: string[];
  shift: number; trackShifts: Record<string, number>; eventShifts: Record<string, number>;
  freshness: number | null; carry: boolean; outside: boolean; infer: boolean;
  drop: number; high: number; confirmations: number; maxGap: number | null; endBuffer: number;
  bucket: number; congestion: number; capacities: Record<string, number>; headcounts: boolean;
};
export const defaultSettings: Settings = {
  start: DEFAULT_START, end: DEFAULT_END, tracks: [], events: [], actors: [], shift: 0,
  trackShifts: {}, eventShifts: {}, freshness: null, carry: true, outside: false, infer: false,
  drop: 20, high: 70, confirmations: 1, maxGap: null, endBuffer: 5, bucket: 30,
  congestion: 80, capacities: {}, headcounts: false,
};
export function validateSettings(value: unknown): Settings {
  const numericMap = z.record(z.string(), z.number().finite().min(-10080).max(10080));
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/), end: z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/),
    tracks: z.array(z.string()).max(100), events: z.array(z.string()).max(1000), actors: z.array(z.string()).max(1000),
    shift: z.number().finite().min(-10080).max(10080), trackShifts: numericMap, eventShifts: numericMap,
    freshness: z.number().min(1).max(120).nullable(), carry: z.boolean(), outside: z.boolean(), infer: z.boolean(),
    drop: z.number().min(1).max(100), high: z.number().min(0).max(100), confirmations: z.number().int().min(1).max(10),
    maxGap: z.number().min(1).max(120).nullable(), endBuffer: z.number().min(0).max(120), bucket: z.number().min(1).max(1440),
    congestion: z.number().min(1).max(100), capacities: z.record(z.string(), z.number().int().positive().max(100000)), headcounts: z.boolean(),
  });
  const parsed = schema.parse({ ...defaultSettings, ...(value && typeof value === "object" ? value : {}) });
  const start = istTime(parsed.start), end = istTime(parsed.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86400_000) throw new Error("Choose a valid range up to 366 days with its end after its start.");
  return parsed;
}
export function shifted(run: Run, settings: Settings) {
  // Event and track overrides replace the inherited total, rather than adding silently.
  const offset = settings.eventShifts[run.session.id] ?? settings.trackShifts[run.session.track ?? ""] ?? settings.shift;
  return { start: Date.parse(run.session.start) + offset * MINUTE, end: Date.parse(run.session.end) + offset * MINUTE, offset };
}
export type Segment = { start: number; end: number; reading: Reading };
export type DropFlag = { run: Run; from: Reading; to: Reading; drop: number; confirmed: number; confidence: string; reason: string };
export type RunSummary = { run: Run; readings: Reading[]; segments: Segment[]; coverage: number; duration: number; average?: number; peak?: number; timeToPeak?: number; opening?: number; closing?: number; change?: number; largestDrop: number; recovered: boolean; startDrift?: number; endDrift?: number; originalStartDrift?: number; originalEndDrift?: number };
export function analyze(data: AnalysisData, settings: Settings) {
  const history = reconstruct(data);
  const freshnessMs = settings.freshness === null ? Infinity : settings.freshness * MINUTE;
  const maxGapMs = settings.maxGap === null ? Infinity : settings.maxGap * MINUTE;
  const start = istTime(settings.start), end = istTime(settings.end);
  const runs = [...history.runs];
  const inferredReadings = new Map<number, string>();
  if (settings.infer) {
    for (const session of data.agenda.filter((s) => s.track && s.type !== "break" && !runs.some((r) => r.session.id === s.id))) {
      const run: Run = { key: `${session.id}:inferred`, session, inferred: true };
      const window = shifted(run, settings);
      run.start = window.start; run.boundaryEnd = window.end;
      runs.push(run);
    }
    for (const reading of history.readings.filter((r) => !r.runKey)) {
      const candidates = runs.filter((r) => r.inferred && r.session.track === reading.zone && r.start! <= reading.time && r.boundaryEnd! > reading.time);
      if (candidates.length === 1) inferredReadings.set(reading.revision, candidates[0].key);
    }
  }
  const allReadings = history.readings.map((r) => inferredReadings.has(r.revision) ? { ...r, runKey: inferredReadings.get(r.revision) } : r);
  const runMap = new Map(runs.map((r) => [r.key, r]));
  const trackOk = (zone: string) => !settings.tracks.length || settings.tracks.includes(zone);
  const actorOk = (actor: string) => !settings.actors.length || settings.actors.includes(actor);
  // Canceled event: retain audit lifecycle boundaries, but exclude it from analysis.
  const eventOk = (key?: string) => runMap.get(key ?? "")?.session.id !== "gdg-on-campus-meetup"
    && (!settings.events.length || (!!key && settings.events.includes(runMap.get(key)?.session.id ?? "")));
  const eligible = allReadings.filter((r) => trackOk(r.zone) && actorOk(r.actor) && eventOk(r.runKey) && (settings.outside || r.runKey));
  const visible = eligible.filter((r) => r.time >= start && r.time < end);
  const segments: Segment[] = [];
  // Next readings by ANY actor supersede previous values, even when filtering a reporter.
  const nextByRevision = new Map<number, number>();
  const nextByZone = new Map<string, number>();
  for (let i = allReadings.length - 1; i >= 0; i--) {
    const reading = allReadings[i];
    if (nextByZone.has(reading.zone)) nextByRevision.set(reading.revision, nextByZone.get(reading.zone)!);
    nextByZone.set(reading.zone, reading.time);
  }
  if (settings.carry) for (const reading of eligible) {
    const run = reading.runKey ? runMap.get(reading.runKey) : undefined;
    const a = Math.max(start, reading.time, run?.start ?? reading.time);
    const b = Math.min(end, reading.time + freshnessMs, nextByRevision.get(reading.revision) ?? Infinity, reading.boundary ?? Infinity, run?.boundaryEnd ?? Infinity);
    if (b > a) segments.push({ start: a, end: b, reading });
  }
  const selectedRuns = runs.filter((run) => {
    const plan = shifted(run, settings);
    return trackOk(run.session.track ?? "") && eventOk(run.key)
      && (!settings.actors.length || history.actions.some((a) => a.runKey === run.key && actorOk(a.actor)) || eligible.some((r) => r.runKey === run.key))
      && (run.start ?? plan.start) < end && (run.boundaryEnd ?? (run.start ? end : plan.end)) > start;
  }).sort((a, b) => (a.start ?? shifted(a, settings).start) - (b.start ?? shifted(b, settings).start));
  const summaries: RunSummary[] = selectedRuns.map((run) => {
    const rs = visible.filter((r) => r.runKey === run.key).sort((a, b) => a.time - b.time || a.revision - b.revision);
    const ss = segments.filter((s) => s.reading.runKey === run.key);
    const duration = Math.max(0, Math.min(end, run.boundaryEnd ?? (run.start ? end : shifted(run, settings).end)) - Math.max(start, run.start ?? shifted(run, settings).start));
    const covered = ss.reduce((n, s) => n + s.end - s.start, 0);
    const peak = rs.length ? Math.max(...rs.map((r) => r.occupied)) : undefined;
    const peakReading = rs.find((r) => r.occupied === peak);
    let largestDrop = 0, recovered = false;
    rs.forEach((r, i) => {
      if (i && rs[i - 1].time + maxGapMs >= r.time) {
        const drop = rs[i - 1].occupied - r.occupied;
        if (drop > largestDrop) { largestDrop = drop; recovered = rs.slice(i + 1).some((later) => later.occupied >= rs[i - 1].occupied); }
      }
    });
    const plan = shifted(run, settings);
    return { run, readings: rs, segments: ss, coverage: duration ? covered / duration * 100 : 0, duration,
      average: covered ? ss.reduce((n, s) => n + s.reading.occupied * (s.end - s.start), 0) / covered : undefined,
      peak, timeToPeak: peakReading && run.start !== undefined ? (peakReading.time - run.start) / MINUTE : undefined,
      opening: rs[0]?.occupied, closing: rs.at(-1)?.occupied,
      change: rs.length > 1 ? rs.at(-1)!.occupied - rs[0].occupied : undefined, largestDrop, recovered,
      startDrift: !run.inferred && run.start !== undefined ? (run.start - plan.start) / MINUTE : undefined,
      endDrift: run.end !== undefined ? (run.end - plan.end) / MINUTE : undefined,
      originalStartDrift: !run.inferred && run.start !== undefined ? (run.start - Date.parse(run.session.start)) / MINUTE : undefined,
      originalEndDrift: run.end !== undefined ? (run.end - Date.parse(run.session.end)) / MINUTE : undefined,
    };
  });
  const flags: DropFlag[] = [];
  for (const summary of summaries) {
    if (summary.run.inferred) continue;
    const rs = summary.readings;
    let lastFlagEnd = -1;
    for (let i = 1; i < rs.length; i++) {
      const to = rs[i];
      const from = rs.slice(lastFlagEnd + 1, i).filter((r) => r.occupied >= settings.high && to.time - r.time <= maxGapMs).sort((a, b) => b.occupied - a.occupied)[0];
      if (!from || from.occupied - to.occupied < settings.drop) continue;
      if (summary.run.end !== undefined && to.time > summary.run.end - settings.endBuffer * MINUTE) continue;
      const confirmation = rs.slice(i, i + settings.confirmations);
      if (confirmation.length < settings.confirmations || confirmation.some((r, j) => from.occupied - r.occupied < settings.drop || (j > 0 && r.time - confirmation[j - 1].time > maxGapMs))) continue;
      flags.push({ run: summary.run, from, to, drop: from.occupied - to.occupied, confirmed: confirmation.length,
        confidence: summary.run.end === undefined || summary.coverage < 50 ? "Limited coverage" : "Supported by reports",
        reason: `${from.occupied}% → ${to.occupied}% in ${((to.time - from.time) / MINUTE).toFixed(1)} min; ${confirmation.length} low reading(s). ${summary.run.end === undefined ? "End not recorded; end buffer cannot be checked." : `${((summary.run.end - to.time) / MINUTE).toFixed(1)} min before recorded end.`}` });
      lastFlagEnd = i;
    }
  }
  const actions = history.actions.map((a) => inferredReadings.has(a.revision) ? { ...a, runKey: inferredReadings.get(a.revision) } : a).filter((a) => a.changed_at >= start && a.changed_at < end && trackOk(a.zone) && actorOk(a.actor) && eventOk(a.runKey) && (settings.outside || a.runKey));
  const covered = summaries.reduce((n, s) => n + s.segments.reduce((m, segment) => m + segment.end - segment.start, 0), 0);
  const duration = summaries.reduce((n, s) => n + s.duration, 0);
  return { history, runs: selectedRuns, runMap, readings: visible, segments, summaries, flags, actions, start, end,
    coverage: duration ? covered / duration * 100 : 0,
    average: covered ? summaries.reduce((n, s) => n + (s.average ?? 0) * s.segments.reduce((m, segment) => m + segment.end - segment.start, 0), 0) / covered : undefined,
    peak: visible.length ? Math.max(...visible.map((r) => r.occupied)) : undefined,
    unassigned: allReadings.filter((r) => r.time >= start && r.time < end && !r.runKey).length,
  };
}
export type Analysis = ReturnType<typeof analyze>;
export function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** CSV formula protection also applies to imported actor and event names. */
export function csv(rows: (string | number | undefined)[][]) {
  return rows.map((row) => row.map((v) => {
    let s = v === undefined ? "" : String(v);
    if (typeof v === "string" && /^[\s]*[=+@-]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
