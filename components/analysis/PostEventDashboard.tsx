"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { siteConfig } from "@/site.config";
import type { AgendaSession } from "@/lib/schemas";
import {
  analyze, defaultSettings, formatTime, istTime, MINUTE,
  parseAnalysisData, shifted, validateSettings, type AnalysisData,
} from "@/lib/post-event-analysis";
import {
  attentionEvents, eventOverview, eventTakeaway, matchesCategory, readableDuration,
  type EventInsight, type InsightCategory,
} from "@/lib/post-event-overview";
import { sampleAnalysisData } from "@/lib/post-event-sample";
import { EventOccupancyTimeline } from "./AnalysisCharts";
import styles from "./PostEventDashboard.module.css";

const emptyData = (agenda: AgendaSession[]): AnalysisData => ({ audit: [], agenda, actors: {}, source: "No data", loadedAt: 0 });
const percent = (value?: number) => value === undefined ? "Not reported" : `${Math.round(value)}%`;
const countLabel = (n: number) => `${n} event${n === 1 ? "" : "s"}`;
const titles: Record<InsightCategory, string> = {
  attention: "Events worth a closer look", all: "All events", low: "Events with low attendance",
  drops: "Events where attendance fell", full: "Events with full halls", empty: "Events with empty halls",
};
function timingDifference(minutes?: number) {
  if (minutes === undefined) return "Not recorded";
  if (Math.abs(minutes) < 1) return "On time";
  return `${Math.round(Math.abs(minutes))} min ${minutes > 0 ? "late" : "early"}`;
}
function insightTone(event: EventInsight) {
  return event.lowAttendance || event.emptyMs > 0 ? "quiet" : event.drop ? "drop" : event.fullMs > 0 ? "full" : "normal";
}
function GapLabel({ event }: { event: EventInsight }) {
  if (!event.longGaps.length) return null;
  const longest = Math.max(...event.longGaps.map((gap) => gap.end - gap.start));
  return <span className={styles.gapLabel} title="Last occupancy carried forward during this gap">{readableDuration(longest)} without an update</span>;
}

