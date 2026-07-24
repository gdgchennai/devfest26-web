"use client";

import { useRef } from "react";
import { Frame } from "@/components/Frame";
import { usePhotoHallway } from "@/components/motion/usePhotoHallway";
import type { ArchivePhoto } from "@/lib/schemas";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

export function MemoriesHallway({ photos }: { photos: ArchivePhoto[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const photoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const disabled = useClientValue(shouldUseStaticBaseline, true);

  usePhotoHallway({
    containerRef: sectionRef,
    photoRefs,
    count: photos.length,
    scrubEnd: "+=220%",
    maxScale: 2.6,
    disabled,
  });

  if (disabled) return null;

  return (
    <section ref={sectionRef} className="relative mb-12 min-h-[100vh] overflow-hidden rounded-lg bg-ink">
      <div className="absolute inset-0">
        {photos.map((photo, i) => (
          <div
            key={photo.src}
            ref={(el) => {
              photoRefs.current[i] = el;
            }}
            className="absolute left-1/2 top-1/2 h-[35vh] w-[50vw] max-w-sm"
          >
            <Frame src={photo.src} alt={photo.description} title={photo.title} className="h-full w-full" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs uppercase tracking-wide text-paper/50">
        Scroll
      </div>
    </section>
  );
}
