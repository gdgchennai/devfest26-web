"use client";

import { useMemo, useRef, useState } from "react";
import { Frame } from "@/components/Frame";
import {
  usePhotoHallway,
  cardWidthVw,
  cardSizes,
  HALLWAY_CORRIDOR_CLASS,
  HALLWAY_CARD_CLASS,
  HALLWAY_BACKDROP_CLASS,
  HALLWAY_BEACON_CLASS,
  HALLWAY_STACK_CLASS,
  HALLWAY_HAZE_CLASS,
  STACK_CARD_CLASS,
} from "@/components/motion/usePhotoHallway";
import { hallwayPhotosFrom, stackPhotosFrom } from "@/lib/archive-roles";
import type { ArchivePhoto } from "@/lib/schemas";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { uiCopy } from "@/site.config";

export function MemoriesHallway({ photos }: { photos: ArchivePhoto[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const disabled = useClientValue(shouldUseStaticBaseline, true);
  const [settled, setSettled] = useState(false);

  // Same split as the homepage: the flying set and the destination set must be
  // disjoint, since the stack is visible from the first frame.
  const flying = useMemo(() => hallwayPhotosFrom(photos), [photos]);
  const stack = useMemo(() => stackPhotosFrom(photos), [photos]);

  usePhotoHallway({
    containerRef: sectionRef,
    flyCount: flying.length,
    stackCount: stack.length,
    maxScale: 2.6,
    // No copy on this page to make room for, so the row spreads where it is.
    riseToTop: false,
    onPhaseChange: (phase) => setSettled(phase === "hero"),
    disabled,
  });

  if (disabled) return null;

  return (
    // No permanent background: the backdrop below fades in as the hallway takes
    // the viewport and out as it releases, so this stops being a hard-edged
    // black block sitting in the middle of the page.
    //
    // z-[500] matches HeroSection's flythrough overlay — both sit above the
    // fixed hamburger button (z-50) so the pinned hallway covers it while
    // it's playing, same as the homepage intro does.
    <section ref={sectionRef} className="relative z-[500] mb-12 min-h-[100vh] min-h-[100dvh] overflow-hidden rounded-lg">
      <div className={HALLWAY_BACKDROP_CLASS} />
      <div className={HALLWAY_BEACON_CLASS} />
      <div className="absolute inset-0">
        <div className={HALLWAY_CORRIDOR_CLASS}>
          {flying.map((photo, i) => (
            <div
              key={photo.src}
              className={HALLWAY_CARD_CLASS}
              style={{
                ["--card-w" as string]: `${cardWidthVw(i)}vw`,
                ["--card-ar" as string]: `${photo.width} / ${photo.height}`,
              }}
            >
              <Frame
                src={photo.src}
                alt={photo.description}
                title={photo.title}
                aspectRatio="auto"
                sizes={cardSizes(i, 2.6)}
                preload
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        <div className={HALLWAY_STACK_CLASS}>
          {stack.map((photo) => (
            <div
              key={photo.src}
              className={STACK_CARD_CLASS}
              style={{ ["--card-ar" as string]: `${photo.width} / ${photo.height}` }}
            >
              <Frame
                src={photo.src}
                alt={photo.description}
                title={photo.title}
                aspectRatio="auto"
                sizes="34vw"
                className="h-full w-full"
              />
            </div>
          ))}

          {/* Above the deck, inside the group, so it travels with it. */}
          <div className={HALLWAY_HAZE_CLASS} />
        </div>
      </div>

      {/* Retires once the row has landed — there is nothing left to scroll for. */}
      {!settled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs uppercase tracking-wide text-paper/50">
          {uiCopy.memoriesHallway.scrollHint}
        </div>
      )}
    </section>
  );
}
