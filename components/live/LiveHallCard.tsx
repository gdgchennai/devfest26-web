import type { LiveHallData } from "@/lib/hall-status";
import { trackColor } from "@/lib/track-color";
import { formatSessionTime } from "@/lib/format";

function StatusBadge({ status }: { status: LiveHallData["occupancyStatus"] }) {
  if (status === "houseful") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red/40 bg-red/10 px-2.5 py-0.5 text-xs font-semibold text-red">
        <span className="h-2 w-2 rounded-full bg-red animate-pulse" />
        Houseful
      </span>
    );
  }
  if (status === "filling_fast") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/10 px-2.5 py-0.5 text-xs font-semibold text-yellow">
        <span className="h-2 w-2 rounded-full bg-yellow animate-pulse" />
        Filling fast
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green">
      <span className="h-2 w-2 rounded-full bg-green" />
      Available
    </span>
  );
}

function StatusDescription({ status }: { status: LiveHallData["occupancyStatus"] }) {
  if (status === "houseful") {
    return "Hall at maximum capacity — entry may be restricted";
  }
  if (status === "filling_fast") {
    return "Seats filling quickly — head over soon";
  }
  return "Plenty of open seats available";
}

export function LiveHallCard({
  hall,
  featured = false,
}: {
  hall: LiveHallData;
  featured?: boolean;
}) {
  const palette = trackColor(hall.track);
  const { currentSession } = hall;

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-paper/15 bg-ink/80 p-5 sm:p-6 backdrop-blur-md transition-all duration-300 hover:border-paper/30 ${
        featured ? "md:col-span-2" : ""
      }`}
    >
      {/* Background ambient glow accent matching track brand color */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: palette.cssVar }}
        aria-hidden="true"
      />

      {/* Header Info */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.border} ${palette.text}`}
              style={{ backgroundColor: `color-mix(in srgb, ${palette.cssVar} 12%, transparent)` }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${palette.bg}`} />
              {hall.trackName}
            </span>
            <span className="text-xs text-paper/50">{hall.floorName}</span>
          </div>
          <StatusBadge status={hall.occupancyStatus} />
        </div>

        <div className="mt-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-paper">{hall.hallName}</h2>
        </div>

        {/* Visual Occupancy Status Indicator */}
        <div className="mt-4 rounded-2xl border border-paper/10 bg-paper/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-paper/80">Occupancy</span>
            <span className="text-xs text-paper/50">
              <StatusDescription status={hall.occupancyStatus} />
            </span>
          </div>

          {/* 3-segment visual capacity meter */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5" aria-hidden="true">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hall.occupancyStatus === "available"
                  ? "bg-green"
                  : hall.occupancyStatus === "filling_fast"
                    ? "bg-yellow"
                    : "bg-red"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hall.occupancyStatus === "filling_fast"
                  ? "bg-yellow"
                  : hall.occupancyStatus === "houseful"
                    ? "bg-red"
                    : "bg-paper/10"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hall.occupancyStatus === "houseful" ? "bg-red" : "bg-paper/10"
              }`}
            />
          </div>
        </div>

        {/* Now Happening Section */}
        <div className="mt-4 rounded-2xl border border-paper/10 bg-ink/60 p-3.5">
          <div className="flex items-center gap-2">
            {currentSession?.isHappeningNow ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-green">
                <span className="h-2 w-2 rounded-full bg-green animate-ping" />
                Now Happening
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wider text-paper/50">
                {currentSession ? "Up Next" : "Session Schedule"}
              </span>
            )}
            {currentSession && (
              <span className="text-[11px] text-paper/40">
                {formatSessionTime(currentSession.start)} – {formatSessionTime(currentSession.end)}
              </span>
            )}
          </div>

          {currentSession ? (
            <div className="mt-1.5">
              <p className="line-clamp-2 text-sm font-semibold text-paper">{currentSession.title}</p>
              {currentSession.speakerNames && (
                <p className="mt-0.5 truncate text-xs text-paper/60">{currentSession.speakerNames}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-paper/50 italic">No scheduled session at this moment.</p>
          )}
        </div>
      </div>

      {/* Announcement Section */}
      <div className="mt-4 pt-2">
        {hall.announcement ? (
          <div className="relative overflow-hidden rounded-2xl border border-yellow/30 bg-yellow/10 p-3 text-xs text-paper">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none" role="img" aria-label="announcement">
                📢
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-yellow text-[11px] uppercase tracking-wide">
                  Live Announcement
                </p>
                <p className="mt-0.5 wrap-break-word font-medium text-paper/90">{hall.announcement}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-paper/10 p-2.5 text-center text-[11px] text-paper/40">
            No active hall announcements
          </div>
        )}
      </div>
    </div>
  );
}
