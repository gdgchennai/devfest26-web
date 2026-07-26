"use client";

import type { AgendaSession } from "@/lib/schemas";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { useNow } from "@/lib/useNow";

export function AgendaList({ sessions }: { sessions: AgendaSession[] }) {
  // Clock and track palette are both shared with the homepage timeline —
  // see lib/useNow.ts and lib/track-color.ts, which this file used to own.
  const now = useNow();

  return (
    <ol className="divide-y divide-paper/10 rounded-lg border border-paper/10">
      {sessions.map((session, i) => {
        const isNow =
          now !== null && now >= new Date(session.start) && now <= new Date(session.end);

        return (
          <li
            key={i}
            className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${
              isNow ? "bg-blue/15" : ""
            }`}
          >
            <span className="font-mono text-base tabular-nums text-paper/70 sm:w-32">
              {formatSessionTime(session.start)}–{formatSessionTime(session.end)}
            </span>

            <div className="flex-1">
              <p className="text-lg font-medium">{session.title}</p>
              <p className={`font-mono text-xs uppercase tracking-wide ${trackColor(session.track).text}`}>
                {session.track}
              </p>
            </div>

            <span className="font-mono text-lg font-medium text-paper sm:text-right">
              {session.hall}
            </span>

            {isNow && (
              <span className="rounded-full bg-blue px-2 py-0.5 font-mono text-xs uppercase text-paper">
                On now
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
