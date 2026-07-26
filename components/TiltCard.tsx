"use client";

import { useRef, type ReactNode } from "react";

/**
 * A surface that tilts slightly toward the pointer, with a soft sheen tracking
 * it — the way a foil-stamped ticket catches the light when you turn it.
 *
 * The tilt is capped at a deliberately small angle. This wraps the site's one
 * conversion element, and a card that swings far enough to move its own button
 * out from under an approaching cursor costs more than the effect is worth.
 * At this amplitude the CTA shifts a couple of pixels.
 *
 * Values are written to CSS custom properties directly on the node rather than
 * held in state: pointermove fires continuously, and re-rendering React on
 * every frame to move a gradient is not a trade worth making. Same approach as
 * TrackCards.
 *
 * Both the tilt and the sheen are opted into in CSS behind `hover: hover` and
 * `prefers-reduced-motion: no-preference` — on touch there is no pointer to
 * follow and the value would stick after a tap.
 */
export function TiltCard({
  children,
  className = "",
  /** Maximum rotation on either axis, in degrees. */
  maxTilt = 3.5,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="tilt-scene">
      <div
        ref={ref}
        className={`tilt-card ${className}`.trim()}
        onPointerMove={(e) => {
          const el = ref.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          // Pointer above centre tips the top away from you, not toward — the
          // inverted X sign is what makes it read as a physical object.
          el.style.setProperty("--tilt-x", `${(0.5 - py) * maxTilt * 2}deg`);
          el.style.setProperty("--tilt-y", `${(px - 0.5) * maxTilt * 2}deg`);
          el.style.setProperty("--sheen-x", `${px * 100}%`);
          el.style.setProperty("--sheen-y", `${py * 100}%`);
          el.style.setProperty("--sheen-on", "1");
        }}
        onPointerLeave={() => {
          const el = ref.current;
          if (!el) return;
          el.style.setProperty("--tilt-x", "0deg");
          el.style.setProperty("--tilt-y", "0deg");
          el.style.setProperty("--sheen-on", "0");
        }}
      >
        {children}
      </div>
    </div>
  );
}
