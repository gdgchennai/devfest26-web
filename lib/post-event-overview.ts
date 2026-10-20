import type { Analysis, DropFlag, RunSummary, Segment } from "./post-event-analysis";

export type EventInsight = {
  summary: RunSummary;
  measuredMs: number;
  fullMs: number;
  fullPeriods: { start: number; end: number }[];
  emptyPeriods: { start: number; end: number }[];
  emptyMs: number;
  lowMs: number;
  average?: number;
  lowAttendance: boolean;
  drop?: DropFlag;
  rank: number;
};
export type InsightCategory = "attention" | "all" | "low" | "drops" | "full" | "empty";

function durationWhere(segments: Segment[], matches: (occupied: number) => boolean) {
  return segments.reduce((total, segment) => matches(segment.reading.occupied)
    ? total + segment.end - segment.start : total, 0);
}

function occupiedPeriods(segments: Segment[], occupied: number) {
  const periods: { start: number; end: number }[] = [];
  for (const segment of segments.filter((s) => s.reading.occupied === occupied).sort((a, b) => a.start - b.start)) {
    const previous = periods.at(-1);
    if (previous && previous.end === segment.start) previous.end = segment.end;
    else periods.push({ start: segment.start, end: segment.end });
  }
  return periods;
}

/** Durations use only fresh, lifecycle-bounded intervals from the reconstruction. */
export function eventOverview(analysis: Analysis) {
  const events: EventInsight[] = analysis.summaries.map((summary) => {
    const measuredMs = durationWhere(summary.segments, () => true);
    const fullMs = durationWhere(summary.segments, (n) => n === 100);
    const emptyMs = durationWhere(summary.segments, (n) => n === 0);
    const lowMs = durationWhere(summary.segments, (n) => n < 25);
    const average = summary.average;
    const evidence = [...new Map([...summary.segments.map((s) => s.reading), ...summary.readings].map((r) => [r.revision, r])).values()].sort((a, b) => a.time - b.time);
    const peak = evidence.length ? Math.max(...evidence.map((r) => r.occupied)) : undefined;
    const peakReading = evidence.find((r) => r.occupied === peak);
    const observedSummary = { ...summary, peak, timeToPeak: peakReading && summary.run.start !== undefined ? (peakReading.time - summary.run.start) / 60_000 : undefined };
    const lowAttendance = average !== undefined && average < 25;
    const drop = analysis.flags.filter((flag) => flag.run.key === summary.run.key)
      .sort((a, b) => b.drop - a.drop)[0];
    const rank = lowAttendance ? 0 : drop ? 1 : fullMs > 0 ? 2 : emptyMs > 0 ? 3 : measuredMs ? 4 : 5;
    return { summary: observedSummary, measuredMs, fullMs, emptyMs, fullPeriods: occupiedPeriods(summary.segments, 100), emptyPeriods: occupiedPeriods(summary.segments, 0), lowMs, average, lowAttendance, drop, rank };
  });
  return {
    events,
    low: events.filter((event) => event.lowAttendance),
    drops: events.filter((event) => event.drop),
    full: events.filter((event) => event.fullMs > 0),
    empty: events.filter((event) => event.emptyMs > 0),
    fullMs: events.reduce((total, event) => total + event.fullMs, 0),
    emptyMs: events.reduce((total, event) => total + event.emptyMs, 0),
    missing: events.filter((event) => !event.measuredMs).length,
    hasMeasurements: events.some((event) => event.measuredMs > 0),
  };
}

/** Surface a mix of the four takeaways before listing further events. */
export function attentionEvents(overview: ReturnType<typeof eventOverview>) {
  const buckets = [
    [...overview.low].sort((a, b) => Number(a.emptyMs > 0) - Number(b.emptyMs > 0) || (a.average ?? 0) - (b.average ?? 0)),
    [...overview.drops].sort((a, b) => b.drop!.drop - a.drop!.drop),
    [...overview.full].sort((a, b) => b.fullMs - a.fullMs),
    [...overview.empty].sort((a, b) => b.emptyMs - a.emptyMs),
  ];
  const ordered: EventInsight[] = [], seen = new Set<string>();
  for (const bucket of [0, 1, 2, 3, 0, 1]) {
    const event = buckets[bucket].find((candidate) => !seen.has(candidate.summary.run.key));
    if (event) { ordered.push(event); seen.add(event.summary.run.key); }
  }
  for (const event of overview.events.filter((event) => event.rank < 4).sort((a, b) => a.rank - b.rank)) {
    if (!seen.has(event.summary.run.key)) { ordered.push(event); seen.add(event.summary.run.key); }
  }
  return ordered;
}

export function matchesCategory(event: EventInsight, category: InsightCategory) {
  switch (category) {
    case "low": return event.lowAttendance;
    case "drops": return !!event.drop;
    case "full": return event.fullMs > 0;
    case "empty": return event.emptyMs > 0;
    case "attention": return event.rank < 4;
    default: return true;
  }
}

export function readableDuration(ms: number) {
  if (ms <= 0) return "0 min";
  if (ms < 60_000) return "<1 min";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

/** No sum of percentages, no assumption that an unreported hall was empty. */
export function eventTakeaway(event: EventInsight, category: InsightCategory = "attention") {
  if (!event.measuredMs) return "No recent occupancy reports";
  if (category === "full") return `Full for ${readableDuration(event.fullMs)}`;
  if (category === "drops" && event.drop) return `${event.drop.from.occupied}% → ${event.drop.to.occupied}% during the event`;
  if (category === "empty" || (category === "attention" && event.emptyMs > 0)) return `Empty for ${readableDuration(event.emptyMs)}`;
  if (category === "low" || event.lowAttendance) return `Averaged ${Math.round(event.average!)}% full`;
  if ((category === "drops" || category === "attention" || category === "all") && event.drop) return `${event.drop.from.occupied}% → ${event.drop.to.occupied}% during the event`;
  if (event.fullMs > 0) return `Full for ${readableDuration(event.fullMs)}`;
  return `Averaged ${Math.round(event.average!)}% full`;
}
