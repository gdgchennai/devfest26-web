"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { AgendaSession } from "@/lib/schemas";
import type { Track } from "@/site.config";
import { formatSessionTime, sessionHour } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { useNow } from "@/lib/useNow";
import { getSpeaker } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { GlowButton } from "@/components/GlowButton";
import { uiCopy } from "@/site.config";

/**
 * The lite=0 agenda experience: a track selector above a "3D" stage where the
 * chosen track's timeline sits centred and in focus while the other three
 * recede into blurred, scaled-down columns behind it — see the plan this was
 * built from (joyful-leaping-kite.md) for the reference image and reasoning.
 *
 * Deliberately CSS/DOM, not WebGL: every card is real text, the timeline is a
 * real scrollable list (scroll-snap does the centring), and the depth is
 * faked with transform/blur/opacity on plain divs. lib/motion-prefs.ts's
 * shouldUseStaticBaseline() gate (in AgendaView) is what keeps this off
 * reduced-motion/lite=1 visitors — this component assumes it's always safe
 * to animate.
 */

type TimelineItem =
  | { kind: "divider"; hour: string; key: string }
  | { kind: "session"; session: AgendaSession; key: string };

function buildTimeline(sessions: AgendaSession[]): TimelineItem[] {
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const items: TimelineItem[] = [];
  let lastHour: string | null = null;
  for (const session of sorted) {
    const hour = sessionHour(session.start);
    if (hour !== lastHour) {
      items.push({ kind: "divider", hour, key: `divider-${hour}` });
      lastHour = hour;
    }
    items.push({ kind: "session", session, key: `${session.start}-${session.hall}` });
  }
  return items;
}

/** The track to spotlight when the URL doesn't name one: whatever's on now,
 *  else whatever's next, else just the first track. `now` is null until
 *  after mount (see useNow), so server and first paint always land on
 *  tracks[0] — consistent on both sides, no hydration mismatch. */
function defaultTrackSlug(sessions: AgendaSession[], tracks: Track[], now: Date | null): string {
  if (tracks.length === 0) return "";
  if (now) {
    const current = sessions.find((s) => now >= new Date(s.start) && now <= new Date(s.end));
    if (current) return current.track;
    const next = [...sessions]
      .filter((s) => new Date(s.start) > now)
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (next) return next.track;
  }
  return tracks[0].slug;
}

function columnStyle(offset: number): CSSProperties {
  const dist = Math.abs(offset);
  const sign = Math.sign(offset);

  if (dist === 0) {
    return {
      transform: "translateX(-50%) scale(1)",
      filter: "none",
      opacity: 1,
      zIndex: 3,
      pointerEvents: "auto",
    };
  }

  if (dist === 1) {
    return {
      transform: `translateX(calc(-50% + ${sign * 102}%)) scale(0.78)`,
      filter: "blur(5px)",
      opacity: 0.45,
      zIndex: 2,
      pointerEvents: "none",
    };
  }

  return {
    transform: `translateX(calc(-50% + ${sign * 168}%)) scale(0.64)`,
    filter: "blur(8px)",
    opacity: 0,
    zIndex: 1,
    pointerEvents: "none",
  };
}

