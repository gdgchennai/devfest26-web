"use client";

import { useRef, type ReactNode } from "react";

/**
 * Pointer-follow tilt. Writes CSS vars on the node (not React state) so
 * pointermove does not re-render. Disabled in CSS for touch / reduced-motion.
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
