"use client";

import { formatTime, MINUTE, type Analysis, type Run, type RunSummary, type Settings } from "@/lib/post-event-analysis";
import styles from "./PostEventDashboard.module.css";

export function OccupancyChart({ analysis, zone, onSelect, onZoom }: { analysis: Analysis; zone: string; onSelect: (key: string) => void; onZoom: (start: number, end: number) => void }) {
  const { start, end } = analysis;
  const x = (time: number) => 36 + (time - start) / (end - start) * 586;
  const y = (occupied: number) => 122 - occupied;
  const readings = analysis.readings.filter((r) => r.zone === zone);
  const runs = analysis.runs.filter((r) => r.session.track === zone);
  return <svg viewBox="0 0 650 164" role="img" aria-label={`${zone}: occupancy from ${formatTime(start, true)} to ${formatTime(end, true)} IST. Points are submitted readings; gaps are unknown.`} className={styles.chart}>
    <rect x="36" y="22" width="586" height="100" className={styles.unknownFill} />
    {[0, 50, 100].map((n) => <g key={n}><line x1="36" x2="622" y1={y(n)} y2={y(n)} className={styles.gridLine} /><text x="29" y={y(n) + 4} textAnchor="end">{n}</text></g>)}
    {runs.map((run) => run.start !== undefined && run.start >= start && run.start < end ? <line key={run.key} x1={x(run.start)} x2={x(run.start)} y1="18" y2="122" className={styles.eventLine}><title>{run.session.title} · {run.inferred ? "Inferred" : "Recorded"} start {formatTime(run.start)}</title></line> : null)}
    {analysis.segments.filter((s) => s.reading.zone === zone).map((segment) => <g key={segment.reading.revision}>
      <rect x={x(segment.start)} y={y(segment.reading.occupied)} width={Math.max(0, x(segment.end) - x(segment.start))} height={segment.reading.occupied} className={styles.occupancyFill} />
      <line x1={x(segment.start)} x2={x(segment.end)} y1={y(segment.reading.occupied)} y2={y(segment.reading.occupied)} className={styles.occupancyLine} />
    </g>)}
    {readings.map((reading) => <g key={reading.revision} role={reading.runKey ? "button" : undefined} tabIndex={reading.runKey ? 0 : undefined} aria-label={`${formatTime(reading.time)}: ${reading.occupied}% occupied, revision ${reading.revision}. Open event details.`} onClick={() => reading.runKey && onSelect(reading.runKey)} onKeyDown={(e) => { if (reading.runKey && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(reading.runKey); } }} className={styles.point}>
      <title>{formatTime(reading.time, true)} IST · {reading.occupied}% occupied · revision {reading.revision}</title>
      <circle cx={x(reading.time)} cy={y(reading.occupied)} r="9" fill="transparent" /><circle cx={x(reading.time)} cy={y(reading.occupied)} r="3" />
    </g>)}
    {[0, 0.5, 1].map((fraction) => <text key={fraction} x={36 + fraction * 586} y="146" textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{formatTime(start + fraction * (end - start), end - start > 86400000)}</text>)}
    {!readings.length && !analysis.segments.some((s) => s.reading.zone === zone) && <text x="325" y="78" textAnchor="middle">No usable reports in this range</text>}
    {runs.filter((r) => r.start !== undefined && (r.boundaryEnd ?? end) > start && r.start < end).map((run) => <g key={`zoom-${run.key}`} role="button" tabIndex={0} aria-label={`Zoom to ${run.session.title}`} onClick={() => onZoom(run.start!, run.boundaryEnd ?? end)} onKeyDown={(e) => { if (e.key === "Enter") onZoom(run.start!, run.boundaryEnd ?? end); }} className={styles.zoomRegion}>
      <rect x={x(Math.max(start, run.start!))} y="151" width={Math.max(2, x(Math.min(end, run.boundaryEnd ?? end)) - x(Math.max(start, run.start!)))} height="10" /><title>Zoom to {run.session.title}</title>
    </g>)}
  </svg>;
}