export function AgendaBoard({
  sessions,
  tracks,
  activeTrack,
}: {
  sessions: AgendaSession[];
  tracks: Track[];
  activeTrack: string;
}) {
  const now = useNow();
  const resolvedTrack = tracks.some((t) => t.slug === activeTrack)
    ? activeTrack
    : defaultTrackSlug(sessions, tracks, now);
  const activeIndex = Math.max(0, tracks.findIndex((t) => t.slug === resolvedTrack));
  const [focusedSession, setFocusedSession] = useState<AgendaSession | null>(null);
  const columnRefs = useRef<Array<TrackColumnHandle | null>>([]);

  const byTrack = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const t of tracks) {
      map.set(t.slug, buildTimeline(sessions.filter((s) => s.track === t.slug)));
    }
    return map;
  }, [sessions, tracks]);

  const activeItems = byTrack.get(resolvedTrack) ?? [];
  const hours = activeItems.filter((it): it is Extract<TimelineItem, { kind: "divider" }> => it.kind === "divider");
  const activeSessions = activeItems.filter(
    (it): it is Extract<TimelineItem, { kind: "session" }> => it.kind === "session",
  );
  const focusedHour = focusedSession ? sessionHour(focusedSession.start) : null;
  const focusedHourIndex = Math.max(
    0,
    hours.findIndex((h) => h.hour === focusedHour),
  );
  const focusedSessionPos = focusedSession
    ? activeSessions.findIndex((it) => it.key === `${focusedSession.start}-${focusedSession.hall}`)
    : -1;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap justify-center gap-3">
        {tracks.map((t) => {
          const active = t.slug === resolvedTrack;
          return (
            <GlowButton
              key={t.slug}
              href={`/agenda?track=${t.slug}`}
              scroll={false}
              shape="pill"
              size="md"
              textClassName={active ? "text-paper font-semibold" : "text-paper/60 font-medium"}
              className={active ? "agenda-board-pill--active" : ""}
            >
              {t.name}
            </GlowButton>
          );
        })}
      </div>

      <div className="mt-10 flex items-stretch justify-center gap-2 sm:gap-6">
        <div className="agenda-board-ruler hidden sm:block" aria-hidden>
          <div
            className="agenda-board-ruler__track"
            style={{ transform: `translateY(calc(-1 * (${focusedHourIndex} + 0.5) * var(--ruler-row-h)))` }}
          >
            {hours.map((h) => (
              <span
                key={h.key}
                className={`agenda-board-ruler__mark ${h.hour === focusedHour ? "agenda-board-ruler__mark--active" : ""}`}
              >
                {h.hour}:00
              </span>
            ))}
          </div>
        </div>

        <div className="agenda-board-stage">
          {tracks.map((t, i) => (
            <TrackColumn
              key={t.slug}
              ref={(instance) => {
                columnRefs.current[i] = instance;
              }}
              items={byTrack.get(t.slug) ?? []}
              offset={i - activeIndex}
              active={i === activeIndex}
              now={now}
              syncTime={focusedSession?.start ?? null}
              onFocusChange={setFocusedSession}
            />
          ))}
        </div>

        <div className="agenda-board-nav">
          <GlowButton
            shape="circle"
            size="sm"
            onClick={() => columnRefs.current[activeIndex]?.goTo(-1)}
            disabled={focusedSessionPos <= 0}
          >
            <span className="sr-only">{uiCopy.agendaBoard.previousSessionSr}</span>
            <ChevronIcon direction="up" />
          </GlowButton>
          <GlowButton
            shape="circle"
            size="sm"
            onClick={() => columnRefs.current[activeIndex]?.goTo(1)}
            disabled={focusedSessionPos === -1 || focusedSessionPos >= activeSessions.length - 1}
          >
            <span className="sr-only">{uiCopy.agendaBoard.nextSessionSr}</span>
            <ChevronIcon direction="down" />
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

type TrackColumnHandle = { goTo: (delta: number) => void };

/** The session in `items` whose start is closest to `targetIso` — used to
 *  keep the blurred background columns pointed at roughly "the same time" as
 *  whatever's focused in the active column, rather than frozen wherever they
 *  first loaded. */
function closestSessionByTime(
  items: TimelineItem[],
  targetIso: string,
): Extract<TimelineItem, { kind: "session" }> | undefined {
  const target = new Date(targetIso).getTime();
  let best: Extract<TimelineItem, { kind: "session" }> | undefined;
  let bestDiff = Infinity;
  for (const it of items) {
    if (it.kind !== "session") continue;
    const diff = Math.abs(new Date(it.session.start).getTime() - target);
    if (diff < bestDiff) {
      best = it;
      bestDiff = diff;
    }
  }
  return best;
}

