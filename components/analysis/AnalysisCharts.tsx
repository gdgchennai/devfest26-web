"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { formatTime, type RunSummary } from "@/lib/post-event-analysis";
import styles from "./PostEventDashboard.module.css";

function subscribeToSize(onChange: () => void) {
  const media = window.matchMedia("(max-width: 600px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const isCompact = () => window.matchMedia("(max-width: 600px)").matches;

/** Dots show recorded reports; steps carry each value to the next update or event end. */
export function EventOccupancyTimeline({ summary, start, end }: {
  summary: RunSummary; start: number; end: number;
}) {
  const id = useId();
  const compact = useSyncExternalStore(subscribeToSize, isCompact, () => false);
  const [selected, setSelected] = useState<number | null>(null);
  const readings = [...new Map([
    ...summary.segments.map((segment) => segment.reading), ...summary.readings,
  ].map((reading) => [reading.revision, reading])).values()]
    .sort((a, b) => a.time - b.time);
  const selectedReading = readings.find((reading) => reading.revision === selected);
  const left = compact ? 48 : 58, width = compact ? 300 : 704, bottom = compact ? 194 : 212, height = compact ? 145 : 168;
  const x = (time: number) => left + (time - start) / Math.max(1, end - start) * width;
  const y = (occupied: number) => bottom - occupied / 100 * height;

  if (!readings.length) return <div className={styles.chartEmpty}>No occupancy reports for this event in the selected time range.</div>;
  return <div className={styles.timeline}>
    <svg viewBox={compact ? "0 0 375 240" : "0 0 800 260"} role="group" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Occupancy during {summary.run.session.title}</title>
      <desc id={`${id}-description`}>Percentage of the hall occupied. Dots are reports; each value is carried forward until the next update or event end. Select a dot for its time and occupancy.</desc>
      <text x={left} y="20" className={styles.axisTitle}>Hall occupied</text>
      {[0, 25, 50, 75, 100].map((n) => <g key={n}>
        <line x1={left} x2={left + width} y1={y(n)} y2={y(n)} className={styles.gridLine} />
        <text x={left - 12} y={y(n) + 4} textAnchor="end">{n}%</text>
      </g>)}
      {summary.segments.map((segment) => <g key={segment.reading.revision}>
        <rect x={x(segment.start)} y={y(segment.reading.occupied)} width={Math.max(0, x(segment.end) - x(segment.start))} height={height * segment.reading.occupied / 100} className={styles.chartFill} />
        <line x1={x(segment.start)} x2={x(segment.end)} y1={y(segment.reading.occupied)} y2={y(segment.reading.occupied)} className={segment.reading.occupied === 100 ? styles.fullLine : styles.chartLine} />
      </g>)}
      {readings.filter((reading) => reading.time >= start && reading.time <= end).map((reading) => <g
        key={reading.revision} className={styles.chartPoint} role="button" tabIndex={0}
        aria-label={`${formatTime(reading.time)} IST: ${reading.occupied}% full`}
        aria-pressed={selected === reading.revision}
        onClick={() => setSelected(reading.revision)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(reading.revision); } }}
      >
        <title>{formatTime(reading.time)} IST · {reading.occupied}% full</title>
        <circle cx={x(reading.time)} cy={y(reading.occupied)} r="11" fill="transparent" />
        <circle cx={x(reading.time)} cy={y(reading.occupied)} r={selected === reading.revision ? 6 : 4} className={styles.dot} />
      </g>)}
      {(compact ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((fraction) => <text key={fraction} x={left + fraction * width} y={bottom + 30} textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>{formatTime(start + fraction * (end - start))}</text>)}
    </svg>
    <p className={styles.chartCaption} aria-live="polite">{selectedReading
      ? `${formatTime(selectedReading.time, true)} IST · ${selectedReading.occupied}% of the hall occupied`
      : "Select a dot to see the report. Lines carry the last report forward between updates."}</p>
  </div>;
}
