"use client";
import { useEffect, useRef, useState } from "react";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { trackCards, occupancyColor, STALE_MS } from "@/lib/hall-model";
import { useHallLive } from "./useHallLive";
import { HallSchedule } from "./HallDialogs";
import { SessionDescriptionModal } from "@/components/SessionDescriptionModal";
import { formatSessionTime } from "@/lib/format";
import { LocalHallTools } from "./LocalHallTools";
import { siteConfig, formatEventDate } from "@/site.config";
import { rankSessionRecommendations } from "@/lib/hall-recommendation";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useMotion } from "@/components/motion/MotionProvider";
import styles from "./HallLive.module.css";

export function HallLive({
  agenda,
  speakers,
}: {
  agenda: AgendaSession[];
  speakers: Speaker[];
}) {
  const { snapshot, connected, now } = useHallLive({ publicView: true });
  const { lenisRef, staticBaseline } = useMotion();
  const cardsRef = useRef<HTMLDivElement>(null);
  const [recommendation, setRecommendation] = useState<{ id: string; attempt: number } | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const ranked = snapshot
    ? rankSessionRecommendations(agenda, snapshot, now || snapshot.serverNow, connected)
    : [];
  const selected = ranked.find((entry) => entry.session.id === recommendation?.id);
  const selectedId = selected?.session.id;
  useEffect(() => {
    if (!selectedId) return;
    const card = Array.from(cardsRef.current?.querySelectorAll<HTMLElement>("[data-track]") ?? [])
      .find((element) => element.querySelector("[data-recommended-title]"));
    const title = card?.querySelector<HTMLButtonElement>("[data-recommended-title]");
    if (!card || !title) return;
    title.focus({ preventScroll: true });
    const instant = shouldUseStaticBaseline();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(title, { offset: -Math.min(window.innerHeight / 3, 220), immediate: instant });
    } else {
      title.scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "center" });
    }
  }, [selectedId, recommendation?.attempt, lenisRef]);
  const [hall, setHall] = useState<string | null>(null),
    [session, setSession] = useState<AgendaSession | null>(null);
  const [restoreId, setRestoreId] = useState<string>();
  const [busy, setBusy] = useState(false),
    [order, setOrder] = useState<string[]>([]);
  const cards = snapshot ? trackCards(agenda, snapshot) : [];
  const desired = cards.map((c) => c.zone.id).join(",");
  useEffect(() => {
    // Synchronize physical ordering only after pointer/focus leaves the card region.
    let cancelled = false;
    if (!busy)
      queueMicrotask(() => {
        if (!cancelled) setOrder(desired.split(",").filter(Boolean));
      });
    return () => {
      cancelled = true;
    };
  }, [busy, desired]);
  const displayed = order.length
    ? order.map((id) => cards.find((c) => c.zone.id === id)).filter((c) => !!c)
    : cards;
  const sessionButton = (s: AgendaSession | undefined, label: string, live = false) => (
    <div className="min-w-0">
      {live ? (
        <p className="mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red/40 bg-red-pastel px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-red" />
            {label}
          </span>
        </p>
      ) : (
        <p className="mb-2 text-xs uppercase tracking-wide text-paper/60">
          {label}
        </p>
      )}
      {s ? (
        <>
          <button
            onClick={() => {
              setHall(null);
              setSession(s);
            }}
            key={selectedId === s.id ? recommendation?.attempt : undefined}
            data-recommended-title={selectedId === s.id ? "true" : undefined}
            className={`min-h-11 text-left font-semibold leading-snug hover:text-blue ${selectedId === s.id ? `${styles.title} ${!staticBaseline ? styles.pulse : ""}` : ""}`}
          >
            {s.title} ↗
          </button>
          <p className="mt-2 text-sm text-paper/70">
            {s.speakerSlugs
              .map((id) => speakers.find((p) => p.slug === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-1 text-xs text-paper/60">
            Planned: {formatSessionTime(s.start)}–{formatSessionTime(s.end)}
          </p>
        </>
      ) : (
        <p className="text-sm text-paper/60">No more sessions</p>
      )}
    </div>
  );
  return (
    <div data-hall-live-content className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-paper/60">
            {formatEventDate(siteConfig.date)} · Chennai
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Live at DevFest
          </h1>
          <p className="mt-3 text-paper/70">
            Find your next session.
          </p>
        </div>
        <p role="status" className={connected ? "text-green" : "text-yellow"}>
          {connected ? "● Connected" : "○ Offline / reconnecting"}
        </p>
      </div>
      <LocalHallTools snapshot={snapshot} />

      <nav
        aria-label="Browse physical hall schedules"
        className="mb-6 flex flex-wrap gap-2"
      >
        {Array.from(new Set(agenda.map((s) => s.hall))).map((name) => (
          <button
            key={name}
            onClick={() => {
              setRestoreId(undefined);
              setHall(name);
            }}
            className="min-h-11 rounded-full border border-paper/20 px-4 text-sm hover:border-blue"
          >
            {name} · All sessions
          </button>
        ))}
      </nav>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!snapshot}
          onClick={() => {
            const winner = ranked[0];
            if (!winner) {
              setRecommendation(null);
              setRecommendationMessage("No sessions available in the next 15 minutes or started in the last 5 minutes. Explore the hall schedules above.");
              return;
            }
            setRecommendation((previous) => ({ id: winner.session.id, attempt: (previous?.attempt ?? 0) + 1 }));
            setRecommendationMessage(`Try ${winner.session.title}. ${winner.seatsKnown ? `${Math.round(winner.availability * 100)}% of seats currently available.` : "Seat availability is uncertain; check at the hall."} Select the highlighted title for details.`);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue/40 bg-blue/10 px-4 text-sm font-semibold text-blue-pastel hover:border-blue hover:bg-blue/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue disabled:opacity-50"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
          </svg>
          Recommend next session
        </button>
        <p className="text-xs text-paper/60">A little help finding where to go next.</p>
        <p role="status" className={selected || !recommendationMessage ? "sr-only" : "w-full text-sm text-paper/70"}>
          {recommendation && !selected
            ? "That recommendation is no longer available. Tap again for a new suggestion."
            : recommendationMessage}
        </p>
      </div>
      {!snapshot && (
        <p role="status" className="rounded-xl border border-paper/20 p-6">
          Connecting to live track updates…
        </p>
      )}
      <div
        className="mb-2 hidden grid-cols-[1fr_2fr_1.2fr_1fr] gap-6 px-5 text-xs uppercase tracking-wide text-paper/50 lg:grid"
        aria-hidden="true"
      >
        <span>Hall / track</span>
        <span>Happening now</span>
        <span>Occupancy</span>
        <span>Up next</span>
      </div>
      <div
        ref={cardsRef}
        className="space-y-3"
        onPointerEnter={() => setBusy(true)}
        onPointerLeave={() => {
          if (!document.activeElement?.closest("[data-hall-cards]"))
            setBusy(false);
        }}
        onFocusCapture={() => setBusy(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setBusy(false);
        }}
        data-hall-cards
      >
        {displayed.map((c) => {
          const s = c.primary,
            o = c.occupancy,
            age = o ? Math.max(0, now - o.updated_at) : 0,
            stale = age > STALE_MS;
          return (
            <article
              key={c.zone.id}
              data-track={c.zone.id}
              className={`scroll-mt-28 rounded-xl border bg-surface p-4 lg:grid lg:grid-cols-[1fr_2fr_1.2fr_1fr] lg:items-center lg:gap-6 lg:p-5 ${selected?.session.track === c.zone.id ? styles.recommended : c.promotion?.recommended ? "border-blue/70" : "border-paper/15"}`}
            >
              <div className="mb-4 border-b border-paper/10 pb-3 lg:mb-0 lg:border-0 lg:pb-0">
                <button
                  onClick={() => {
                    setRestoreId(undefined);
                    setHall(
                      s?.hall ??
                        agenda.find(
                          (a) => a.track === c.zone.id && a.type !== "break",
                        )?.hall ??
                        "",
                    );
                  }}
                  className="min-h-11 w-full text-left"
                >
                  <span className="block font-semibold">
                    {s?.hall ??
                      agenda.find(
                        (a) => a.track === c.zone.id && a.type !== "break",
                      )?.hall}
                  </span>
                  <span className="text-sm text-paper/60">{c.zone.name}</span>
                  <span className="ml-2 text-xs text-blue">All sessions ›</span>
                </button>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {c.promotion?.recommended && (
                    <span className="rounded-full bg-blue/15 px-2 py-1 text-blue">
                      ★ Recommended
                    </span>
                  )}
                  {c.promotion?.position != null && (
                    <span className="rounded-full bg-paper/10 px-2 py-1">
                      Pinned
                    </span>
                  )}
                </div>
              </div>
              <div className="hall-current">
                {sessionButton(
                  s,
                  s
                    ? c.phase === "current"
                      ? "LIVE"
                      : c.phase === "gap"
                        ? "Coming up · between sessions"
                        : "Not started · coming up"
                    : "Track finished",
                  !!s && c.phase === "current",
                )}
              </div>
              <div className="hall-occupancy mt-5 lg:mt-0">
                {o ? (
                  <>
                    <div className="mb-2 flex justify-between gap-2 text-xs">
                      <span className="font-semibold">
                        {o.occupied}% occupied
                        {o.occupied === 100 ? " · Full" : ""}
                      </span>
                      <span>{100 - o.occupied}% remaining</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${c.zone.name} occupied`}
                      aria-valuenow={o.occupied}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2.5 overflow-hidden rounded-full bg-paper/15"
                    >
                      <div
                        style={{ width: `${o.occupied}%` }}
                        className={`h-full rounded-full ${occupancyColor(o.occupied)}`}
                      />
                    </div>
                    <p
                      className={`mt-2 text-xs ${stale || !connected ? "text-yellow" : "text-paper/50"}`}
                    >
                      {stale
                        ? "Stale · "
                        : !connected
                          ? "Offline · last reported "
                          : ""}
                      {Math.floor(age / 60000)} min ago
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-paper/60">Occupancy unknown</p>
                )}
              </div>
              <div className="hall-next mt-4 border-t border-paper/10 pt-3 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                {sessionButton(c.next, "Up next")}
              </div>
              {selected?.session.track === c.zone.id && (
                <div className="col-span-2 mt-4 border-t border-blue/30 pt-3 lg:col-span-4">
                  <p className="mb-2 text-xs font-semibold text-blue-pastel">✦ Your next session</p>
                  {selectedId !== s?.id && selectedId !== c.next?.id && sessionButton(selected.session, "Coming up")}
                  <p className="text-sm text-paper/70">
                    {selected.seatsKnown ? `${Math.round(selected.availability * 100)}% of seats currently available` : "Seat availability uncertain · check at the hall"}
                    {" · "}Select the highlighted title for details.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {hall && !session && (
        <HallSchedule
          hall={hall}
          agenda={agenda}
          snapshot={snapshot}
          onClose={() => setHall(null)}
          onSession={(s) => {
            setRestoreId(s.id);
            setSession(s);
          }}
          restoreId={restoreId}
        />
      )}
      <SessionDescriptionModal
        session={session}
        speakers={speakers}
        onClose={() => setSession(null)}
        backLabel={hall ? "Back to hall schedule" : undefined}
      />
    </div>
  );
}
