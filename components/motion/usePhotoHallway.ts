import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clamp, mapRange, easeInAccelerating, easeOutSettle } from "@/lib/easing";

gsap.registerPlugin(ScrollTrigger);

type PhotoOffset = { ox: number; oy: number; rotate: number };

const PILE_START = 0.74;
const PILE_END = 0.88;

function deterministicOffset(index: number): PhotoOffset {
  // Golden-angle scatter: spreads points off-centre and off the diagonals
  // deterministically (no Math.random(), so SSR/CSR and re-renders match).
  const angle = index * 137.508 * (Math.PI / 180);
  const radius = 0.25 + 0.35 * ((index * 0.618) % 1);
  return {
    ox: Math.cos(angle) * radius,
    oy: Math.sin(angle) * radius,
    rotate: -8 + ((index * 53) % 17),
  };
}

export type HallwayOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  photoRefs: React.RefObject<(HTMLDivElement | null)[]>;
  count: number;
  scrubEnd: string; // e.g. "+=340%"
  maxScale?: number;
  onProgress?: (progress: number) => void;
  disabled?: boolean;
};

export function usePhotoHallway({
  containerRef,
  photoRefs,
  count,
  scrubEnd,
  maxScale = 3.2,
  onProgress,
  disabled = false,
}: HallwayOptions) {
  useGSAP(() => {
    if (disabled || !containerRef.current) return;

    const offsets = Array.from({ length: count }, (_, i) => deterministicOffset(i));
    const container = containerRef.current;

    ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: scrubEnd,
      pin: true,
      scrub: 1,
      onEnter: () => gsap.set(container, { willChange: "transform" }),
      onLeave: () => gsap.set(container, { willChange: "auto" }),
      onUpdate: (self) => {
        const progress = self.progress;
        onProgress?.(progress);

        photoRefs.current?.forEach((el, i) => {
          if (!el) return;
          const offset = offsets[i];
          const windowStart = i * 0.055;
          const windowEnd = windowStart + 0.42;

          let scale: number;
          let opacity: number;
          let tx = offset.ox;
          let ty = offset.oy;
          let rotate = 0;

          if (progress < PILE_START) {
            if (progress < windowStart) {
              scale = 0.15;
              opacity = 0;
            } else {
              const local = clamp(mapRange(windowStart, windowEnd, 0, 1, progress));
              scale = 0.15 + (maxScale - 0.15) * easeInAccelerating(local);
              opacity =
                local < 0.15
                  ? mapRange(0, 0.15, 0, 1, local)
                  : local > 0.8
                    ? clamp(mapRange(0.8, 1, 1, 0, local))
                    : 1;
            }
          } else if (progress < PILE_END) {
            const pileLocal = easeOutSettle(mapRange(PILE_START, PILE_END, 0, 1, progress));
            scale = gsap.utils.interpolate(maxScale, 0.42, pileLocal);
            tx = gsap.utils.interpolate(offset.ox, offset.ox * 0.15, pileLocal);
            ty = gsap.utils.interpolate(offset.oy, offset.oy * 0.15, pileLocal);
            rotate = gsap.utils.interpolate(0, offset.rotate, pileLocal);
            opacity = 1;
          } else {
            scale = 0.42;
            tx = offset.ox * 0.15;
            ty = offset.oy * 0.15;
            rotate = offset.rotate;
            opacity = clamp(mapRange(PILE_END, 1, 1, 0, progress));
          }

          gsap.set(el, {
            xPercent: -50,
            yPercent: -50,
            x: `${tx * scale * 50}vw`,
            y: `${ty * scale * 50}vh`,
            scale,
            rotate,
            opacity,
            zIndex: progress >= PILE_START ? 100 + i : i,
          });
        });
      },
    });
  }, { scope: containerRef, dependencies: [count, scrubEnd, maxScale, disabled], revertOnUpdate: true });
}
