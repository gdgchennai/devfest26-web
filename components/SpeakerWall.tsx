import type { Speaker } from "@/lib/schemas";
import { Frame } from "@/components/Frame";
import { SlotGrid, type FilledSlot } from "@/components/SlotGrid";
import { uiCopy } from "@/site.config";

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

  const filled: FilledSlot[] = shown.map((speaker) => ({
    key: speaker.slug,
    href: `/speakers/${speaker.slug}`,
    content: (
      <span className="flex h-full flex-col p-3">
        <Frame
          src={speaker.photo}
          alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
          title={speaker.name}
          aspectRatio="1 / 1"
          sizes="(max-width: 640px) 50vw, 33vw"
        />
        <span className="mt-3 block truncate text-center font-semibold">{speaker.name}</span>
        <span className="block truncate text-center text-xs text-paper/70">
          {speaker.title} · {speaker.company}
        </span>
      </span>
    ),
  }));

  return (
    <SlotGrid
      cols="grid-cols-2 sm:grid-cols-3"
      slotClassName="aspect-[3/4]"
      slots={shown.length}
      filled={filled}
    />
  );
}
