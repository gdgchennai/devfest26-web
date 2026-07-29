"use client";

import Link from "next/link";
import type { AgendaSession } from "@/lib/schemas";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { useNow } from "@/lib/useNow";

/**
 * The homepage agenda preview, as a timeline rather than a flat divided list.
 *
 * The rows already carried `start`, `hall` and `track`; the old markup showed
 * them in a single non-wrapping flex row, which on a phone crushed the hall
 * label against a long title. A spine with a dot per session reads as a
 * schedule, stacks cleanly at small widths, and gives the track colour
 * somewhere to live.
 *
 * The "on now" highlight shares its clock with AgendaList via useNow, which
 * returns null until after mount so the server and client agree.
 */
export function AgendaTimeline({ sessions }: { sessions: AgendaSession[] }) {
  const now = useNow();

  return (
    <ol className="relative ml-1.5 border-l border-paper/10">
      {sessions.map((session, i) => {
        const color = trackColor(session.track);
        const isNow =
          now !== null && now >= new Date(session.start) && now <= new Date(session.end);
        const isLast = i === sessions.length - 1;

        return (
          <li key={`${session.start}-${session.hall}`} className={`relative pl-6 ${isLast ? "" : "pb-6"}`}>
            <span
              aria-hidden
              className={`absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${color.bg} ${
                isNow ? "ring-4 ring-blue/30" : ""
              }`}
            />

            <div
              className={`flex flex-col gap-1 rounded-md sm:flex-row sm:items-baseline sm:gap-4 ${
                isNow ? "-mx-2 bg-blue/10 px-2 py-1" : ""
              }`}
            >
              <time
                dateTime={session.start}
                className="font-mono text-sm tabular-nums text-paper/60 sm:w-14 sm:shrink-0"
              >
                {formatSessionTime(session.start)}
              </time>

              <span className="min-w-0 flex-1 break-words">{session.title}</span>

              <span className="flex items-center gap-2 sm:shrink-0">
                <span className={`font-mono text-[0.6875rem] uppercase tracking-wide ${color.text}`}>
                  {session.track}
                </span>
                <span className="font-mono text-xs uppercase text-paper/50">{session.hall}</span>
                {isNow && (
                  <span className="rounded-full bg-blue px-2 py-0.5 font-mono text-[0.625rem] uppercase text-ink">
                    On now
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}

      <li className="relative pl-6 pt-2">
        <Link
          href="/agenda"
          className="text-sm text-blue underline underline-offset-4 hover:decoration-2"
        >
          View full agenda →
        </Link>
      </li>
    </ol>
  );
}
