"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import type { AgendaSession } from "@/lib/schemas";
import { siteConfig } from "@/site.config";
import { analyze, csv, defaultSettings, formatTime, istInput, istTime, median, MINUTE, parseAnalysisData, shifted, validateSettings, type AnalysisData, type Settings, type RunSummary } from "@/lib/post-event-analysis";
import { sampleAnalysisData } from "@/lib/post-event-sample";
import { Heatmap, OccupancyChart, TimingChart, RunSparkline } from "./AnalysisCharts";
import styles from "./PostEventDashboard.module.css";

const PANELS = ["history", "timing", "departures", "distribution", "reporting", "updates"] as const;
type Panel = typeof PANELS[number];
const TITLES: Record<Panel, string> = { history: "Occupancy history", timing: "Event timing & drift", departures: "Possible early departures", distribution: "Congestion & distribution", reporting: "Track leads & reporting coverage", updates: "Every occupancy update" };
const METRICS = ["updates", "peak", "coverage", "drops", "drift"] as const;
type Metric = typeof METRICS[number];
type View = { settings: Settings; panels: Panel[]; metrics: Metric[] };
const STORE = "devfest-post-event-view-v1", VIEWS = "devfest-post-event-saved-v1";
const emptyData = (agenda: AgendaSession[]): AnalysisData => ({ audit: [], agenda, actors: {}, source: "No dataset loaded", loadedAt: 0 });
const percent = (v?: number) => v === undefined ? "—" : `${v.toFixed(1)}%`;
const minutes = (v?: number) => v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}m`;
const duration = (v?: number) => v === undefined ? "—" : `${v.toFixed(1)}m`;
function parseView(raw: unknown): View {
  if (!raw || typeof raw !== "object") throw new Error("Invalid view settings.");
  const v = raw as Record<string, unknown>;
  return { settings: validateSettings(v.settings), panels: Array.isArray(v.panels) ? [...new Set(v.panels.filter((p): p is Panel => PANELS.includes(p as Panel)))] : [...PANELS], metrics: Array.isArray(v.metrics) ? [...new Set(v.metrics.filter((p): p is Metric => METRICS.includes(p as Metric)))] : [...METRICS] };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
function Multi({ label, options, value, onChange }: { label: string; options: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return <div className={styles.field}><span>{label}</span><details className={styles.multi}><summary>{value.length ? `${value.length} selected` : `All ${label.toLowerCase()}`} ▾</summary><div><button className={styles.button} type="button" onClick={() => onChange([])}>Clear selection</button>{options.map((o) => <label key={o.id} className={styles.check}><input type="checkbox" checked={value.includes(o.id)} onChange={() => onChange(value.includes(o.id) ? value.filter((id) => id !== o.id) : [...value, o.id])} />{o.name}</label>)}{!options.length && <p className={styles.note}>Load data to see options.</p>}</div></details></div>;
}
function Numeric({ label, value, onChange, min = 0, max = 10080 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return <Field label={label}><input type="number" min={min} max={max} value={value} onChange={(e) => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n))); }} /></Field>;
}

export function PostEventDashboard({ agenda }: { agenda: AgendaSession[] }) {
  const [data, setData] = useState<AnalysisData>(() => emptyData(agenda));
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [panels, setPanels] = useState<Panel[]>([...PANELS]);
  const [metrics, setMetrics] = useState<Metric[]>([...METRICS]);
  const [saved, setSaved] = useState<Record<string, View>>({});
  const [viewName, setViewName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportFile, setExportFile] = useState<{ name: string; content: string; type: string; url: string } | null>(null);
  const exportDialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: "time" | "occupied" | "zone" | "actor" | "event" | "delta" | "revision"; ascending: boolean }>({ key: "time", ascending: true });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspectTime, setInspectTime] = useState(istTime(defaultSettings.start));
  const [leadGroup, setLeadGroup] = useState<"actor" | "track">("track");
  const [actionKind, setActionKind] = useState("all");
  function download(name: string, content: string, type = "text/csv;charset=utf-8") {
    setExportFile({ name, content, type, url: URL.createObjectURL(new Blob([content], { type })) });
  }
  const ready = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<File | null>(null);
  const chartRegion = useRef<HTMLDivElement>(null);
  const configuredZones = siteConfig.tracks.map((t) => ({ id: t.slug as string, name: t.name as string }));
  const historicalZones = [...new Set(data.audit.flatMap((row) => row.payload.kind === "occupancy" || row.payload.kind === "session" ? [row.payload.zone] : []))].filter((id) => !configuredZones.some((zone) => zone.id === id));
  const zones = [...configuredZones, ...historicalZones.map((id) => ({ id, name: `${id} (historical track)` }))];
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const actorName = (id: string) => Object.hasOwn(data.actors, id) ? data.actors[id] : id;
  const view = useMemo(() => ({ settings, panels, metrics }), [settings, panels, metrics]);
  function applyView(v: View) { setSettings(v.settings); setPanels(v.panels); setMetrics(v.metrics); setPage(0); setSelected(null); }

  useEffect(() => {
    // Browser-only preferences hydrate after the static shell; no dataset is persisted.
    Promise.resolve().then(() => {
      try {
        const shared = new URLSearchParams(location.search).get("view");
        const stored = localStorage.getItem(STORE);
        if (shared || stored) applyView(parseView(JSON.parse(shared || stored!)));
        const views = JSON.parse(localStorage.getItem(VIEWS) ?? "{}");
        if (views && typeof views === "object" && !Array.isArray(views)) {
          const valid: Record<string, View> = {};
          for (const [name, value] of Object.entries(views)) { try { valid[name] = parseView(value); } catch { /* Ignore obsolete saved views. */ } }
          setSaved(valid);
        }
      } catch { setMessage("Some saved settings were invalid; defaults are available with Reset view."); }
      if (new URLSearchParams(location.search).get("sample") === "1") setData(sampleAnalysisData(agenda));
      ready.current = true;
    });
  }, [agenda]);
  useEffect(() => {
    if (!ready.current) return;
    try { localStorage.setItem(STORE, JSON.stringify(view)); } catch { /* Storage may be unavailable; controls still work. */ }
  }, [view]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);

  useEffect(() => {
    if (exportFile && !exportDialog.current?.open) exportDialog.current?.showModal();
    if (!exportFile && exportDialog.current?.open) exportDialog.current.close();
    return () => { if (exportFile) URL.revokeObjectURL(exportFile.url); };
  }, [exportFile]);

  let validationError = "";
  try { validateSettings(settings); } catch { validationError = "Choose valid start and end times in IST, with end after start (maximum 366 days)."; }
  const valid = !validationError;
  const analysis = useMemo(() => analyze(data, valid ? settings : defaultSettings), [data, settings, valid]);
  const selectedZones = zones.filter((z) => !settings.tracks.length || settings.tracks.includes(z.id));
  const eventOptions = data.agenda.filter((s) => s.track && s.type !== "break" && (!settings.tracks.length || settings.tracks.includes(s.track))).map((s) => ({ id: s.id, name: s.title }));
  const actorOptions = [...new Set(data.audit.map((r) => r.actor))].map((id) => ({ id, name: actorName(id) }));
  const selectedSummary = analysis.summaries.find((s) => s.run.key === selected);
  const noData = !data.audit.length;
  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setSettings((s) => ({ ...s, [key]: value })); setPage(0); }
  function selectEvent(key: string) { setSelected(key); }
  function zoom(a: number, b: number) { if (b <= a) return; setSettings((s) => ({ ...s, start: istInput(a), end: istInput(Math.max(a + MINUTE, b)) })); setPage(0); }
  function resetView() { applyView({ settings: { ...defaultSettings }, panels: [...PANELS], metrics: [...METRICS] }); history.replaceState(null, "", location.pathname + (new URLSearchParams(location.search).get("lite") ? `?lite=${new URLSearchParams(location.search).get("lite")}` : "")); setMessage("View reset to 17 October, 09:00–18:00 IST."); }
  function acceptData(next: AnalysisData) { setData(next); setSelected(null); setPage(0); setError(""); setMessage(`Loaded ${next.audit.length} audit records. Preferences and time range retained.`); }
  async function importFile(upload: File) {
    setBusy(true); setError("");
    try {
      if (upload.size > 10 * 1024 * 1024) throw new Error("Choose a JSON file under 10 MiB.");
      const next = parseAnalysisData(JSON.parse(await upload.text()), agenda, `Local import: ${upload.name}`);
      file.current = upload; acceptData(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import this file."); } finally { setBusy(false); }
  }
  async function refreshDatabase() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/analysis", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not load history. Sign in as a super-admin.");
      file.current = null; acceptData(parseAnalysisData(body, agenda, "Hall audit database"));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load history."); } finally { setBusy(false); }
  }
  function saveView() {
    const name = viewName.trim();
    if (!name || !valid) { setError("Enter a view name and a valid time range."); return; }
    const next = { ...saved, [name]: view };
    try { localStorage.setItem(VIEWS, JSON.stringify(next)); setSaved(next); setMessage(`Saved view “${name}”.`); setError(""); } catch { setError("Browser storage is unavailable; export the view JSON instead."); }
  }
  async function shareView() {
    if (!valid) return;
    const url = new URL(location.href); url.searchParams.delete("sample"); url.searchParams.set("view", JSON.stringify(view));
    history.replaceState(null, "", url);
    try { await navigator.clipboard.writeText(url.toString()); setMessage("View link copied. It shares settings only; recipients must load their own authorized dataset."); } catch { setMessage("The address bar now contains the shareable view link. Copy it to share settings only."); }
  }
  function movePanel(panel: Panel, delta: number) {
    const next = [...panels], i = next.indexOf(panel), j = i + delta;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; setPanels(next);
  }
  function panelHeader(panel: Panel, description: string) {
    return <div className={styles.panelHeader}><div><h2>{TITLES[panel]}</h2><p className={styles.note}>{description}</p></div><div className={styles.panelTools}><button aria-label={`Move ${TITLES[panel]} up`} disabled={panels.indexOf(panel) === 0} onClick={() => movePanel(panel, -1)}>↑</button><button aria-label={`Move ${TITLES[panel]} down`} disabled={panels.indexOf(panel) === panels.length - 1} onClick={() => movePanel(panel, 1)}>↓</button><button aria-label={`Hide ${TITLES[panel]}`} onClick={() => setPanels(panels.filter((p) => p !== panel))}>×</button></div></div>;
  }
  function exportCharts() {
    const originals = [...(chartRegion.current?.querySelectorAll("svg") ?? [])];
    if (!originals.length) { setMessage("Show the occupancy history panel to export charts."); return; }
    const outer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    outer.setAttribute("xmlns", "http://www.w3.org/2000/svg"); outer.setAttribute("viewBox", `0 0 1300 ${Math.ceil(originals.length / 2) * 210 + 70}`);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text"); title.textContent = `${data.source} · ${settings.start} — ${settings.end} IST`; title.setAttribute("x", "20"); title.setAttribute("y", "25"); title.setAttribute("fill", "currentColor"); outer.appendChild(title);
    originals.forEach((original, i) => {
      const copy = original.cloneNode(true) as SVGElement;
      [original, ...original.querySelectorAll("*")].forEach((el, j) => {
        const target = [copy, ...copy.querySelectorAll("*")][j] as SVGElement;
        const computed = getComputedStyle(el);
        for (const property of ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-family", "font-size", "opacity"]) target.style.setProperty(property, computed.getPropertyValue(property));
      });
      copy.setAttribute("x", `${(i % 2) * 650}`); copy.setAttribute("y", `${Math.floor(i / 2) * 210 + 90}`); copy.setAttribute("width", "650"); copy.setAttribute("height", "164");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text"); label.textContent = selectedZones[i]?.name ?? "Track"; label.setAttribute("x", `${(i % 2) * 650 + 36}`); label.setAttribute("y", `${Math.floor(i / 2) * 210 + 75}`); label.setAttribute("fill", "currentColor"); outer.appendChild(label); outer.appendChild(copy);
    });
    outer.style.fontFamily = '"Google Sans", sans-serif';
    outer.style.background = getComputedStyle(document.documentElement).getPropertyValue("--ink"); outer.style.color = getComputedStyle(document.documentElement).getPropertyValue("--paper");
    download("occupancy-charts.svg", new XMLSerializer().serializeToString(outer), "image/svg+xml");
  }

  const tableRows = useMemo(() => {
    const previous = new Map<string, number>();
    return analysis.readings.map((r) => {
      const key = `${r.zone}:${r.runKey ?? "outside"}`, before = previous.get(key); previous.set(key, r.occupied);
      return { ...r, event: analysis.runMap.get(r.runKey ?? "")?.session.title ?? "Outside recorded event", delta: before === undefined ? undefined : r.occupied - before };
    }).filter((r) => `${r.event} ${r.zone} ${data.actors[r.actor] ?? r.actor} ${r.revision} ${r.occupied}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
      const av = sort.key === "actor" ? (data.actors[a.actor] ?? a.actor) : a[sort.key];
      const bv = sort.key === "actor" ? (data.actors[b.actor] ?? b.actor) : b[sort.key];
      const result = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av ?? -Infinity) - Number(bv ?? -Infinity);
      return (Number.isNaN(result) ? 0 : result) * (sort.ascending ? 1 : -1);
    });
  }, [analysis, search, sort, data.actors]);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize)), currentPage = Math.min(page, totalPages - 1);
  function exportUpdates() {
    download("occupancy-updates.csv", csv([["Revision", "Time (IST)", "Track", "Event", "Reporter", "Occupied (%)", "Change (pp)", "Estimated occupants"], ...tableRows.map((r) => [r.revision, `${istInput(r.time).replace("T", " ")} IST`, zoneName(r.zone), r.event, actorName(r.actor), r.occupied, r.delta, settings.capacities[r.zone] ? Math.round(settings.capacities[r.zone] * r.occupied / 100) : undefined])]));
  }
  function exportSummaries() {
    download("event-analysis.csv", csv([["Event", "Track", "Run", "Timing basis", "Original start IST", "Original end IST", "Adjusted start IST", "Adjusted end IST", "Recorded start IST", "Recorded end IST", "Start drift min", "End drift min", "Coverage %", "Time-weighted occupied %", "Observed peak %", "Time to peak min", "Opening %", "Closing %", "Change pp", "Largest consecutive drop pp", "Recovered", "Updates", "Drop flags"], ...analysis.summaries.map((s) => { const adjusted = shifted(s.run, settings); return [s.run.session.title, zoneName(s.run.session.track!), s.run.key, s.run.inferred ? "Inferred" : "Recorded / missing", istInput(Date.parse(s.run.session.start)), istInput(Date.parse(s.run.session.end)), istInput(adjusted.start), istInput(adjusted.end), s.run.inferred || s.run.start === undefined ? undefined : istInput(s.run.start), s.run.end === undefined ? undefined : istInput(s.run.end), s.startDrift, s.endDrift, s.coverage, s.average, s.peak, s.timeToPeak, s.opening, s.closing, s.change, s.largestDrop, s.recovered ? "yes" : "no", s.readings.length, analysis.flags.filter((f) => f.run.key === s.run.key).length]; })]));
  }
  const drift = median(analysis.summaries.flatMap((s) => s.startDrift === undefined ? [] : [s.startDrift]));
  const metricValues: Record<Metric, { label: string; value: string; hint: string }> = {
    updates: { label: "Occupancy reports", value: `${analysis.readings.length}`, hint: `${analysis.runs.length} event runs in view` },
    peak: { label: "Observed peak", value: percent(analysis.peak), hint: "Highest submitted reading" },
    coverage: { label: "Fresh-data coverage", value: percent(analysis.coverage), hint: `Across event-track minutes · ${settings.freshness}m cutoff` },
    drops: { label: "Departure signals", value: `${analysis.flags.length}`, hint: "Review context before interpreting" },
    drift: { label: "Median start drift", value: minutes(drift), hint: "Against adjusted schedule" },
  };
  const pointTime = Math.min(analysis.end - 1, Math.max(analysis.start, inspectTime));
  const snapshot = selectedZones.map((zone) => {
    const segment = analysis.segments.find((s) => s.reading.zone === zone.id && s.start <= pointTime && s.end > pointTime);
    const capacity = settings.capacities[zone.id];
    return { zone, segment, capacity, count: segment && capacity ? capacity * segment.reading.occupied / 100 : undefined };
  });
  const totalKnown = snapshot.reduce((n, s) => n + (s.count ?? 0), 0);
  const leadActions = analysis.actions.filter((a) => actionKind === "all" || a.payload.kind === actionKind);
  const leadKeys = [...new Set(leadActions.map((a) => leadGroup === "track" ? a.zone : a.actor))];

  return <div className={styles.dashboard}>
    <HeaderTitle title="Post-event analysis" /><AdminNav active="/admin/analysis" />
    <header className={styles.top}><div><p className={styles.eyebrow}>DevFest Chennai / Organizer workspace</p><h1 className={styles.title}>The day, in perspective.</h1><p className={styles.subtitle}>Explore reported occupancy, session timing and the gaps in between. Every insight traces back to a submitted update.</p></div><div className={styles.actions}>
      <label className={styles.fileLabel}>Import audit JSON<input aria-label="Import audit JSON" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => { const upload = e.target.files?.[0]; if (upload) void importFile(upload); e.target.value = ""; }} /></label>
      <button className={styles.button} disabled={busy} onClick={() => { file.current = null; acceptData(sampleAnalysisData(agenda)); }}>Try sample data</button>
      <button className={styles.primary} disabled={busy} onClick={() => void refreshDatabase()}>Load database history</button>
    </div></header>
    <div className={styles.source}><div><strong>{data.source}</strong><p className={styles.note}>{noData ? "Import an existing export to analyze offline, or use synthetic sample reports to explore the controls." : `${data.audit.length} audit records · loaded ${formatTime(data.loadedAt, true)} IST · analysis range is independent of refresh time`}</p></div><div className={styles.actions}><button className={styles.button} disabled={busy || noData} onClick={() => { if (file.current) void importFile(file.current); else if (data.source === "Hall audit database") void refreshDatabase(); else acceptData(sampleAnalysisData(agenda)); }}>Refresh source</button><button className={styles.button} disabled={noData} onClick={() => { setData(emptyData(agenda)); file.current = null; setSelected(null); setMessage("Dataset cleared from this page."); }}>Clear data</button></div></div>
    <p className={styles.note}>Imports stay in this browser tab. No background refresh. Database loading requires super-admin sign-in. All times use Asia/Kolkata (IST).</p>
    <div role="status" aria-live="polite" className={styles.note}>{busy ? "Loading history…" : message}</div>{error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.filters} aria-label="Analysis filters"><div className={styles.filterGrid}>
      <Field label="From · IST"><input type="datetime-local" value={settings.start} onInput={(e) => update("start", e.currentTarget.value)} onChange={(e) => update("start", e.target.value)} /></Field>
      <Field label="Until · IST (exclusive)"><input type="datetime-local" value={settings.end} onInput={(e) => update("end", e.currentTarget.value)} onChange={(e) => update("end", e.target.value)} /></Field>
      <Multi label="Tracks" options={zones} value={settings.tracks} onChange={(v) => update("tracks", v)} />
      <Multi label="Events" options={eventOptions} value={settings.events} onChange={(v) => update("events", v)} />
      <Multi label="Reporters" options={actorOptions} value={settings.actors} onChange={(v) => update("actors", v)} />
    </div><div className={styles.filterFooter}><button className={styles.button} onClick={() => { update("start", defaultSettings.start); update("end", defaultSettings.end); }}>17 Oct · 09:00–18:00</button><button className={styles.button} disabled={noData} onClick={() => zoom(Math.min(...data.audit.map((r) => r.changed_at)), Math.max(...data.audit.map((r) => r.changed_at)) + MINUTE)}>Full recorded history</button><button className={styles.button} onClick={resetView}>Reset view</button><button className={styles.button} disabled={!valid} onClick={() => void shareView()}>Share view</button><span className={styles.note}>Freshness {settings.freshness}m · schedule shift {minutes(settings.shift)}</span></div></section>
    {validationError && <p role="alert" className={styles.error}>{validationError}</p>}

    <details className={styles.settings}><summary>Customize analysis, detection rules & layout</summary><div className={styles.settingsGrid}>
      <div className={styles.settingsGroup}><h3>Schedule & freshness</h3><Numeric label="Global schedule shift · hours" value={Math.trunc(settings.shift / 60)} min={-168} max={168} onChange={(v) => update("shift", v * 60 + settings.shift % 60)} /><Numeric label="Additional minutes · signed" value={settings.shift % 60} min={-59} max={59} onChange={(v) => update("shift", Math.trunc(settings.shift / 60) * 60 + v)} /><Numeric label="Freshness cutoff · minutes" value={settings.freshness} min={1} max={120} onChange={(v) => update("freshness", v)} />
        <label className={styles.check}><input type="checkbox" checked={settings.carry} onChange={(e) => update("carry", e.target.checked)} />Carry forward while fresh</label><label className={styles.check}><input type="checkbox" checked={settings.outside} onChange={(e) => update("outside", e.target.checked)} />Include reports outside an event</label><label className={styles.check}><input type="checkbox" checked={settings.infer} onChange={(e) => update("infer", e.target.checked)} />Infer missing event windows from adjusted agenda</label><p className={styles.note}>Point-only mode makes no duration assumptions. Inferred windows are labeled and excluded from departure detection.</p>
      </div>
      <div className={styles.settingsGroup}><h3>Departure signals</h3><Numeric label="Minimum prior occupancy · %" value={settings.high} max={100} onChange={(v) => update("high", v)} /><Numeric label="Minimum drop · percentage points" value={settings.drop} min={1} max={100} onChange={(v) => update("drop", v)} /><Numeric label="Consecutive low readings required" value={settings.confirmations} min={1} max={10} onChange={(v) => update("confirmations", Math.round(v))} /><Numeric label="Maximum gap between readings · min" value={settings.maxGap} min={1} max={120} onChange={(v) => update("maxGap", v)} /><Numeric label="Ignore drops within minutes of end" value={settings.endBuffer} max={120} onChange={(v) => update("endBuffer", v)} /></div>
      <div className={styles.settingsGroup}><h3>Distribution</h3><Numeric label="Heatmap bucket · minutes" value={settings.bucket} min={1} max={1440} onChange={(v) => update("bucket", v)} /><Numeric label="Congestion threshold · % occupied" value={settings.congestion} min={1} max={100} onChange={(v) => update("congestion", v)} /><label className={styles.check}><input type="checkbox" checked={settings.headcounts} onChange={(e) => update("headcounts", e.target.checked)} />Show estimated headcounts</label><p className={styles.note}>Enter capacities only for independently measured spaces. Tracks sharing a room must not be counted twice. Estimates are not unique attendees.</p>{selectedZones.map((z) => <Field key={z.id} label={`${z.name} · capacity`}><input type="number" min={1} max={100000} placeholder="Unknown" value={settings.capacities[z.id] ?? ""} onChange={(e) => { const next = { ...settings.capacities }; if (!e.target.value) delete next[z.id]; else if (Number.isInteger(e.target.valueAsNumber) && e.target.valueAsNumber > 0 && e.target.valueAsNumber <= 100000) next[z.id] = e.target.valueAsNumber; update("capacities", next); }} /></Field>)}</div>
      <div className={styles.settingsGroup}><h3>Panels & overview cards</h3>{PANELS.map((panel) => <label className={styles.check} key={panel}><input type="checkbox" checked={panels.includes(panel)} onChange={() => setPanels(panels.includes(panel) ? panels.filter((p) => p !== panel) : [...panels, panel])} />{TITLES[panel]}</label>)}{METRICS.map((metric) => <label className={styles.check} key={metric}><input type="checkbox" checked={metrics.includes(metric)} onChange={() => setMetrics(metrics.includes(metric) ? metrics.filter((m) => m !== metric) : [...metrics, metric])} />{metricValues[metric].label}</label>)}</div>
    </div><div className={styles.overrides}>
      <div><h3>Track schedule overrides · total minutes</h3><p className={styles.note}>Blank inherits the global shift. An override replaces it; it does not add to it.</p><div className={styles.overrideList}>{zones.map((z) => <label key={z.id} className={`${styles.field} ${styles.overrideRow}`}><span>{z.name}</span><input type="number" min={-10080} max={10080} placeholder={`${settings.shift}`} value={settings.trackShifts[z.id] ?? ""} onChange={(e) => { const next = { ...settings.trackShifts }; if (!e.target.value) delete next[z.id]; else if (Number.isFinite(e.target.valueAsNumber)) next[z.id] = Math.max(-10080, Math.min(10080, e.target.valueAsNumber)); update("trackShifts", next); }} /></label>)}</div></div>
      <div><h3>Event schedule overrides · total minutes</h3><p className={styles.note}>Blank inherits its track or global shift. Both planned start and end move together.</p><div className={styles.overrideList}>{eventOptions.map((event) => <label key={event.id} className={`${styles.field} ${styles.overrideRow}`}><span>{event.name}</span><input type="number" min={-10080} max={10080} placeholder="Inherit" value={settings.eventShifts[event.id] ?? ""} onChange={(e) => { const next = { ...settings.eventShifts }; if (!e.target.value) delete next[event.id]; else if (Number.isFinite(e.target.valueAsNumber)) next[event.id] = Math.max(-10080, Math.min(10080, e.target.valueAsNumber)); update("eventShifts", next); }} /></label>)}</div></div>
    </div></details>
    <details className={styles.settings}><summary>Saved views & exports</summary><div className={styles.settingsGrid}>
      <Field label="View name"><input maxLength={80} value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. Afternoon / high coverage" /></Field><div className={styles.actions}><button className={styles.button} onClick={saveView}>Save current view</button></div><Field label="Load a saved view"><select value="" onChange={(e) => { if (saved[e.target.value]) { applyView(saved[e.target.value]); setViewName(e.target.value); setMessage(`Loaded view “${e.target.value}”.`); } }}><option value="">Choose a view</option>{Object.keys(saved).map((name) => <option key={name}>{name}</option>)}</select></Field><button className={styles.button} disabled={!saved[viewName]} onClick={() => { const next = { ...saved }; delete next[viewName]; try { localStorage.setItem(VIEWS, JSON.stringify(next)); setSaved(next); setMessage("Saved view deleted."); } catch { setError("Could not update browser storage."); } }}>Delete named view</button>
    </div><div className={`${styles.actions} mt-4`}><button className={styles.button} disabled={!valid} onClick={() => download("analysis-view.json", JSON.stringify(view, null, 2), "application/json")}>Export view JSON</button><label className={styles.fileLabel}>Import view JSON<input type="file" accept=".json,application/json" aria-label="Import view JSON" onChange={async (e) => { const upload = e.target.files?.[0]; e.target.value = ""; if (!upload) return; try { if (upload.size > 100000) throw new Error("View file is too large."); applyView(parseView(JSON.parse(await upload.text()))); setMessage("View imported."); } catch { setError("Invalid view JSON. Dataset and current view retained."); } }} /></label><button className={styles.button} disabled={noData || !valid} onClick={exportUpdates}>Export filtered updates CSV</button><button className={styles.button} disabled={noData || !valid} onClick={exportSummaries}>Export event summaries CSV</button><button className={styles.button} disabled={noData || !valid} onClick={exportCharts}>Export occupancy charts SVG</button><button className={styles.button} onClick={() => window.print()}>Print / save PDF</button><button className={styles.button} disabled={noData} onClick={() => download("hall-analysis-bundle.json", JSON.stringify({ audit: data.audit, agenda: data.agenda, actors: data.actors }, null, 2), "application/json")}>Export full dataset JSON</button></div><p className={styles.note}>Saved views remember filters and layout, not audit records. Dataset exports include reporter identifiers/names. Update CSV follows search and sorting; summary CSV follows the dashboard filters.</p></details>

    {valid && <>
      <div className={styles.metrics}>{metrics.map((metric) => <div key={metric} className={styles.metric}><p className={styles.metricLabel}>{metricValues[metric].label}</p><p className={styles.metricValue}>{metricValues[metric].value}</p><p className={styles.metricHint}>{metricValues[metric].hint}</p></div>)}</div>
      {!!settings.actors.length && <p className={styles.note}>Reporter filter active: occupancy and coverage describe only selected reporters’ contributions. Other reporters still supersede earlier readings.</p>}
      <details className={styles.settings}><summary>Data quality & interpretation · {analysis.history.issues.length} audit warnings · {analysis.unassigned} readings outside a matched event</summary><p className={styles.note}>Reported percentages are estimates, not person counts. Empty periods mean unknown. Start/end timestamps record button actions. A drop does not establish disinterest. Repeated starts are separate event runs. Resets terminate validity without inventing end times. Metrics describe the selected range, so opening/closing and time-to-peak may be partial-window observations.</p>{analysis.history.issues.map((issue) => <p key={issue} className={styles.note}>• {issue}</p>)}<p className={styles.note}>The agenda bundled with this dataset is used for event attribution. Import an event-day agenda snapshot if the schedule has changed since the event. Unknown event IDs are reported above. Inferred sessions never override recorded lifecycle.</p></details>
      <div className={styles.panels}>{panels.map((panel) => <section key={panel} className={styles.panel} aria-label={TITLES[panel]}>
        {panel === "history" && <>{panelHeader(panel, "Submitted readings, with fresh intervals shaded blue. Dashed markers show event starts. Click a point for evidence or the strip beneath a chart to zoom.")}<div className={styles.actions}><button className={styles.button} onClick={() => update("tracks", [])}>Compare all tracks</button><span className={styles.note}>Zoom using the time range or an event strip · Reset view restores the full event window</span></div><div ref={chartRegion} className={`${styles.chartGrid} mt-4`}>{selectedZones.map((zone) => <div key={zone.id} className={styles.chartCard}><div className={styles.chartTitle}><button onClick={() => update("tracks", [zone.id])}>{zone.name} ↗</button><span>{analysis.readings.filter((r) => r.zone === zone.id).length} reports</span></div><OccupancyChart analysis={analysis} zone={zone.id} onSelect={selectEvent} onZoom={zoom} /></div>)}</div></>}
        {panel === "timing" && <>{panelHeader(panel, "Compare the agenda, your shifted plan and recorded manual actions. Drift is measured against the shifted plan; the original remains visible.")}<div className={styles.legend}><span>Original agenda</span><span>Adjusted plan</span><span>Recorded actions</span></div><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Event / track</th><th>Timeline · {formatTime(analysis.start)}–{formatTime(analysis.end)} IST</th><th>Recorded start / end</th><th>Start drift<br />adjusted / original</th><th>End drift<br />adjusted / original</th></tr></thead><tbody>{analysis.summaries.map((s) => <tr key={s.run.key}><td><button className={styles.link} onClick={() => selectEvent(s.run.key)}>{s.run.session.title}</button><p className={styles.note}>{zoneName(s.run.session.track!)} {s.run.inferred && <span className={styles.pill}>Inferred window</span>}</p></td><td><TimingChart run={s.run} settings={settings} start={analysis.start} end={analysis.end} onSelect={selectEvent} /></td><td>{s.run.inferred ? "Inferred" : formatTime(s.run.start)}<br />{formatTime(s.run.end)}{s.run.resetEnded && <p className={styles.note}>Reset boundary</p>}</td><td>{minutes(s.startDrift)} / {minutes(s.originalStartDrift)}</td><td>{minutes(s.endDrift)} / {minutes(s.originalEndDrift)}</td></tr>)}</tbody></table>{!analysis.summaries.length && <p className={styles.empty}>No event runs match these filters. Missing lifecycle can be inspected with inferred windows enabled.</p>}</div></>}
        {panel === "departures" && <>{panelHeader(panel, `Signals require prior occupancy ≥${settings.high}%, a ≥${settings.drop}pp drop, ${settings.confirmations} low reading(s) and gaps ≤${settings.maxGap}m. Last ${settings.endBuffer}m before recorded end excluded.`)}<p className={styles.note}>Possible early departures, corrections or other movement. Review the evidence; these reports cannot tell us why people left.</p><div className={`${styles.dropGrid} mt-4`}>{analysis.flags.map((flag) => <button key={flag.to.revision} className={styles.dropCard} onClick={() => selectEvent(flag.run.key)}><span className={styles.dropNumber}>−{flag.drop}pp</span><span className={`${styles.pill} ml-3`}>{flag.confidence}</span><strong>{flag.run.session.title}</strong><p className={styles.note}>{zoneName(flag.to.zone)} · {formatTime(flag.to.time)} IST</p><p className={styles.note}>{flag.reason}</p><RunSparkline summary={analysis.summaries.find((s) => s.run.key === flag.run.key)!} /></button>)}</div>{!analysis.flags.length && <p className={styles.empty}>No signals match the current rules. This does not establish that no one left.</p>}</>}
        {panel === "distribution" && <>{panelHeader(panel, "Compare simultaneous fresh reports. Percentages show room utilization; they do not establish each track’s share of people.")}<Heatmap analysis={analysis} settings={settings} zones={selectedZones} onTime={setInspectTime} /><div className={`${styles.actions} mt-5`}><Field label="Compare tracks at · IST"><input type="datetime-local" min={settings.start} max={settings.end} value={istInput(pointTime)} onInput={(e) => { const n = istTime(e.currentTarget.value); if (Number.isFinite(n)) setInspectTime(n); }} onChange={(e) => { const n = istTime(e.target.value); if (Number.isFinite(n)) setInspectTime(n); }} /></Field><span className={styles.note}>Reading must still be fresh at this exact time. Bucket averages may have partial coverage.</span></div><div className={styles.distribution}>{snapshot.map(({ zone, segment, capacity, count }) => <button key={zone.id} className={styles.distributionRow} onClick={() => { if (segment?.reading.runKey) selectEvent(segment.reading.runKey); else update("tracks", [zone.id]); }}><span>{zone.name}</span><strong className="float-right">{segment ? `${segment.reading.occupied}%` : "Unknown"}</strong><div className={styles.bar}><span style={{ width: `${segment?.reading.occupied ?? 0}%` }} /></div><p className={styles.note}>{segment ? `Reported ${formatTime(segment.reading.time)} · ${((pointTime - segment.reading.time) / MINUTE).toFixed(1)}m old${segment.reading.occupied >= settings.congestion ? " · congested" : ""}` : "No fresh reading"}</p>{settings.headcounts && <p className={styles.note}>{count === undefined ? "Capacity or fresh reading missing" : `≈${Math.round(count)} / ${capacity} occupants · ${totalKnown ? (count / totalKnown * 100).toFixed(1) : "0"}% of estimable occupants`}</p>}</button>)}</div>{settings.headcounts && <p className={styles.note}>Shares cover only tracks with both a capacity and a fresh reading. Do not interpret them as whole-event attendance.</p>}</>}
        {panel === "reporting" && <>{panelHeader(panel, "Successful submissions, reporting gaps and session coverage. Blue dots are occupancy reports; yellow dots are start/end actions.")}<div className={styles.actions}><Field label="Group updates by"><select value={leadGroup} onChange={(e) => setLeadGroup(e.target.value as "actor" | "track")}><option value="track">Track</option><option value="actor">Reporter</option></select></Field><Field label="Action type"><select value={actionKind} onChange={(e) => setActionKind(e.target.value)}><option value="all">Occupancy + lifecycle</option><option value="occupancy">Occupancy only</option><option value="session">Starts / ends only</option></select></Field></div><div className={`${styles.tableScroll} mt-4`}><table className={styles.table}><thead><tr><th>{leadGroup === "track" ? "Track" : "Reporter"}</th><th>Updates</th><th>First / last · IST</th><th>Median gap</th><th>Longest gap</th><th>Update timeline · {formatTime(analysis.start)}–{formatTime(analysis.end)}</th></tr></thead><tbody>{leadKeys.map((key) => {
          const actions = leadActions.filter((a) => (leadGroup === "track" ? a.zone : a.actor) === key).sort((a, b) => a.changed_at - b.changed_at);
          const gaps = actions.slice(1).map((a, i) => (a.changed_at - actions[i].changed_at) / MINUTE);
          return <tr key={key}><td><button className={styles.link} onClick={() => leadGroup === "track" ? update("tracks", [key]) : update("actors", [key])}>{leadGroup === "track" ? zoneName(key) : actorName(key)}</button></td><td>{actions.length}</td><td>{formatTime(actions[0]?.changed_at)} / {formatTime(actions.at(-1)?.changed_at)}</td><td>{duration(median(gaps))}</td><td>{gaps.length ? duration(Math.max(...gaps)) : "—"}</td><td><div className={styles.updateTimeline}>{actions.map((a) => <button key={a.revision} data-kind={a.payload.kind} className={styles.updateDot} style={{ left: `${(a.changed_at - analysis.start) / (analysis.end - analysis.start) * 100}%` }} title={`${actorName(a.actor)} · ${a.payload.kind} · ${formatTime(a.changed_at)} · revision ${a.revision}`} aria-label={`${actorName(a.actor)}, ${a.payload.kind}, ${formatTime(a.changed_at)}`} onClick={() => a.runKey && selectEvent(a.runKey)} />)}</div></td></tr>;
        })}</tbody></table>{!leadKeys.length && <p className={styles.empty}>No matching submissions.</p>}</div><h3 className="mt-6 text-sm font-semibold">Coverage & occupancy by event</h3><p className={styles.note}>Coverage denominator is the recorded interval clipped to your range, or the adjusted planned interval for an explicitly inferred window. Unclosed recorded events extend to the range end or next lifecycle boundary. Means use covered time only.</p><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Event</th><th>Fresh coverage</th><th>Unknown time</th><th>Weighted mean</th><th>Peak / time to peak</th><th>Opening → closing</th><th>Largest drop / recovery</th></tr></thead><tbody>{analysis.summaries.map((s) => <tr key={s.run.key}><td><button className={styles.link} onClick={() => selectEvent(s.run.key)}>{s.run.session.title}</button><p className={styles.note}>{zoneName(s.run.session.track!)}{s.run.inferred ? " · inferred" : ""}</p></td><td>{percent(s.coverage)}<div className={styles.bar}><span style={{ width: `${s.coverage}%` }} /></div></td><td>{duration(s.duration * (1 - s.coverage / 100) / MINUTE)}</td><td>{percent(s.average)}</td><td>{percent(s.peak)} / {duration(s.timeToPeak)}</td><td>{s.opening === undefined ? "—" : `${s.opening}% → ${s.closing}%`}<p className={styles.note}>{s.change === undefined ? "" : `${s.change >= 0 ? "+" : ""}${s.change}pp`}</p></td><td>{s.largestDrop}pp / {s.largestDrop ? s.recovered ? "Recovered in window" : "Not observed" : "—"}</td></tr>)}</tbody></table></div></>}
        {panel === "updates" && <>{panelHeader(panel, "Every matching submitted measurement, including unchanged confirmations. Click an event for its evidence. Column headings sort the table.")}<div className={styles.actions}><label className={styles.field}><span>Search event, track, reporter or value</span><input className={styles.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search reports…" /></label><button className={styles.button} onClick={exportUpdates}>Export this table CSV</button><Field label="Rows per page"><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></Field></div><div className={`${styles.tableScroll} mt-4`}><table className={styles.table}><thead><tr>{([['time', 'Time · IST'], ['zone', 'Track'], ['event', 'Event'], ['actor', 'Reporter'], ['occupied', 'Occupied'], ['delta', 'Change'], ['revision', 'Revision']] as const).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label} {sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</button></th>)}</tr></thead><tbody>{tableRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((r) => <tr key={r.revision}><td>{formatTime(r.time, true)}</td><td><button className={styles.link} onClick={() => update("tracks", [r.zone])}>{zoneName(r.zone)}</button></td><td>{r.runKey ? <button className={styles.link} onClick={() => selectEvent(r.runKey!)}>{r.event}</button> : r.event}</td><td><button onClick={() => update("actors", [r.actor])}>{actorName(r.actor)}</button></td><td>{r.occupied}%{settings.headcounts && settings.capacities[r.zone] && <p className={styles.note}>≈{Math.round(r.occupied * settings.capacities[r.zone] / 100)} people</p>}</td><td>{r.delta === undefined ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta}pp`}</td><td>{r.revision}</td></tr>)}</tbody></table>{!tableRows.length && <p className={styles.empty}>No readings match the range, filters and search.</p>}</div><div className={`${styles.actions} mt-4`}><span className={styles.note}>{tableRows.length} reports · page {currentPage + 1} / {totalPages}</span><button className={styles.button} disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={styles.button} disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div></>}
      </section>)}</div>
    </>}
    <dialog ref={exportDialog} className={`${styles.dialog} ${styles.dashboard}`} onClose={() => setExportFile(null)} aria-labelledby="analysis-export-title">
      <div className={styles.panelHeader}><h2 id="analysis-export-title">Export ready</h2><button className={styles.button} onClick={() => setExportFile(null)}>Close export</button></div>
      {exportFile && <><p>{exportFile.name}</p><p className={styles.note}>{new Blob([exportFile.content]).size.toLocaleString()} bytes · generated from the current dataset and view.</p><div className={`${styles.actions} mt-4`}><a className={styles.primary} href={exportFile.url} download={exportFile.name}>Download file</a><button className={styles.button} onClick={async () => { try { await navigator.clipboard.writeText(exportFile.content); setMessage("Export content copied."); } catch { setMessage("Select and copy the export text below if downloads are unavailable."); } }}>Copy export content</button></div><p className={styles.note}>If your browser blocks downloads, copy the content below into a local file with this name.</p><label className={styles.field}><span>Export content</span><textarea readOnly value={exportFile.content} className={styles.exportText} /></label></>}
    </dialog>
    <dialog ref={dialog} className={`${styles.dialog} ${styles.dashboard}`} onClose={() => setSelected(null)} aria-labelledby="analysis-event-title"><div className={styles.panelHeader}><p className={styles.eyebrow}>Event evidence / selected time range</p><button className={styles.button} onClick={() => setSelected(null)}>Close</button></div>{selectedSummary && <EventDetail summary={selectedSummary} settings={settings} actorName={actorName} zoneName={zoneName} onZoom={() => { const run = selectedSummary.run; zoom(run.start ?? shifted(run, settings).start, run.boundaryEnd ?? analysis.end); setSelected(null); }} />}</dialog>
  </div>;
}

function EventDetail({ summary: s, settings, actorName, zoneName, onZoom }: { summary: RunSummary; settings: Settings; actorName: (id: string) => string; zoneName: (id: string) => string; onZoom: () => void }) {
  const plan = shifted(s.run, settings);
  const evidence = [...new Map([...s.segments.map((segment) => segment.reading), ...s.readings].map((r) => [r.revision, r])).values()].sort((a, b) => a.time - b.time);
  return <><h2 id="analysis-event-title">{s.run.session.title}</h2><p className={styles.note}>{zoneName(s.run.session.track!)} · {s.run.key} · {s.run.inferred ? "Inferred window" : "Manual lifecycle"}</p><div className={styles.detailGrid}>
    {[["Original agenda", `${formatTime(Date.parse(s.run.session.start))}–${formatTime(Date.parse(s.run.session.end))}`], ["Adjusted plan", `${formatTime(plan.start)}–${formatTime(plan.end)} (${minutes(plan.offset)})`], ["Recorded start", s.run.inferred ? "Not recorded" : formatTime(s.run.start, true)], ["Recorded end", formatTime(s.run.end, true)], ["Fresh coverage", percent(s.coverage)], ["Weighted mean", percent(s.average)], ["Observed peak", `${percent(s.peak)} / ${duration(s.timeToPeak)} from start`], ["Opening → closing", s.opening === undefined ? "—" : `${s.opening}% → ${s.closing}%`]].map(([label, value]) => <div key={label}><small>{label}</small>{value}</div>)}
  </div><RunSparkline summary={s} /><p className={styles.note}>Start drift {minutes(s.startDrift)} · end drift {minutes(s.endDrift)} against adjusted plan. Readings in this range and earlier readings supporting a fresh interval are listed.</p><button className={styles.button} onClick={onZoom}>Zoom dashboard to this event</button><div className={`${styles.tableScroll} mt-4`}><table className={styles.table}><thead><tr><th>Time · IST</th><th>Occupied</th><th>Reporter</th><th>Fresh interval in view</th><th>Revision</th></tr></thead><tbody>{evidence.map((r) => { const segment = s.segments.find((ss) => ss.reading.revision === r.revision); return <tr key={r.revision}><td>{formatTime(r.time, true)}</td><td>{r.occupied}%</td><td>{actorName(r.actor)}</td><td>{segment ? `${formatTime(segment.start)}–${formatTime(segment.end)}` : "Point only / no duration"}</td><td>{r.revision}</td></tr>; })}</tbody></table></div></>;
}
