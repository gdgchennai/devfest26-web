"use client";

import { useState } from "react";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { trackColor } from "@/lib/track-color";
import { findSpeakers } from "@/lib/find-speaker";
import { Frame } from "@/components/Frame";
import { siteConfig, uiCopy } from "@/site.config";
import { SessionDescriptionModal } from "@/components/SessionDescriptionModal";

/**
 * A speaker's talks, each opening the same session-description popup the
 * agenda board/list use (see SessionDescriptionModal) — not a separate page,
 * so a visitor gets the one description of a session no matter where they
 * clicked into it from.
 *
 * A co-presented talk needs no separate "co-speaker" field: a session's own
 * `speakerSlugs` (lib/schemas.ts) already lists everyone on it — adding a
 * second slug there is what makes a talk co-presented. This just renders
 * whoever that array resolves to, minus the speaker whose own page this is.
 */
export function SpeakerTalks({
  talks,
  speakers,
  speakerSlug,
  heading,
}: {
  talks: AgendaSession[];
  /** Full roster, passed through to the modal so a co-presented talk can
   *  still link out to its other speakers. */
  speakers: Speaker[];
  /** The speaker whose page this is — excluded from each talk's own
   *  co-speaker row (their photo is already shown alongside the page). */
  speakerSlug: string;
  heading: string;
}) {
  const [descriptionSession, setDescriptionSession] = useState<AgendaSession | null>(null);

  if (talks.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-paper/50">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {talks.map((session) => {
          const color = trackColor(session.track);
          const trackName = session.track
            ? (siteConfig.tracks.find((t) => t.slug === session.track)?.name ?? session.track)
            : null;
          const pillLabel = trackName === session.hall ? session.type : trackName;
          const coSpeakers = findSpeakers(speakers, session.speakerSlugs).filter((s) => s.slug !== speakerSlug);
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => setDescriptionSession(session)}
              className="rounded-lg border border-paper/10 p-5 text-left transition-colors hover:border-paper/25"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {pillLabel && <p className={`text-xs uppercase tracking-wide ${color.text}`}>{pillLabel}</p>}
                  <h3 className="mt-1 text-xl font-semibold">{session.title}</h3>
                </div>
                {coSpeakers.length > 0 && (
                  <div className="flex shrink-0 gap-2">
                    {coSpeakers.map((coSpeaker) => (
                      <div
                        key={coSpeaker.slug}
                        title={coSpeaker.name}
                        className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-surface"
                      >
                        <Frame
                          src={coSpeaker.photo}
                          alt={`${uiCopy.common.portraitAltPrefix}${coSpeaker.name}`}
                          title={coSpeaker.name}
                          aspectRatio="1 / 1"
                          sizes="36px"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <SessionDescriptionModal
        session={descriptionSession}
        speakers={speakers}
        onClose={() => setDescriptionSession(null)}
      />
    </div>
  );
}
