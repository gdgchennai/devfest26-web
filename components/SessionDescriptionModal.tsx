"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { findSpeakers } from "@/lib/find-speaker";
import { Frame } from "@/components/Frame";
import { siteConfig, uiCopy } from "@/site.config";
import { useDialog } from "@/components/games/useDialog";

/**
 * The popup a talk's title opens onto its full description — shared by the
 * spatial agenda board and the simple list view, since both let you click a
 * session's title. `session` is null when closed; this still runs its hooks
 * (useDialog) every render regardless, same convention as every other modal
 * in this codebase (see ScoreModal).
 *
 * The close button and header live outside the scrolling body (a separate
 * child with its own `overflow-y-auto`), not inside it — the button used to
 * be a sibling of the scrolled content but positioned `absolute` against the
 * same element that scrolled, so it drifted out of place as the description
 * scrolled past. Splitting them keeps the button pinned in the corner.
 * Full-screen below `sm` instead of a centred card — a fixed-size popup on a
 * phone either clips the ~100-word description or leaves barely any margin;
 * filling the viewport gives the text room either way.
 *
 * Portalled to `<body>`, not rendered in place: both AgendaBoard and
 * AgendaList sit inside pages that wrap their content in a `relative z-10`
 * container (for stacking above full-bleed background decorations). That
 * `position: relative` + a z-index creates its own stacking context, so a
 * `position: fixed` descendant's z-index is only compared against other
 * elements INSIDE that context, not page-wide — this modal's `z-999` was
 * losing to the site header's `z-50` for exactly that reason. Same fix, same
 * reasoning, as TicketSelector's checkout panel.
 */
export function SessionDescriptionModal({
  session,
  speakers,
  onClose,
}: {
  session: AgendaSession | null;
  speakers: Speaker[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, session !== null, onClose);

  if (!session) return null;

  const color = trackColor(session.track);
  const trackName = session.track
    ? (siteConfig.tracks.find((t) => t.slug === session.track)?.name ?? session.track)
    : null;
  // Same redundancy fallback as the agenda board's own pill — see its
  // comment: Raman Hall's track name is just its hall name.
  const pillLabel = trackName === session.hall ? session.type : trackName;
  const sessionSpeakers = findSpeakers(speakers, session.speakerSlugs);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-999 flex items-center justify-center bg-ink/80 backdrop-blur-md animate-fade-in sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-description-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-hidden bg-surface-raised text-paper shadow-2xl sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-3xl sm:border sm:border-paper/15"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-paper/50 transition-colors hover:bg-paper/10 hover:text-paper cursor-pointer"
        >
          ✕
        </button>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            {pillLabel && (
              <span className={`rounded-full px-3 py-1 text-[0.6875rem] uppercase tracking-wide text-ink ${color.bg}`}>
                {pillLabel}
              </span>
            )}
            <span className="text-sm tabular-nums text-paper/70">
              {formatSessionTime(session.start)} - {formatSessionTime(session.end)}
            </span>
          </div>

          <h2 id="session-description-title" className="mt-4 pr-8 text-xl font-semibold leading-tight sm:text-2xl">
            {session.title}
          </h2>

          {sessionSpeakers.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {sessionSpeakers.map((speaker) => (
                <Link
                  key={speaker.slug}
                  href={`/speakers/${speaker.slug}`}
                  onClick={onClose}
                  className="group flex items-center gap-3"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    <Frame
                      src={speaker.photo}
                      alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
                      title={speaker.name}
                      aspectRatio="1 / 1"
                      sizes="36px"
                    />
                  </div>
                  <span className="text-sm text-paper/80 group-hover:text-paper group-hover:underline">
                    {speaker.name}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {session.description && (
            <p className="mt-5 text-sm leading-relaxed text-paper/80">{session.description}</p>
          )}

          <p className="mt-5 text-xs uppercase tracking-wide text-paper/50">{session.hall}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
