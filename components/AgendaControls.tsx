"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Floor, Track } from "@/site.config";
import { uiCopy } from "@/site.config";

const SELECT_CLASS =
  "rounded-full bg-paper/10 px-4 py-2 text-sm font-medium text-paper outline-none hover:bg-paper/20 focus-visible:ring-2 focus-visible:ring-blue";

/**
 * Floor + track dropdowns and the "Simple view" switch shown above the
 * agenda, in both the spatial board and the flat table.
 *
 * State lives in the URL (`?floor=`, `?track=` and `?view=simple`) so a view
 * is shareable and there's no hydration mismatch. The switch is deliberately
 * independent of lite mode: it only swaps the board for the table and never
 * touches the `localStorage` lite flag.
 */
export function AgendaControls({
  floors,
  floor,
  tracks,
  value,
  simple,
  simpleLocked = false,
  allowAll = false,
}: {
  floors: readonly Floor[];
  /** Slug of the floor being shown. */
  floor: string;
  /** Only the tracks on that floor, in display order. */
  tracks: Track[];
  /** Selected track slug, or "all" when `allowAll`. */
  value: string;
  simple: boolean;
  /** True when the table is forced by lite/reduced-motion, so the switch can't turn it off. */
  simpleLocked?: boolean;
  /** Offer an "All" entry (only meaningful in the table, the board shows one track). */
  allowAll?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { floor?: string; track?: string; simple?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.floor !== undefined) params.set("floor", next.floor);
    if (next.track !== undefined) {
      if (next.track === "all") {
        params.delete("track");
        // "All" tracks, with no floor named, means every floor too — the
        // pairing mirrors picking "All" directly in the floor dropdown.
        if (next.floor === undefined) params.set("floor", "all");
      } else {
        params.set("track", next.track);
        // A concrete track already implies its floor; only "All" needs the
        // explicit `floor` param to remember which floor the dropdown shows.
        if (next.floor === undefined) params.delete("floor");
      }
    }
    if (next.simple !== undefined) {
      if (next.simple) params.set("view", "simple");
      else params.delete("view");
    }
    const qs = params.toString();
    router.replace(qs ? `/agenda?${qs}` : "/agenda", { scroll: false });
  }

  function changeFloor(slug: string) {
    if (slug === "all") {
      update({ floor: "all", track: "all" });
      return;
    }
    const target = floors.find((f) => f.slug === slug);
    if (!target) return;
    // Jump straight to the floor's first track. Nothing is hidden: the board
    // still holds every track and the table still lists every session.
    update({ floor: slug, track: target.tracks[0] });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <label className="flex items-center gap-3 text-sm font-medium text-paper/70">
        <span>{uiCopy.agendaView.floorLabel}</span>
        <select value={floor} onChange={(e) => changeFloor(e.target.value)} className={SELECT_CLASS}>
          {allowAll && (
            <option value="all" className="bg-ink text-paper">
              {uiCopy.agendaView.allFloorsLabel}
            </option>
          )}
          {floors.map((f) => (
            <option key={f.slug} value={f.slug} className="bg-ink text-paper">
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 text-sm font-medium text-paper/70">
        <span>{uiCopy.agendaView.trackLabel}</span>
        <select value={value} onChange={(e) => update({ track: e.target.value })} className={SELECT_CLASS}>
          {allowAll && (
            <option value="all" className="bg-ink text-paper">
              {uiCopy.agendaView.allTracksLabel}
            </option>
          )}
          {tracks.map((t) => (
            <option key={t.slug} value={t.slug} className="bg-ink text-paper">
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3 text-sm font-medium text-paper/70">
        <span id="agenda-simple-label">{uiCopy.agendaView.simpleViewLabel}</span>
        <button
          type="button"
          role="switch"
          aria-checked={simple}
          aria-labelledby="agenda-simple-label"
          disabled={simpleLocked}
          onClick={() => update({ simple: !simple })}
          className={`relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-60 ${
            simple ? "bg-blue" : "bg-paper/20"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${
              simple ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