const TrackColumn = forwardRef<
  TrackColumnHandle,
  {
    items: TimelineItem[];
    offset: number;
    active: boolean;
    now: Date | null;
    syncTime: string | null;
    onFocusChange: (session: AgendaSession | null) => void;
  }
>(function TrackColumn({ items, offset, active, now, syncTime, onFocusChange }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  // Read inside the activation effect below without adding syncTime to its
  // dependency array — that effect should only re-pick a target when this
  // column BECOMES active, not every time the focused time ticks along
  // (that continuous following is the separate background-column effect
  // further down). A ref gives the latest value without retriggering.
  const syncTimeRef = useRef(syncTime);
  useEffect(() => {
    syncTimeRef.current = syncTime;
  }, [syncTime]);

  // Only the active column scrolls/observes/gets centred — the others are
  // decorative depth cushioning (plan's "Background columns" section).
  useEffect(() => {
    if (!active) return;
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFocusedKey((entry.target as HTMLElement).dataset.key ?? null);
          }
        }
      },
      { root: container, rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );

    // Only session cards are observed — a divider passing the centre band
    // shouldn't steal focus, since "previous/up next"/the ruler highlight
    // only make sense pointed at a real session.
    const cards = container.querySelectorAll<HTMLElement>(".agenda-board-card[data-key]");
    cards.forEach((el) => observer.observe(el));

    // Landing target when this column becomes active: prefer wherever the
    // visitor was already looking (syncTime — set once any column has ever
    // focused a session), so switching tracks lands on "the same time" in
    // the new track rather than resetting to its own start. Only the very
    // first activation of the whole board, before syncTime exists yet, falls
    // back to "on now, else the first session".
    const bySyncTime = syncTimeRef.current ? closestSessionByTime(items, syncTimeRef.current) : undefined;
    const nowItem = items.find(
      (it): it is Extract<TimelineItem, { kind: "session" }> =>
        it.kind === "session" && now !== null && now >= new Date(it.session.start) && now <= new Date(it.session.end),
    );
    const firstSession = items.find(
      (it): it is Extract<TimelineItem, { kind: "session" }> => it.kind === "session",
    );
    const target = bySyncTime ?? nowItem ?? firstSession;
    if (target) {
      requestAnimationFrame(() => {
        container.querySelector(`[data-key="${target.key}"]`)?.scrollIntoView({ block: "center" });
      });
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items]);

  // The blurred background columns aren't scrolled by the visitor, but they
  // shouldn't just sit frozen on whichever session they first loaded either —
  // as the active column's focus moves (scroll, or the up/down nav buttons),
  // each background column scrolls its own timeline to whichever of its own
  // sessions sits closest to that same time, so the whole stage reads as one
  // synchronised wall of tracks rather than three independent lists.
  useEffect(() => {
    if (active || !syncTime) return;
    const container = scrollRef.current;
    if (!container) return;
    const target = closestSessionByTime(items, syncTime);
    if (!target) return;
    container.querySelector(`[data-key="${target.key}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active, syncTime, items]);

  const focusedIndex = items.findIndex((it) => it.key === focusedKey);

  useEffect(() => {
    if (!active) return;
    const focused = items[focusedIndex];
    onFocusChange(focused && focused.kind === "session" ? focused.session : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focusedIndex, items]);

  const sessionItems = items.filter(
    (it): it is Extract<TimelineItem, { kind: "session" }> => it.kind === "session",
  );
  const focusedSessionPos = sessionItems.findIndex((it) => it.key === focusedKey);

  const goTo = useCallback(
    (delta: number) => {
      const container = scrollRef.current;
      if (!container) return;
      const targetPos = Math.min(Math.max(focusedSessionPos + delta, 0), sessionItems.length - 1);
      const target = sessionItems[targetPos];
      if (!target) return;
      container
        .querySelector(`[data-key="${target.key}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    [focusedSessionPos, sessionItems],
  );

  useImperativeHandle(ref, () => ({ goTo }), [goTo]);

  return (
    <div
      className="agenda-board-column"
      style={columnStyle(offset)}
      aria-hidden={!active}
    >
      <div ref={scrollRef} className="agenda-board-scroll" data-lenis-prevent>
        <div className="agenda-board-spacer" aria-hidden />
        {items.map((item, idx) => {
          if (item.kind === "divider") {
            return (
              <div key={item.key} className="agenda-board-hour">
                {item.hour}:00
              </div>
            );
          }

          const distance = active && focusedIndex !== -1 ? idx - focusedIndex : 0;
          const isNow =
            now !== null && now >= new Date(item.session.start) && now <= new Date(item.session.end);

          return (
            <SessionCard
              key={item.key}
              dataKey={item.key}
              session={item.session}
              distance={active ? distance : 0}
              isNow={isNow}
            />
          );
        })}
        <div className="agenda-board-spacer" aria-hidden />
      </div>
    </div>
  );
});

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d={direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SessionCard({
  session,
  dataKey,
  distance,
  isNow,
}: {
  session: AgendaSession;
  dataKey: string;
  distance: number;
  isNow: boolean;
}) {
  const abs = Math.abs(distance);

  if (abs >= 2) {
    return (
      <div className="agenda-board-card agenda-board-card--far" data-key={dataKey}>
        {/* text-sm, not smaller — see the comment on .agenda-board-hour in
            globals.css for why tabular-nums numerals need to stay above ~13px. */}
        <span className="font-mono text-sm tabular-nums text-paper/40">{formatSessionTime(session.start)}</span>
        <p className="mt-1 truncate text-sm text-paper/50">{session.title}</p>
      </div>
    );
  }

  if (abs === 1) {
    const eyebrow = distance < 0 ? uiCopy.agendaBoard.previousEyebrow : uiCopy.agendaBoard.upNextEyebrow;
    return (
      <div className="agenda-board-card agenda-board-card--adjacent" data-key={dataKey}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-paper/50">{eyebrow}</span>
          <span className="font-mono text-sm tabular-nums text-paper/50">{formatSessionTime(session.start)}</span>
        </div>
        <p className="mt-1 truncate text-sm text-paper/80">{session.title}</p>
      </div>
    );
  }

  const color = trackColor(session.track);
  const speaker = session.speakerSlug ? getSpeaker(session.speakerSlug) : undefined;

  return (
    <div className="agenda-board-card agenda-board-card--focused" data-key={dataKey}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-wide text-ink ${color.bg}`}>
            {session.type}
          </span>
          {isNow && (
            <span className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wide text-paper/70">
              <span className="agenda-board-live-dot" aria-hidden />
              {uiCopy.agendaBoard.liveNowLabel}
            </span>
          )}
        </div>
        <span className="font-mono text-sm tabular-nums text-paper/70">
          {/* A plain hyphen, not an en dash: en dash + tabular-nums renders with a
              spurious horizontal line through the whole string specifically when
              inside this stage's transformed/scrolling/blurred ancestor chain —
              reproduced by isolating the exact same span outside that tree, where
              the en dash rendered fine. Root cause is a Chromium text-rendering
              interaction, not something fixable from this component; sidestepping
              the glyph is the reliable fix, and it matches the reference image's
              own "14:00 - 15:00" styling anyway. */}
          {formatSessionTime(session.start)} - {formatSessionTime(session.end)}
        </span>
      </div>

      <p className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{session.title}</p>

      {session.description && <p className="mt-3 max-w-md text-sm text-paper/70">{session.description}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        {speaker ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
              <Frame
                src={speaker.photo}
                alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
                title={speaker.name}
                aspectRatio="1 / 1"
                sizes="36px"
              />
            </div>
            <span className="truncate text-sm text-paper/80">{speaker.name}</span>
          </div>
        ) : (
          <span />
        )}
        <span className="font-mono text-xs uppercase tracking-wide text-paper/50">{session.hall}</span>
      </div>
    </div>
  );
}
