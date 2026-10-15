"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { siteConfig, type Track } from "@/site.config";
import { AgendaList } from "@/components/AgendaList";
import { AgendaBoard } from "@/components/AgendaBoard";
import { AgendaTrackTabs, type AgendaTrackTab } from "@/components/AgendaTrackTabs";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { useTrackSwipe } from "@/lib/useTrackSwipe";
import { floorTracks } from "@/lib/agenda-floors";
import { uiCopy } from "@/site.config";

/** What an absent or unknown ?track= resolves to. Neither view has an "all
 *  tracks" tab: each picks a real track itself (AgendaBoard's
 *  defaultTrackSlug, the static list's first tab). */
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

  // A visitor can still want the plain list with motion fully available
  // (e.g. the spatial board's depth/scroll read as fiddly on a laptop
  // trackpad) — this is a separate, page-local override on top of that
  // baseline, not a replacement for it. Plain component state: nothing here
  // needs to survive a reload or be shareable the way ?lite= does.
  const [simpleMode, setSimpleMode] = useState(false);
  const useSimpleView = staticBaseline || simpleMode;

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

  // Tabs, columns and swipe order run floor by floor — D block 7th floor's
  // stages first, then 6th — rather than in site.config's raw order, so the
  // strip reads the way the venue is laid out. Anything not on a configured
  // floor falls through to the end instead of vanishing.
  const orderedTracks = useMemo(() => {
    const listed = new Set(siteConfig.floors.flatMap((f) => f.tracks));
    return [
      ...siteConfig.floors.flatMap((f) => floorTracks(f, tracks)),
      ...tracks.filter((t) => !listed.has(t.slug)),
    ];
  }, [tracks]);

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

  // Only shown once the spatial board is actually on offer — reduced-motion/
  // ?lite=1 visitors are already on the simple list via the global lite
  // toggle, and a second switch that can't do anything for them would just
  // be confusing.
  const toggle = !staticBaseline ? (
    <div className="mb-4 flex justify-center">
      <SimpleModeToggle value={simpleMode} onChange={setSimpleMode} />
    </div>
  ) : null;

  if (!useSimpleView) {
    return (
      <>
        {toggle}
        <AgendaBoard
          sessions={sessions}
          speakers={speakers}
          tracks={orderedTracks}
          activeTrack={activeTrack}
          onSelectTrack={selectTrack}
        />
      </>
    );
  }

  return (
    <>
      {toggle}
      <AgendaTrackList
        sessions={sessions}
        speakers={speakers}
        tracks={orderedTracks}
        activeTrack={activeTrack}
        onSelectTrack={selectTrack}
      />
    </>
  );
}

/** A toggle button (`aria-pressed`), same idiom as the footer's `LiteToggle` —
 *  pressed state for assistive tech, the word on/off for everyone, and a
 *  brand dot as the at-a-glance cue. */
function SimpleModeToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper"
    >
      {uiCopy.agendaView.simpleModeLabel}
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-green" : "bg-paper/20"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/** The lite / reduced-motion agenda: the same track tabs, then the plain
 *  chronological list filtered to the chosen track. Kept as its own
 *  component (rather than a branch inside AgendaView) so its own swipe
 *  listener's hook order never depends on which variant is showing. */
function AgendaTrackList({
  sessions,
  speakers,
  tracks,
  activeTrack,
  onSelectTrack,
}: {
  sessions: AgendaSession[];
  speakers: Speaker[];
  tracks: Track[];
  activeTrack: string;
  onSelectTrack: (slug: string) => void;
}) {
  const swipeRef = useRef<HTMLDivElement>(null);
  const tabOptions: AgendaTrackTab[] = tracks;
  // No "All" tab, so an absent ?track= falls on the first track.
  const activeIndex = Math.max(0, tabOptions.findIndex((t) => t.slug === activeTrack));
  const currentTrack = tabOptions[activeIndex]?.slug;

  useTrackSwipe({
    nodeRef: swipeRef,
    count: tabOptions.length,
    index: activeIndex,
    onStep: (direction) => onSelectTrack(tabOptions[activeIndex + direction].slug),
  });

  // Only sessions you can star: lunch, quick breaks and check-in are all
  // type "break", the same test FavoriteButton's callers use.
  const filtered = sessions.filter(
    (s) => s.type !== "break" && (s.track === null || s.track === currentTrack),
  );

  // The swipe surface wraps the tabs AND the list: a horizontal drag over
  // either switches track (over the tabs it must not scroll the strip
  // sideways — see `touch-action: pan-y` — and over the list it must not get
  // in the way of the page's own vertical scroll, which `pan-y` leaves
  // alone).
  return (
    <div ref={swipeRef} className="agenda-track-swipe mt-6">
      <AgendaTrackTabs
        tabs={tabOptions}
        activeSlug={currentTrack}
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
        <AgendaList sessions={filtered} speakers={speakers} showFavorite />
      </div>
    </div>
  );
}