export function PostEventDashboard({ agenda }: { agenda: AgendaSession[] }) {
  const [data, setData] = useState<AnalysisData>(() => emptyData(agenda));
  const [range, setRange] = useState({ start: defaultSettings.start, end: defaultSettings.end });
  const [delay, setDelay] = useState(0);
  const [category, setCategory] = useState<InsightCategory>("attention");
  const [showAll, setShowAll] = useState(false);
  const [allAttendance, setAllAttendance] = useState(false);
  const [allTimings, setAllTimings] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signInNeeded, setSignInNeeded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dataMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // Old saved layouts and advanced filters deliberately do not affect this overview.
    if (new URLSearchParams(location.search).get("sample") === "1") {
      Promise.resolve().then(() => setData(sampleAnalysisData(agenda)));
    }
  }, [agenda]);
  useEffect(() => {
    if (selectedKey && !dialog.current?.open) dialog.current?.showModal();
    if (!selectedKey && dialog.current?.open) dialog.current.close();
  }, [selectedKey]);

  const settings = useMemo(() => ({ ...defaultSettings, ...range, shift: delay, high: 0 }), [range, delay]);
  let rangeError = "";
  try { validateSettings(settings); } catch { rangeError = "Choose an end time after the start time, within 366 days."; }
  const validRange = !rangeError;
  const analysis = useMemo(() => analyze(data, validRange ? settings : defaultSettings), [data, settings, validRange]);
  const overview = useMemo(() => eventOverview(analysis), [analysis]);
  const selected = overview.events.find((event) => event.summary.run.key === selectedKey);
  const isSample = data.source.startsWith("Synthetic");
  const sourceLabel = !data.audit.length ? "No data loaded" : isSample ? "Sample data" : data.source === "Hall audit database" ? "Server history" : "Imported event data";
  const trackName = (slug: string | null) => siteConfig.tracks.find((track) => track.slug === slug)?.name ?? slug ?? "General";
  const filteredEvents = category === "attention" ? attentionEvents(overview)
    : overview.events.filter((event) => matchesCategory(event, category))
      .sort((a, b) => category === "full" ? b.fullMs - a.fullMs
        : category === "empty" ? b.emptyMs - a.emptyMs
        : category === "drops" ? (b.drop?.drop ?? 0) - (a.drop?.drop ?? 0)
        : category === "low" ? (a.average ?? 101) - (b.average ?? 101)
        : (a.summary.run.start ?? 0) - (b.summary.run.start ?? 0));
  const featured = showAll ? filteredEvents : filteredEvents.slice(0, 6);
  const attendanceRows = allAttendance ? overview.events : overview.events.slice(0, 6);
  const timingRows = allTimings ? overview.events : overview.events.slice(0, 6);
  const chooseCategory = (next: InsightCategory) => { setCategory(next); setShowAll(false); };

  function updateRange(key: "start" | "end", value: string) {
    setRange((current) => ({ ...current, [key]: value }));
  }

  function acceptData(next: AnalysisData) {
    setData(next); setError(""); setSignInNeeded(false); setSelectedKey(null);
    setCategory("attention"); setShowAll(false); setAllAttendance(false); setAllTimings(false);
    if (dataMenu.current) dataMenu.current.open = false;
  }
  async function importData(file: File) {
    setBusy(true); setError("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Choose a JSON export smaller than 10 MiB.");
      acceptData(parseAnalysisData(JSON.parse(await file.text()), agenda, `Local import: ${file.name}`));
    } catch (e) { setError(e instanceof Error ? e.message : "This file could not be opened."); }
    finally { setBusy(false); }
  }
  async function loadHistory() {
    setBusy(true); setError(""); setSignInNeeded(false);
    try {
      const response = await fetch("/api/admin/analysis", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.status === 401) { setSignInNeeded(true); throw new Error("Sign in on this site to load its history. You can also import an event data file."); }
      const body = await response.json();
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "History is unavailable. Try importing an event data file.");
      acceptData(parseAnalysisData(body, agenda, "Hall audit database"));
    } catch (e) {
      setError(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "Loading took too long. Try again or import an event data file."
        : e instanceof Error ? e.message : "History could not be loaded.");
    } finally { setBusy(false); }
  }

  const takeawayCards: { key: InsightCategory; label: string; value: string; description: string; tone: string }[] = [
    { key: "low", label: "Low attendance", value: overview.hasMeasurements ? countLabel(overview.low.length) : "—", description: `Of ${overview.events.length} events · averaged below 25% full`, tone: "quiet" },
    { key: "drops", label: "Attendance dropped", value: overview.hasMeasurements ? countLabel(overview.drops.length) : "—", description: "Fell by 20 percentage points or more during an event", tone: "drop" },
    { key: "full", label: "Time spent full", value: overview.hasMeasurements ? readableDuration(overview.fullMs) : "—", description: `Across ${countLabel(overview.full.length)} · 100% occupied`, tone: "full" },
    { key: "empty", label: "Time spent empty", value: overview.hasMeasurements ? readableDuration(overview.emptyMs) : "—", description: `Across ${countLabel(overview.empty.length)} · 0% occupied`, tone: "quiet" },
  ];

  return <div className={styles.dashboard}>
    <HeaderTitle title="Post-event analysis" />
    <AdminNav active="/admin/analysis" />
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>DevFest Chennai 2026</p><h1>Event attendance</h1><p className={styles.subtitle}>Which events were quiet, filled up, or saw attendance fall?</p></div>
      <details ref={dataMenu} className={styles.dataMenu}>
        <summary>{busy ? "Loading…" : sourceLabel} <span aria-hidden="true">⌄</span></summary>
        <div className={styles.dataOptions}>
          <label className={styles.fileButton}>Import event data<input type="file" accept=".json,application/json" aria-label="Import event data" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); event.target.value = ""; }} /></label>
          <button disabled={busy} onClick={() => acceptData(sampleAnalysisData(agenda))}>View sample data</button>
          <button disabled={busy} onClick={() => void loadHistory()}>Load server history</button>
          <p>Local testing? Import your event data export. Server history requires a super-admin sign-in.</p>
        </div>
      </details>
    </header>

    <div className={styles.toolbar}>
      <details className={styles.rangePicker}>
        <summary><span className={styles.controlLabel}>Time range</span><span>{formatTime(istTime(range.start), true)} — {formatTime(istTime(range.end), true)} <span aria-hidden="true">⌄</span></span></summary>
        <div className={styles.rangeFields}>
          <label>From · IST<input type="datetime-local" value={range.start} onInput={(event) => updateRange("start", event.currentTarget.value)} onChange={(event) => updateRange("start", event.target.value)} /></label>
          <label>To · IST<input type="datetime-local" value={range.end} onInput={(event) => updateRange("end", event.currentTarget.value)} onChange={(event) => updateRange("end", event.target.value)} /></label>
          <button className={styles.textButton} onClick={() => setRange({ start: defaultSettings.start, end: defaultSettings.end })}>Reset to 17 Oct, 09:00–18:00</button>
        </div>
      </details>
      <label className={styles.delay}><span className={styles.controlLabel}>Schedule delay</span><span><input type="number" min={0} max={10080} value={delay} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) setDelay(Math.max(0, Math.min(10080, Math.round(value)))); }} aria-label="Schedule delay in minutes" /> min</span></label>
      <span className={styles.toolbarNote}>All times IST</span>
    </div>
    {isSample && <p className={styles.sampleNote}>You’re viewing sample data, not actual event attendance.</p>}
    {error && <div role="alert" className={styles.error}>{error} {signInNeeded && <a href="/signin?callbackUrl=%2Fadmin%2Fanalysis">Sign in →</a>}</div>}
    {rangeError && <p role="alert" className={styles.error}>{rangeError}</p>}

    {validRange && <>
      <section aria-label="Attendance overview" className={styles.takeaways}>
        {takeawayCards.map((card) => <button key={card.key} className={styles.takeaway} data-tone={card.tone} aria-pressed={category === card.key} onClick={() => chooseCategory(category === card.key ? "attention" : card.key)}>
          <span className={styles.takeawayLabel}>{card.label}</span><strong>{card.value}</strong>
          <span className={styles.takeawayDescription}>{card.description}</span><span className={styles.cardLink}>See events <span aria-hidden="true">↗</span></span>
        </button>)}
      </section>
      <p className={styles.measurementNote}>Occupancy is carried forward until the next update or event end. Gaps over 40 minutes are labeled; durations across events are added together.</p>
      {overview.missing > 0 && <p className={styles.note}>{countLabel(overview.missing)} had no occupancy reports covering this time range.</p>}

      <section className={styles.eventSection} aria-label="Event cards">
        <div className={styles.sectionHeading}><div><h2>{titles[category]}</h2><p>{category === "attention" ? "Start with the clearest attendance signals. Select an event for its timeline." : "Select an event to see when and how its occupancy changed."}</p></div><button className={styles.textButton} onClick={() => chooseCategory(category === "all" ? "attention" : "all")}>{category === "all" ? "Show highlights" : `All events (${overview.events.length})`}</button></div>
        <div className={styles.events}>
          {featured.map((event) => <button key={event.summary.run.key} className={styles.eventCard} onClick={() => setSelectedKey(event.summary.run.key)}>
            <span className={styles.eventMeta}>{trackName(event.summary.run.session.track)} <span>{formatTime(event.summary.run.start)}</span></span>
            <h3>{event.summary.run.session.title}</h3>
            <GapLabel event={event} />
            <p className={styles.eventTakeaway} data-tone={insightTone(event)}>{eventTakeaway(event, category)}</p>
            <div className={styles.occupancyBar} aria-hidden="true"><span style={{ width: `${event.average ?? 0}%` }} /></div>
            <span className={styles.eventFooter}><span>{event.summary.coverage < 50 ? "Limited reports" : event.lowAttendance ? "" : `${percent(event.average)} full on average`}</span><span>View timeline ↗</span></span>
          </button>)}
        </div>
        {!featured.length && <div className={styles.empty}>
          {!data.audit.length ? <><h3>Start with your event data</h3><p>Import an event data file, or explore a sample.</p><div className={styles.emptyActions}><label className={styles.primary}>Import event data<input type="file" accept=".json,application/json" aria-label="Import an event data file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); event.target.value = ""; }} /></label><button className={styles.secondary} onClick={() => acceptData(sampleAnalysisData(agenda))}>View sample data</button></div></>
            : <><h3>{!overview.events.length ? "No event reports in this time range" : "No matching attendance signals"}</h3><p>{!overview.events.length ? "Try another time range or import the complete event history." : "This means no matching pattern was reported; it doesn’t fill in missing updates."}</p>{overview.events.length > 0 && <button className={styles.textButton} onClick={() => chooseCategory("all")}>View all events →</button>}</>}
        </div>}
        {!showAll && filteredEvents.length > 6 && <button className={styles.moreButton} onClick={() => setShowAll(true)}>Show all {filteredEvents.length} events ↓</button>}
      </section>

      {overview.events.length > 0 && <>
        <section className={styles.comparisonSection} aria-label="Attendance comparison">
          <div className={styles.sectionHeading}><div><h2>How attendance changed</h2><p>Compare the highest reported occupancy, the opening and closing reports, and falls during an event.</p></div></div>
          <div className={styles.tableScroll}><table className={styles.comparison}><thead><tr><th>Event</th><th>Peak occupancy</th><th>Opening → closing</th><th>Recorded occupancy drops</th></tr></thead><tbody>
            {attendanceRows.map((event) => <tr key={event.summary.run.key}><td><button onClick={() => setSelectedKey(event.summary.run.key)}>{event.summary.run.session.title}</button><small>{trackName(event.summary.run.session.track)}</small><GapLabel event={event} /></td>
              <td><strong>{percent(event.summary.peak)}{event.summary.peak !== undefined ? " full" : ""}</strong><small>{event.summary.timeToPeak === undefined ? "Time to peak unknown" : `${readableDuration(event.summary.timeToPeak * MINUTE)} after start`}</small></td>
              <td>{event.summary.opening === undefined ? "Not reported" : `${percent(event.summary.opening)} → ${percent(event.summary.closing)}`}</td>
              <td>{event.recordedDrops.length ? event.recordedDrops.map(({ from, to }) => <div key={to.revision}><strong>{from.occupied}% → {to.occupied}%</strong><small>{formatTime(from.time)} → {formatTime(to.time)}</small></div>) : "No drop recorded"}</td></tr>)}
          </tbody></table></div>
          {overview.events.length > 6 && <button className={styles.moreButton} onClick={() => setAllAttendance(!allAttendance)}>{allAttendance ? "Show fewer events ↑" : `Compare all ${overview.events.length} events ↓`}</button>}
        </section>

        <section className={styles.comparisonSection} aria-label="Event timing comparison">
          <div className={styles.sectionHeading}><div><h2>Did events run on time?</h2><p>Planned times below include your {delay}-minute schedule delay.</p></div></div>
          <div className={styles.tableScroll}><table className={styles.comparison}><thead><tr><th>Event</th><th>Planned start / end</th><th>Recorded start / end</th><th>Compared with the plan</th></tr></thead><tbody>
            {timingRows.map((event) => { const plan = shifted(event.summary.run, settings); return <tr key={event.summary.run.key}>
              <td><button onClick={() => setSelectedKey(event.summary.run.key)}>{event.summary.run.session.title}</button><small>{trackName(event.summary.run.session.track)}</small></td>
              <td>{formatTime(plan.start)} / {formatTime(plan.end)}</td><td>{formatTime(event.summary.run.start)} / {formatTime(event.summary.run.end)}</td>
              <td><strong>Start: {timingDifference(event.summary.startDrift)}</strong><small>End: {timingDifference(event.summary.endDrift)}</small></td>
            </tr>; })}
          </tbody></table></div>
          {overview.events.length > 6 && <button className={styles.moreButton} onClick={() => setAllTimings(!allTimings)}>{allTimings ? "Show fewer events ↑" : `See all ${overview.events.length} event timings ↓`}</button>}
        </section>
      </>}
      {(analysis.history.issues.length > 0 || analysis.unassigned > 0) && <details className={styles.dataNotes}><summary>Some reports need more context</summary><p>{analysis.unassigned} occupancy reports could not be matched to a running event and are excluded from these event summaries.</p>{analysis.history.issues.map((issue) => <p key={issue}>{issue}</p>)}</details>}
    </>}

    <dialog ref={dialog} data-lenis-prevent className={styles.dialog} onClose={() => setSelectedKey(null)} aria-labelledby="event-detail-title">
      <button className={styles.closeButton} aria-label="Close event details" onClick={() => setSelectedKey(null)}>Close ×</button>
      {selected && <EventDetails key={selected.summary.run.key} event={selected} track={trackName(selected.summary.run.session.track)} start={analysis.start} end={analysis.end} delay={delay} />}
    </dialog>
  </div>;
}

