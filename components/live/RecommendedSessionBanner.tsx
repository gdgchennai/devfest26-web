"use client";

import { useMemo } from "react";
import type { LiveHallData, CurrentSessionInfo } from "@/lib/hall-status";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";

type RecommendedItem = {
  hall: LiveHallData;
  session: CurrentSessionInfo;
  isHappeningNow: boolean;
};

export function RecommendedSessionBanner({ halls }: { halls: LiveHallData[] }) {
  // Collect all currently recommended sessions across halls
  const recommendedItems = useMemo<RecommendedItem[]>(() => {
    const items: RecommendedItem[] = [];

    for (const hall of halls) {
      // 1. Current session is recommended
      if (hall.currentSession?.isRecommended) {
        items.push({
          hall,
          session: hall.currentSession,
          isHappeningNow: true,
        });
      }
      // 2. Next session is recommended (and not already covered by current)
      else if (hall.nextSession?.isRecommended) {
        items.push({
          hall,
          session: hall.nextSession,
          isHappeningNow: false,
        });
      }
    }

    // Prioritize sessions happening right now, then by earliest start time
    return items.sort((a, b) => {
      if (a.isHappeningNow && !b.isHappeningNow) return -1;
      if (!a.isHappeningNow && b.isHappeningNow) return 1;
      return a.session.start.localeCompare(b.session.start);
    });
  }, [halls]);

  // If no session is recommended, banner completely disappears
  if (recommendedItems.length === 0) {
    return null;
  }

  // Feature the primary recommended session (or first in queue)
  const featured = recommendedItems[0];
  const palette = trackColor(featured.hall.track);

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

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl border border-yellow/35 bg-ink/90 p-5 sm:p-6 backdrop-blur-md shadow-2xl transition-all duration-300">
      {/* Ambient gold glow */}
      <div
        className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-yellow/15 blur-3xl"
        aria-hidden="true"
      />
      {palette && (
        <div
          className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full opacity-15 blur-3xl"
          style={{ backgroundColor: palette.cssVar }}
          aria-hidden="true"
        />
      )}

      {/* Header bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge: "Recommended" */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow/50 bg-yellow/15 px-3 py-1 text-xs font-bold text-yellow shadow-sm shadow-yellow/10">
            <span>⭐</span>
            <span>Recommended</span>
          </span>

          {/* Track Tag */}
          {palette && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.border} ${palette.text}`}
              style={{ backgroundColor: `color-mix(in srgb, ${palette.cssVar} 12%, transparent)` }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${palette.bg}`} />
              {featured.hall.trackName}
            </span>
          )}

          {recommendedItems.length > 1 && (
            <span className="text-xs text-paper/40">
              +{recommendedItems.length - 1} more recommended
            </span>
          )}
        </div>

        {/* Hall & Floor Badge */}
        <span className="text-xs text-paper/60">
          📍 {featured.hall.hallName} · {featured.hall.floorName}
        </span>
      </div>

      {/* Main recommendation details */}
      <div className="relative mt-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {/* Session Title */}
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-paper">
              {featured.session.title}
            </h3>

            {/* Speaker Name */}
            {featured.session.speakerNames && (
              <p className="mt-1 text-xs sm:text-sm text-paper/70">
                Speaker: <span className="font-semibold text-paper/90">{featured.session.speakerNames}</span>
              </p>
            )}
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Timing Pill */}
            {featured.isHappeningNow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-xs font-bold text-green">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                </span>
                Now Happening
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/10 px-3 py-1 text-xs font-bold text-yellow">
                <span className="h-2 w-2 rounded-full bg-yellow" />
                Up Next
              </span>
            )}

            {/* Occupancy Pill */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                featured.hall.occupancyStatus === "available"
                  ? "border-green/30 bg-green/10 text-green"
                  : featured.hall.occupancyStatus === "filling_fast"
                    ? "border-yellow/30 bg-yellow/10 text-yellow"
                    : "border-red/30 bg-red/10 text-red"
              }`}
            >
              {featured.hall.occupancyStatus === "available"
                ? "Seats Available"
                : featured.hall.occupancyStatus === "filling_fast"
                  ? "Filling Fast"
                  : "Houseful"}
            </span>
          </div>
        </div>

        {/* Footer / Action row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-paper/10 bg-paper/5 p-3.5">
          <div className="flex items-center gap-2 text-xs text-paper/80">
            <span className="font-semibold text-paper">Timing:</span>
            <span>
              {formatSessionTime(featured.session.start)} – {formatSessionTime(featured.session.end)}
            </span>
            {featured.hall.announcement && (
              <>
                <span className="text-paper/30">·</span>
                <span className="text-yellow font-medium">📢 {featured.hall.announcement}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleScrollToHall(featured.hall.track)}
            className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-full border border-yellow/40 bg-yellow/15 px-4 py-1.5 text-xs font-bold text-yellow transition-all hover:border-yellow/60 hover:bg-yellow/25 active:scale-95"
          >
            <span>View on Hall Board</span>
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
