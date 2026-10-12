import type { Speaker } from "@/lib/schemas";
import { Frame } from "@/components/Frame";
import { SlotGrid, type FilledSlot } from "@/components/SlotGrid";
import { uiCopy } from "@/site.config";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";

/** Full-tone Google colour behind each portrait, distinct from `FALLBACK_BG`'s
 *  halftone (that's for the no-photo state; this is a glow behind a real one). */
const GLOW_BG: Record<FallbackColor, string> = {
  blue: "bg-blue",
  red: "bg-red",
  yellow: "bg-yellow",
  green: "bg-green",
};

/**
 * The speaker lineup as a roster.
 *
 * Portraits go through <Frame>: these are photographs, which is exactly what
 * its object-cover crop and halftone fallback are for.
 */

/** Places shown in the lineup before it starts scrolling past a screenful. */
const SLOTS = 6;

export function SpeakerWall({ speakers, limit = SLOTS }: { speakers: Speaker[]; limit?: number }) {
  const shown = speakers.slice(0, limit);

  let previousGlow: FallbackColor | undefined;
  const filled: FilledSlot[] = shown.map((speaker) => {
    previousGlow = fallbackColorFor(speaker.slug, previousGlow);
    const glow = previousGlow;
    return {
      key: speaker.slug,
      href: `/speakers/${speaker.slug}`,
      content: (
        <span className="flex h-full flex-col p-3">
          <div className="relative">
            <div
              aria-hidden
              className={`absolute -inset-3 -z-10 rounded-full opacity-50 blur-2xl ${GLOW_BG[glow]}`}
            />
            <Frame
              src={speaker.photo}
              alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
              title={speaker.name}
              aspectRatio="1 / 1"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </div>
          <span className="mt-3 block truncate font-semibold">{speaker.name}</span>
          <span className="block truncate text-xs text-paper/70">
            {speaker.title} · {speaker.company}
          </span>
        </span>
      ),
    };
  });

  return (
    <SlotGrid
      cols="grid-cols-2 sm:grid-cols-3"
      slotClassName="aspect-[3/4]"
      slots={shown.length}
      filled={filled}
    />
  );
}
