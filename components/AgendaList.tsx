"use client";

import { useState } from "react";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { findSpeakers, joinSpeakerNames } from "@/lib/find-speaker";
import { useNow } from "@/lib/useNow";
import { uiCopy } from "@/site.config";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { SessionDescriptionModal } from "@/components/SessionDescriptionModal";

export function AgendaList({
  sessions,
  speakers = [],
  showFavorite = false,
}: {
  sessions: AgendaSession[];
  /** Looked up by `speakerSlugs` to show the speakers' names under the title. */
  speakers?: Speaker[];
  /** Render a save/remove star on each real session (not breaks). */
  showFavorite?: boolean;
}) {
  // Clock and track palette are both shared with the homepage timeline —
  // see lib/useNow.ts and lib/track-color.ts, which this file used to own.
  const now = useNow();
  // The session whose title was clicked — see SessionDescriptionModal.
  const [descriptionSession, setDescriptionSession] = useState<AgendaSession | null>(null);

  return (
    <>
      <ol className="divide-y divide-paper/10 rounded-lg border border-paper/10">
        {sessions.map((session, i) => {
          const isNow =
            now !== null && now >= new Date(session.start) && now <= new Date(session.end);
          const sessionSpeakers = findSpeakers(speakers, session.speakerSlugs);

          return (
            <li
              key={i}
              className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${
                isNow ? "bg-blue/15" : ""
              }`}
            >
              <span className="text-base tabular-nums text-paper/70 sm:w-32">
                {formatSessionTime(session.start)}–{formatSessionTime(session.end)}
              </span>

              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => setDescriptionSession(session)}
                  className="text-left text-lg font-medium underline-offset-4 hover:underline"
                >
                  {session.title}
                </button>
                {sessionSpeakers.length > 0 && (
                  <p className={`text-xs uppercase tracking-wide ${trackColor(session.track).text}`}>
                    {joinSpeakerNames(sessionSpeakers)}
                  </p>
                )}
              </div>

              <span className="text-lg font-medium text-paper sm:text-right">
                {session.hall}
              </span>

              {isNow && (
                <span className="rounded-full bg-blue px-2 py-0.5 text-xs uppercase text-paper">
                  {uiCopy.agenda.onNowLabel}
                </span>
              )}

              {showFavorite && session.type !== "break" && (
                <FavoriteButton session={session} />
              )}
            </li>
          );
        })}
      </ol>

      <SessionDescriptionModal
        session={descriptionSession}
        speakers={speakers}
        onClose={() => setDescriptionSession(null)}
      />
    </>
  );
}
