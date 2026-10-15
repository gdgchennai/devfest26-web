"use client";

import { useMemo, useState } from "react";
import type { LiveHallData, CurrentSessionInfo } from "@/lib/hall-status";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";

export type ScoredSession = {
  id: string;
  hall: LiveHallData;
  session: CurrentSessionInfo;
  isHappeningNow: boolean;
  score: number;
  reason: string;
};

/**
 * Intelligent recommendation engine that matches attendees with active or upcoming
 * sessions in halls that have plenty of seating, avoiding houseful rooms.
 */
export function getRankedSessions(halls: LiveHallData[]): ScoredSession[] {
  const nowMs = Date.now();
  const candidates: ScoredSession[] = [];

  for (const hall of halls) {
    // Never recommend a hall that has hit max capacity
    if (hall.occupancyStatus === "houseful") continue;

    // 1. Current Session (happening right now)
    if (hall.currentSession?.isHappeningNow) {
      let score = 100;
      if (hall.occupancyStatus === "available") score += 50;
      if (hall.occupancyStatus === "filling_fast") score += 20;

      // Seat availability bonus: lower percentage occupancy = higher score
      score += Math.max(0, 100 - hall.percentage) * 0.25;

      candidates.push({
        id: `${hall.track}-current-${hall.currentSession.id}`,
        hall,
        session: hall.currentSession,
        isHappeningNow: true,
        score,
        reason:
          hall.occupancyStatus === "available"
            ? "Happening live right now with plenty of open seats!"
            : "Running live right now — seats filling, head over soon!",
      });
    }

    // 2. Upcoming / Next Session (if hall isn't houseful)
    if (hall.nextSession) {
      const startMs = Date.parse(hall.nextSession.start);
      const minsUntilStart = Math.round((startMs - nowMs) / 60000);

      let score = 75;
      if (hall.occupancyStatus === "available") score += 35;
      if (hall.occupancyStatus === "filling_fast") score += 10;

      // Higher score if starting soon (within 25 mins or just starting)
      if (minsUntilStart >= -5 && minsUntilStart <= 25) {
        score += 25;
      }

      // Bonus for open capacity
      score += Math.max(0, 100 - hall.percentage) * 0.2;

      const reason =
        minsUntilStart > 0 && minsUntilStart <= 30
          ? `Starting in ~${minsUntilStart} minutes with available seating.`
          : "Up next in this hall with open seats.";

      candidates.push({
        id: `${hall.track}-next-${hall.nextSession.id}`,
        hall,
        session: hall.nextSession,
        isHappeningNow: false,
        score,
        reason,
      });
    }
  }

  // Sort descending by calculated score
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function SessionFinderBanner({ halls }: { halls: LiveHallData[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Compute recommendations dynamically from latest hall states
  const candidates = useMemo(() => getRankedSessions(halls), [halls]);

  const activeCandidate =
    candidates.length > 0 ? candidates[currentIndex % candidates.length] : null;

  function handleShuffle() {
    if (candidates.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
  }

  function handleScrollToHall(trackSlug: string) {
    const el = document.getElementById(`hall-${trackSlug}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-paper");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-paper");
      }, 2000);
    }
  }

  if (!isOpen) {
    return (
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-paper/15 bg-ink/80 p-4 sm:p-5 backdrop-blur-md transition-all duration-300 hover:border-paper/30">
        {/* Ambient gradient glow */}
        <div
          className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue/15 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-green/15 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-paper/10 bg-paper/5 text-xl">
              🧭
            </div>
            <div>
              <h2 className="text-sm font-bold text-paper sm:text-base">
                Looking for an open seat?
              </h2>
              <p className="text-xs text-paper/60">
                Instantly find talks running now or starting soon with the best seat availability.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentIndex(0);
              setIsOpen(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-paper/20 bg-paper px-4 py-2 text-xs font-bold text-ink transition-all hover:bg-paper/90 active:scale-95"
          >
            <span>Find me a session</span>
            <span aria-hidden="true">✨</span>
          </button>
        </div>
      </div>
    );
  }

  const palette = activeCandidate ? trackColor(activeCandidate.hall.track) : null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-paper/25 bg-ink/90 p-5 sm:p-6 backdrop-blur-md shadow-2xl transition-all duration-300">
      {/* Background glow tinted with recommended track color */}
      {palette && (
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-15 blur-3xl"
          style={{ backgroundColor: palette.cssVar }}
          aria-hidden="true"
        />
      )}

      {/* Header bar: Badge, counter, and actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/40 bg-blue/10 px-2.5 py-0.5 text-xs font-bold text-blue">
            <span>✨</span>
            Best Match Right Now
          </span>

          {palette && activeCandidate && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.border} ${palette.text}`}
              style={{ backgroundColor: `color-mix(in srgb, ${palette.cssVar} 12%, transparent)` }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${palette.bg}`} />
              {activeCandidate.hall.trackName}
            </span>
          )}

          {candidates.length > 1 && (
            <span className="text-xs text-paper/40">
              Option {((currentIndex % candidates.length) + 1)} of {candidates.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {candidates.length > 1 && (
            <button
              type="button"
              onClick={handleShuffle}
              className="inline-flex items-center gap-1 rounded-full border border-paper/20 bg-paper/5 px-3 py-1 text-xs font-semibold text-paper/80 transition-all hover:border-paper/40 hover:bg-paper/10 hover:text-paper active:scale-95"
            >
              <span>🔀</span>
              <span>Try another</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close suggestion"
            className="rounded-full border border-paper/15 p-1 text-paper/50 transition-colors hover:border-paper/30 hover:text-paper"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main recommendation details */}
      {activeCandidate ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {/* Hall Name & Floor */}
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-paper">
                  {activeCandidate.hall.hallName}
                </h3>
                <span className="text-xs text-paper/50">
                  📍 {activeCandidate.hall.floorName}
                </span>
              </div>

              {/* Session Title */}
              <p className="mt-2 text-base sm:text-lg font-bold text-paper">
                {activeCandidate.session.title}
              </p>

              {/* Speaker */}
              {activeCandidate.session.speakerNames && (
                <p className="mt-1 text-xs text-paper/70">
                  Speaker: <span className="text-paper/90 font-medium">{activeCandidate.session.speakerNames}</span>
                </p>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Timing Badge */}
              {activeCandidate.isHappeningNow ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-xs font-bold text-green">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                  </span>
                  Happening Now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/10 px-3 py-1 text-xs font-bold text-yellow">
                  <span className="h-2 w-2 rounded-full bg-yellow" />
                  Up Next
                </span>
              )}

              {/* Occupancy Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  activeCandidate.hall.occupancyStatus === "available"
                    ? "border-green/30 bg-green/10 text-green"
                    : "border-yellow/30 bg-yellow/10 text-yellow"
                }`}
              >
                {activeCandidate.hall.occupancyStatus === "available"
                  ? "Seats Available"
                  : "Filling Fast"}
              </span>
            </div>
          </div>

          {/* Time & Context note */}
          <div className="rounded-2xl border border-paper/10 bg-paper/5 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-paper/80">
              <span className="font-semibold text-paper">Time:</span>
              <span>
                {formatSessionTime(activeCandidate.session.start)} – {formatSessionTime(activeCandidate.session.end)}
              </span>
              <span className="text-paper/30">·</span>
              <span className="text-paper/60 italic">{activeCandidate.reason}</span>
            </div>

            <button
              type="button"
              onClick={() => handleScrollToHall(activeCandidate.hall.track)}
              className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full border border-paper/20 px-3 py-1 text-xs font-medium text-paper hover:border-paper/50 hover:bg-paper/10 transition-colors"
            >
              <span>View Hall Board</span>
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-paper/15 p-6 text-center text-paper/60">
          <p className="text-sm font-medium">All active halls are currently full or between tracks.</p>
          <p className="mt-1 text-xs text-paper/40">Check back in a few minutes as sessions wrap up and new rooms open up!</p>
        </div>
      )}
    </div>
  );
}
