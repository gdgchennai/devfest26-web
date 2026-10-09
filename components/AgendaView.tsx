"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import type { Track } from "@/site.config";
import { AgendaList } from "@/components/AgendaList";
import { AgendaBoard } from "@/components/AgendaBoard";
import { AgendaTrackTabs, type AgendaTrackTab } from "@/components/AgendaTrackTabs";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { useTrackSwipe } from "@/lib/useTrackSwipe";
import { uiCopy } from "@/site.config";

/** The URL's name for "every track at once". The spatial board never uses
 *  it — it always has one track in focus, and picks that track itself
 *  (AgendaBoard's defaultTrackSlug) — but the static list filters by it. */
const ALL_TRACKS = "all";

function resolveTrackSlug(param: string | null, tracks: Track[]): string {
  return param !== null && tracks.some((t) => t.slug === param) ? param : ALL_TRACKS;
}

export function AgendaView({
  sessions,
  speakers,
  tracks,
}: {
  sessions: AgendaSession[];
  speakers: Speaker[];
  tracks: Track[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Static baseline (reduced-motion or ?lite=1) gets the flat instant-paint
  // list below; everyone else gets the spatial board. Defaults to the safe
  // static list on the server/first paint, same convention as every other
  // lite-gated component (see MotionProvider.tsx and its siblings).
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  // Local state, mirrored to the URL rather than read from it: switching
  // tracks has to move the underline, the columns and the list on the same
  // frame as the tap/swipe, and a router round trip between "intent" and
  // "response" is exactly the lag that makes a tab feel broken. The URL
  // still owns the truth for sharing and reloads (a hard requirement of the
  // event-day agenda, see devfest-2026-site-architecture.md) — selectTrack
  // below keeps the two in step.
  const [activeTrack, setActiveTrack] = useState(() =>
    resolveTrackSlug(searchParams.get("track"), tracks),
  );

  // Back/forward. The router does not remount the page for a same-route
  // ?track= change, so nothing else would notice the URL moved under us —
  // this is the one listener that puts the selection back under the URL's
  // control. (An event listener, not an effect that writes state: every
  // other writer is selectTrack, which owns both sides.)
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    function onPopState() {
      const param = new URLSearchParams(window.location.search).get("track");
      setActiveTrack(resolveTrackSlug(param, tracksRef.current));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectTrack(slug: string) {
    setActiveTrack(slug);
    // Built from the current query, not from a hardcoded "/agenda?track=…":
    // dropping the other params would silently undo a ?lite=1 (or anything
    // else) that the visitor arrived with.
    const params = new URLSearchParams(searchParams.toString());
    if (slug === ALL_TRACKS) params.delete("track");
    else params.set("track", slug);
    const query = params.toString();
    // `replace`, not `push`: each tab crossed must NOT become its own history
    // entry, or the back button unwinds the tabs one by one instead of
    // leaving the page. The URL still updates, so it stays shareable and a
    // reload still lands on the selected track.
    router.replace(query ? `/agenda?${query}` : "/agenda", { scroll: false });
  }

  if (!staticBaseline) {
    return (
      <AgendaBoard
        sessions={sessions}
        speakers={speakers}
        tracks={tracks}
        activeTrack={activeTrack}
        onSelectTrack={selectTrack}
      />
    );
  }

  return (
    <AgendaTrackList
      sessions={sessions}
      tracks={tracks}
      activeTrack={activeTrack}
      onSelectTrack={selectTrack}
    />
  );
}

/** The lite / reduced-motion agenda: the same track tabs, then the plain
 *  chronological list filtered to the chosen track. Kept as its own
 *  component (rather than a branch inside AgendaView) so its own swipe
 *  listener's hook order never depends on which variant is showing. */
function AgendaTrackList({
  sessions,
  tracks,
  activeTrack,
  onSelectTrack,
}: {
  sessions: AgendaSession[];
  tracks: Track[];
  activeTrack: string;
  onSelectTrack: (slug: string) => void;
}) {
  const swipeRef = useRef<HTMLDivElement>(null);
  const tabOptions: AgendaTrackTab[] = [{ slug: ALL_TRACKS, name: uiCopy.agendaView.allTracksLabel }, ...tracks];
  const activeIndex = Math.max(0, tabOptions.findIndex((t) => t.slug === activeTrack));

  useTrackSwipe({
    nodeRef: swipeRef,
    count: tabOptions.length,
    index: activeIndex,
    onStep: (direction) => onSelectTrack(tabOptions[activeIndex + direction].slug),
  });

  const filtered = activeTrack === ALL_TRACKS ? sessions : sessions.filter((s) => s.track === activeTrack);

  // The swipe surface wraps the tabs AND the list: a horizontal drag over
  // either switches track (over the tabs it must not scroll the strip
  // sideways — see `touch-action: pan-y` — and over the list it must not get
  // in the way of the page's own vertical scroll, which `pan-y` leaves
  // alone).
  return (
    <div ref={swipeRef} className="agenda-track-swipe mt-6">
      <AgendaTrackTabs
        tabs={tabOptions}
        activeSlug={activeTrack}
        onSelect={onSelectTrack}
        idPrefix="agenda-track"
        panelId="agenda-track-panel"
      />

      <div
        id="agenda-track-panel"
        role="tabpanel"
        aria-labelledby={`agenda-track-tab-${activeIndex}`}
        className="mt-6"
      >
        <AgendaList sessions={filtered} showFavorite />
      </div>
    </div>
  );
}
