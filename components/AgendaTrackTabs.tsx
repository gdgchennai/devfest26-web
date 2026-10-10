"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { uiCopy } from "@/site.config";

/** One entry in the agenda's track strip — `tracks` from site.config plus, in
 *  the static list, the synthetic "all tracks at once" entry. */
export type AgendaTrackTab = { slug: string; name: string };

/**
 * The agenda's track switcher: bold track titles on a single row, the active
 * one scaled up a touch with an underline beneath it, and the underline
 * sliding to whichever title becomes active.
 *
 * This replaced the old pill row — AgendaBoard's GlowButtons and the static
 * list's rounded chips (see git history) — because the track names are the
 * real information; a row of equal-weight pills made picking one a visual
 * matching game. Underline tabs are the usual answer, and the scale bump on
 * the active one keeps it readable at arm's length on a phone in a corridor.
 *
 * Both agenda variants render it: `AgendaBoard` (no "All" — it always has one
 * track in focus, see its defaultTrackSlug) and the static list (which does
 * have an "everything at once" filter).
 *
 * The strip is deliberately NOT something you scroll by hand: a horizontal
 * drag or wheel here switches track (see `touch-action: pan-y` on
 * `.agenda-track-tabs` and the swipe surface in the consumers), and the
 * component scrolls the active title into view itself when it changes. That
 * keeps one gesture meaning one thing everywhere on the agenda.
 */
export function AgendaTrackTabs({
  tabs,
  activeSlug,
  onSelect,
  idPrefix,
  panelId,
  align = "start",
}: {
  tabs: AgendaTrackTab[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  /** Namespaces the generated tab ids (`{idPrefix}-tab-{index}`) so the panel
   *  below can point aria-labelledby at the active one. */
  idPrefix: string;
  /** The tabpanel these tabs control. */
  panelId: string;
  /** Which way a row that fits sits: the spatial board is centred (its stage
   *  is), the static list is left-aligned (its list is). */
  align?: "start" | "center";
}) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.slug === activeSlug));

  const stripRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const underlineRef = useRef<HTMLSpanElement>(null);
  const scrolledOnceRef = useRef(false);

  /**
   * The underline is DOM state, written straight off the active tab's own box,
   * never React state: moving it then costs no render, and it stays correct
   * through the row's own reflows (the sm: font bump, a late Google Sans swap,
   * a resize) because it's re-placed from the live tab rather than from a
   * measurement captured once and then believed.
   */
  const placeUnderline = useCallback((index: number) => {
    const underline = underlineRef.current;
    const tab = tabRefs.current[index];
    if (!underline || !tab) return;
    // offsetLeft/offsetWidth are against .agenda-track-tabs__row — the
    // underline's own offsetParent (it's position: relative) — so the values
    // are usable directly as translateX/width.
    underline.style.width = `${tab.offsetWidth}px`;
    underline.style.transform = `translateX(${tab.offsetLeft}px)`;
  }, []);

  // Before the first paint, so the underline never animates in from the left
  // edge on mount; after it, every reflow re-places it under the active title.
  useLayoutEffect(() => {
    placeUnderline(activeIndex);
    const observer = new ResizeObserver(() => placeUnderline(activeIndex));
    if (rowRef.current) observer.observe(rowRef.current);
    for (const tab of tabRefs.current) if (tab) observer.observe(tab);
    document.fonts?.ready.then(() => placeUnderline(activeIndex));
    return () => observer.disconnect();
  }, [activeIndex, placeUnderline, tabs]);

  // Keep the active title reachable when the row is wider than the screen
  // (four bold titles plus "All" won't fit a phone). Scrolled by hand, with
  // the strip's own scrollLeft — never scrollIntoView(), which walks up to
  // the page and would yank the whole agenda around. Only once something has
  // actually changed the active tab; landing on a page should not scroll.
  useEffect(() => {
    if (!scrolledOnceRef.current) {
      scrolledOnceRef.current = true;
      return;
    }
    const strip = stripRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!strip || !tab) return;
    const left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeIndex]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const direction = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    e.preventDefault();
    const next = Math.min(Math.max(activeIndex + direction, 0), tabs.length - 1);
    if (next === activeIndex) return;
    onSelect(tabs[next].slug);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      ref={stripRef}
      className={`agenda-track-tabs${align === "center" ? " agenda-track-tabs--center" : ""}`}
      role="tablist"
      aria-label={uiCopy.agendaView.tracksAriaLabel}
      onKeyDown={onKeyDown}
    >
      <div ref={rowRef} className="agenda-track-tabs__row">
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={tab.slug}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${i}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.slug)}
              className={`agenda-track-tabs__tab${active ? " agenda-track-tabs__tab--active" : ""}`}
            >
              <span className="agenda-track-tabs__label">{tab.name}</span>
            </button>
          );
        })}
        <span ref={underlineRef} className="agenda-track-tabs__underline" aria-hidden />
      </div>
    </div>
  );
}
