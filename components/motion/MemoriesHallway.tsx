"use client";

import { useMemo, useRef, useState } from "react";
import { Frame } from "@/components/Frame";
import { StackControls } from "@/components/motion/StackControls";
import {
  usePhotoHallway,
  cardWidthVw,
  HALLWAY_CARD_CLASS,
  HALLWAY_BACKDROP_CLASS,
  HALLWAY_BEACON_CLASS,
  HALLWAY_STACK_CLASS,
  STACK_CARD_CLASS,
} from "@/components/motion/usePhotoHallway";
import type { ArchivePhoto } from "@/lib/schemas";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

export function MemoriesHallway({ photos }: { photos: ArchivePhoto[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const disabled = useClientValue(shouldUseStaticBaseline, true);
  const [settled, setSettled] = useState(false);

  // Same split as the homepage: the flying set and the destination set must be
  // disjoint, since the stack is visible from the first frame.
  const flying = useMemo(() => photos.filter((p) => p.role === "hallway"), [photos]);
  const stack = useMemo(() => photos.filter((p) => p.role === "stack"), [photos]);

  const { cycle } = usePhotoHallway({
    containerRef: sectionRef,
    flyCount: flying.length,
    stackCount: stack.length,
    maxScale: 2.6,
    // No copy on this page to make room for, so the stack stays centred.
    heroHandoff: false,
    onPhaseChange: (phase) => setSettled(phase === "hero"),
    disabled,
  });

  if (disabled) return null;

  return (
    // No permanent background: the backdrop below fades in as the hallway takes
    // the viewport and out as it releases, so this stops being a hard-edged
    // black block sitting in the middle of the page.
    <section ref={sectionRef} className="relative mb-12 min-h-[100vh] overflow-hidden rounded-lg">
      <div className={HALLWAY_BACKDROP_CLASS} />
      <div className={HALLWAY_BEACON_CLASS} />
      <div className="absolute inset-0">
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
              sizes="40vw"
              className="h-full w-full"
            />
          </div>
        ))}

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
        </div>
      </div>

      {/* Swaps to the browse controls once the photos have landed in the stack. */}
      {!settled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs uppercase tracking-wide text-paper/50">
          Scroll
        </div>
      )}
      <StackControls active={settled} count={stack.length} onCycle={cycle} />
    </section>
  );
}