export function TimingChart({ run, settings, start, end, onSelect }: { run: Run; settings: Settings; start: number; end: number; onSelect: (key: string) => void }) {
  const offset = settings.eventShifts[run.session.id] ?? settings.trackShifts[run.session.track ?? ""] ?? settings.shift;
  const planned = Date.parse(run.session.start), plannedEnd = Date.parse(run.session.end);
  const x = (time: number) => Math.max(0, Math.min(600, (time - start) / (end - start) * 600));
  return <svg viewBox="0 0 600 57" role="img" aria-label={`${run.session.title}: original, adjusted and recorded timing`} className={styles.timingChart}>
    {([{ a: planned, b: plannedEnd, y: 5, className: styles.original, label: "Original" }, { a: planned + offset * MINUTE, b: plannedEnd + offset * MINUTE, y: 22, className: styles.adjusted, label: "Adjusted" }, { a: run.inferred ? undefined : run.start, b: run.end ?? run.boundaryEnd, y: 39, className: styles.recorded, label: "Recorded" }]).map((bar) => bar.a !== undefined && bar.a < end && (bar.b ?? end) > start ? <g key={bar.label}>
      <rect x={x(bar.a)} y={bar.y} width={Math.max(2, x(bar.b ?? end) - x(bar.a))} height="10" rx="3" className={bar.className} onClick={() => onSelect(run.key)}><title>{bar.label}: {formatTime(bar.a, true)}–{formatTime(bar.b, true)}{bar.label === "Recorded" && !run.end ? " · end not recorded" : ""}</title></rect>
      {bar.label === "Recorded" && !run.end && <text x={Math.min(580, x(bar.b ?? end))} y="55" textAnchor="end">end ?</text>}
    </g> : null)}
  </svg>;
}

export function Heatmap({ analysis, settings, zones, onTime }: { analysis: Analysis; settings: Settings; zones: { id: string; name: string }[]; onTime: (time: number) => void }) {
  // Bound columns for year-long custom ranges; disclose the effective bucket size.
  const bucket = Math.max(settings.bucket * MINUTE, Math.ceil((analysis.end - analysis.start) / 96 / MINUTE) * MINUTE);
  const buckets = Array.from({ length: Math.ceil((analysis.end - analysis.start) / bucket) }, (_, i) => ({ start: analysis.start + i * bucket, end: Math.min(analysis.end, analysis.start + (i + 1) * bucket) }));
  return <><p className={styles.note}>Fresh reports only · {bucket / MINUTE}-minute buckets · gray means unknown. Click a cell to inspect tracks at that time.</p>
    <div className={styles.tableScroll}><table className={styles.heatmap}><thead><tr><th>Track / IST</th>{buckets.map((b) => <th key={b.start}>{formatTime(b.start, analysis.end - analysis.start > 86400000)}</th>)}</tr></thead><tbody>{zones.map((zone) => <tr key={zone.id}><th>{zone.name}</th>{buckets.map((b) => {
      const ss = analysis.segments.filter((s) => s.reading.zone === zone.id && s.start < b.end && s.end > b.start);
      const duration = ss.reduce((n, s) => n + Math.min(b.end, s.end) - Math.max(b.start, s.start), 0);
      const average = duration ? ss.reduce((n, s) => n + s.reading.occupied * (Math.min(b.end, s.end) - Math.max(b.start, s.start)), 0) / duration : undefined;
      const representative = ss[0] ? Math.max(b.start, ss[0].start) : b.start;
      return <td key={b.start}><button type="button" onClick={() => onTime(representative)} className={average === undefined ? styles.unknown : average >= settings.congestion ? styles.hot : average >= 50 ? styles.warm : styles.cool} title={`${zone.name} · ${formatTime(b.start, true)} · ${average === undefined ? "Unknown" : `${average.toFixed(0)}% occupied; ${(duration / (b.end - b.start) * 100).toFixed(0)}% of bucket covered`}`} aria-label={`${zone.name}, ${formatTime(b.start, true)}, ${average === undefined ? "unknown" : `${average.toFixed(0)}% occupied`}`}>{average === undefined ? "—" : `${average.toFixed(0)}%`}</button></td>;
    })}</tr>)}</tbody></table></div>
  </>;
}

/** Raw points and fresh intervals only; no interpolation across unknown gaps. */
export function RunSparkline({ summary }: { summary: RunSummary }) {
  const points = [...new Map([...summary.segments.map((s) => s.reading), ...summary.readings].map((r) => [r.revision, r])).values()];
  if (!points.length) return null;
  const start = Math.min(...points.map((r) => r.time));
  const end = Math.max(start + MINUTE, ...points.map((r) => r.time), ...summary.segments.map((s) => s.end));
  const x = (t: number) => 8 + (t - start) / (end - start) * 304;
  return <svg viewBox="0 0 320 72" className={styles.chart} role="img" aria-label={`${summary.run.session.title}: occupancy readings and fresh intervals`}>
    {[0, 50, 100].map((n) => <line key={n} x1="8" x2="312" y1={55 - n / 2} y2={55 - n / 2} className={styles.gridLine} />)}
    {summary.segments.map((s) => <line key={s.reading.revision} x1={x(s.start)} x2={x(s.end)} y1={55 - s.reading.occupied / 2} y2={55 - s.reading.occupied / 2} className={styles.occupancyLine} />)}
    {points.map((r) => <circle key={r.revision} cx={x(r.time)} cy={55 - r.occupied / 2} r="2.5" className={styles.point}><title>{formatTime(r.time)} · {r.occupied}% · revision {r.revision}</title></circle>)}
    <text x="8" y="70">{formatTime(start)}</text><text x="312" y="70" textAnchor="end">{formatTime(end)}</text>
  </svg>;
}
