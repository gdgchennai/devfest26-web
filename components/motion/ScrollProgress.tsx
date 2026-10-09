"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMotion } from "@/components/motion/MotionProvider";

/**
 * Thin, floating bar at the bottom of the viewport on the homepage
 * experience only. Driven off rAF (same reason BracketsField polls scrollY
 * rather than waiting on Lenis/native "scroll" events — those go quiet
 * during a mobile fling).
 */
export function ScrollProgress() {
  const fillRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { lenisRef } = useMotion();
  const onExperience = pathname === "/";

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill || !onExperience) return;

    let raf = 0;
    let last = -1;

    const tick = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const y = lenisRef.current?.scroll ?? window.scrollY;
      const next = max <= 0 ? 0 : Math.min(1, Math.max(0, y / max));
      if (next !== last) {
        last = next;
        fill.style.transform = `scaleX(${next})`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathname, lenisRef, onExperience]);

  if (!onExperience) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))]"
      aria-hidden
    >
      <div className="relative mx-auto h-1 max-w-[48rem] overflow-hidden rounded-full bg-paper/20 shadow-[0_0_0_1px_color-mix(in_srgb,var(--paper)_14%,transparent)]">
        <div
          ref={fillRef}
          className="h-full w-full origin-left rounded-full will-change-transform"
          style={{
            transform: "scaleX(0)",
            background:
              "linear-gradient(90deg, var(--blue), var(--red) 34%, var(--yellow) 67%, var(--green))",
          }}
        />
      </div>
    </div>
  );
}
