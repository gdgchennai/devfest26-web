import { speakers } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { SlotGrid, type FilledSlot } from "@/components/SlotGrid";
import { speakerCta } from "@/lib/cta";

/**
 * The speaker lineup as a roster with open places.
 *
 * `content/speakers.json` is `[]`, and both the homepage (which had no speaker
 * section at all) and /speakers were handling that with a single sentence of
 * apology. Showing the empty places instead turns the gap into the CFP pitch —
 * the invitation sits in the lineup, where someone browsing for speakers is
 * already looking. Destination comes from `speakerCta()`, so setting
 * `siteConfig.cfp.formUrl` points these straight at Sessionize.
 *
 * Portraits go through <Frame> — unlike sponsor logos these are photographs,
 * which is exactly what its object-cover crop and halftone fallback are for.
 */

/** Places shown in the lineup before it starts scrolling past a screenful. */
const SLOTS = 6;

export function SpeakerWall({ limit = SLOTS }: { limit?: number }) {
  const shown = speakers.slice(0, limit);
  const cta = speakerCta();

  const filled: FilledSlot[] = shown.map((speaker) => ({
    key: speaker.slug,
    href: `/speakers/${speaker.slug}`,
    content: (
      <span className="flex h-full flex-col p-3">
        <Frame
          src={speaker.photo}
          alt={`Portrait of ${speaker.name}`}
          title={speaker.name}
          aspectRatio="1 / 1"
          sizes="(max-width: 640px) 50vw, 33vw"
        />
        <span className="mt-3 block truncate font-semibold">{speaker.name}</span>
        <span className="block truncate text-xs text-paper/70">
          {speaker.title} · {speaker.company}
        </span>
      </span>
    ),
  }));

  return (
    <SlotGrid
      cols="grid-cols-2 sm:grid-cols-3"
      slotClassName="aspect-[3/4]"
      slots={Math.max(limit, shown.length + 1)}
      filled={filled}
      invite={{
        href: cta.available ? cta.href : "/cfp",
        external: cta.available && cta.external,
        label: "This could be you",
        srLabel: "submit a talk to the call for proposals",
        ornament: <SpeakerSilhouette />,
      }}
    />
  );
}

/** Echoes the square portrait a filled slot would show, so the row reads as one set. */
function SpeakerSilhouette() {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-blue/50"
    >
      <span className="h-3.5 w-3.5 rounded-full bg-blue/40" />
    </span>
  );
}
