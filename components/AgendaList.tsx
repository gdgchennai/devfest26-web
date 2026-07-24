"use client";

import { useRef, useSyncExternalStore } from "react";
import type { AgendaSession } from "@/lib/schemas";
import { formatSessionTime } from "@/lib/format";

const TRACK_COLOR: Record<string, string> = {
  ai: "text-blue",
  cloud: "text-green",
  mobile: "text-red",
  web: "text-yellow",
};

function getServerNow() {
  return null;
}

export function AgendaList({ sessions }: { sessions: AgendaSession[] }) {
  // getSnapshot reads this cached ref rather than calling Date.now() itself,
  // so it returns a stable value between the minute-by-minute notifications
  // useSyncExternalStore requires (calling Date.now() directly as getSnapshot
  // would "change" on every call and defeat the point of the store).
  const cachedNow = useRef<number | null>(null);
  const nowMs = useSyncExternalStore(
    (callback) => {
      cachedNow.current = Date.now();
      callback();
      const id = setInterval(() => {
        cachedNow.current = Date.now();
        callback();
      }, 60_000);
      return () => clearInterval(id);
    },
    () => cachedNow.current,
    getServerNow,
  );
  const now = nowMs === null ? null : new Date(nowMs);

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
              <p className={`font-mono text-xs uppercase tracking-wide ${TRACK_COLOR[session.track] ?? "text-paper/60"}`}>
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