function EventDetails({ event, track, start, end, delay }: {
  event: EventInsight; track: string; start: number; end: number; delay: number;
}) {
  const summary = event.summary;
  const chartStart = Math.max(start, summary.run.start ?? Date.parse(summary.run.session.start));
  const chartEnd = Math.min(end, summary.run.boundaryEnd ?? end);
  const plan = shifted(summary.run, { ...defaultSettings, shift: delay });
  const partial = (summary.run.start !== undefined && start > summary.run.start) || (summary.run.end !== undefined && end < summary.run.end);
  return <>
    <p className={styles.eyebrow}>{track}</p><h2 id="event-detail-title">{summary.run.session.title}</h2>
    <p className={styles.detailTakeaway}>{eventTakeaway(event)}</p>
    <p className={styles.note}>{formatTime(summary.run.start, true)} — {formatTime(summary.run.end, true)} IST{summary.run.resetEnded ? " · reporting ended with a reset" : ""}</p>
    <GapLabel event={event} />
    <EventOccupancyTimeline summary={summary} start={chartStart} end={Math.max(chartStart + 1, chartEnd)} />
    {event.longGaps.length > 0 && <p className={styles.note}>No occupancy updates for {event.longGaps.map((gap) => `${readableDuration(gap.end - gap.start)} (${formatTime(gap.start)}–${formatTime(gap.end)})`).join(", ")}. The last reported occupancy is used throughout.</p>}
    <div className={styles.detailMetrics}>
      <div><span>Peak occupancy</span><strong>{percent(summary.peak)}</strong><small>{summary.timeToPeak === undefined ? "Time unknown" : `${readableDuration(summary.timeToPeak * MINUTE)} after start`}</small></div>
      <div><span>Opening → closing</span><strong>{summary.opening === undefined ? "Not reported" : `${percent(summary.opening)} → ${percent(summary.closing)}`}</strong><small>First and last reports in this range</small></div>
      <div><span>Time full</span><strong>{event.measuredMs ? readableDuration(event.fullMs) : "Not reported"}</strong><small>At 100% occupied</small></div>
      <div><span>Time empty</span><strong>{event.measuredMs ? readableDuration(event.emptyMs) : "Not reported"}</strong><small>At 0% occupied</small></div>
    </div>
    {(event.fullPeriods.length > 0 || event.emptyPeriods.length > 0) && <details className={styles.periods}><summary>When was the hall full or empty?</summary><ul>
      {event.fullPeriods.map((period) => <li key={`full-${period.start}`}><span>Full · {formatTime(period.start)}–{formatTime(period.end)}</span><strong>{readableDuration(period.end - period.start)}</strong></li>)}
      {event.emptyPeriods.map((period) => <li key={`empty-${period.start}`}><span>Empty · {formatTime(period.start)}–{formatTime(period.end)}</span><strong>{readableDuration(period.end - period.start)}</strong></li>)}
    </ul></details>}
    {event.drop && <div className={styles.dropDetail}><h3>Attendance fell during this event</h3><p>{event.drop.from.occupied}% full at {formatTime(event.drop.from.time)} → {event.drop.to.occupied}% at {formatTime(event.drop.to.time)}.</p><small>{summary.run.end === undefined ? "The end was not recorded." : `${readableDuration(summary.run.end - event.drop.to.time)} before the recorded end.`} Occupancy reports don’t tell us why people left.</small></div>}
    <section className={styles.detailTiming}><h3>Start and end times</h3><p className={styles.note}>The plan includes a {delay}-minute delay. Recorded times are when organizers marked the event started or ended.</p><div className={styles.detailTimingGrid}>
      <div><span>Planned start</span><strong>{formatTime(plan.start)}</strong><span>Recorded start</span><strong>{formatTime(summary.run.start)}</strong><small>{timingDifference(summary.startDrift)}</small></div>
      <div><span>Planned end</span><strong>{formatTime(plan.end)}</strong><span>Recorded end</span><strong>{formatTime(summary.run.end)}</strong><small>{timingDifference(summary.endDrift)}</small></div>
    </div></section>
    <p className={styles.detailFootnote}>Reports and carried-forward occupancy cover {Math.round(summary.coverage)}% of this event’s selected time. Time before the first report stays unknown.{partial ? " You’re viewing part of the event; comparisons apply only to the selected range." : ""}</p>
  </>;
}
