"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

/* ------------------------------------------------------------------ *
 * Canvas particle vortex (adapted from GSAP's own "Canvas particles" demo,
 * https://codepen.io/GreenSock/pen/NWZRRNb), reskinned with the DevFest
 * brand shapes in place of the demo's flair PNGs.
 *
 * 72 particles cycle through the 6 brand shapes. A single GSAP timeline
 * tweens every particle's {x, y, scale, rotate} from a point on a 10-armed
 * spiral (function-based values: angle*10 turns a plain circle spiky) at
 * the canvas radius, inward to the center at scale 0 — with a negative,
 * infinitely-repeating stagger so later particles lead, reading as a
 * continuous stream feeding into the vanishing point. The timeline's own
 * onUpdate is the render loop: no separate rAF, GSAP's ticker drives it.
 * ------------------------------------------------------------------ */

const PARTICLE_COUNT = 72;
/** Largest particle's on-screen size, as a fraction of the canvas radius —
 *  keeps the vortex readable at any viewport size instead of scaling off
 *  the shapes' raw pixel dimensions. */
const TARGET_RATIO = 0.05;

type Particle = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  img: HTMLImageElement;
};

export function ParticleCover({
  shapes,
  className,
  onReady,
}: {
  /** Public URLs of the SVGs to cycle through, e.g. from getBrandShapes()
   *  (lib/brandShapes.ts) — a Server Component reads public/brand-shapes
   *  and passes the list down, so this stays in sync with whatever's in
   *  that folder without a hardcoded manifest here. */
  shapes: string[];
  className?: string;
  /** Hands the caller the timeline so it can play()/pause() it — e.g. to
   *  stop rendering while this canvas is scrolled out of view. Starts
   *  paused; the caller drives play state entirely. */
  onReady?: (timeline: gsap.core.Timeline) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const container = wrapRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !container || !ctx || shapes.length === 0) return;

      let cw = 0;
      let ch = 0;
      let radius = 0;

      const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const img = new Image();
        img.src = shapes[i % shapes.length];
        return { x: 0, y: 0, scale: 0, rotate: 0, img };
      });

      function draw() {
        // Sort by scale to fake z-order: bigger (closer to the vanishing
        // point) particles paint over smaller ones.
        particles.sort((a, b) => a.scale - b.scale);
        ctx!.clearRect(0, 0, cw, ch);
        const target = radius * TARGET_RATIO;
        particles.forEach((p) => {
          if (!p.img.complete || p.img.naturalWidth === 0) return;
          // Normalises each shape's own intrinsic size (read from the SVG
          // at load time, not hardcoded) so, say, a 300px-wide shape and a
          // 100px-wide one still land at the same on-screen size.
          const unitScale = target / Math.max(p.img.naturalWidth, p.img.naturalHeight);
          ctx!.translate(cw / 2, ch / 2);
          ctx!.rotate(p.rotate);
          const w = p.img.naturalWidth * unitScale * p.scale;
          const h = p.img.naturalHeight * unitScale * p.scale;
          ctx!.drawImage(p.img, p.x - w / 2, p.y - h / 2, w, h);
          ctx!.resetTransform();
        });
      }

      const duration = 5;
      // Spacing between consecutive particles' start times, derived from the
      // particle count instead of hardcoded: the original demo's -0.05 was
      // tuned for its own 99 particles ((99-1)*0.05 = 4.9s spread against a
      // 5s duration — a near-seamless 2% gap in the phase cycle). Copied
      // verbatim onto a different particle count, that gap stops being
      // negligible: at 72 particles the same -0.05 only covers 3.55s of the
      // 5s cycle, leaving a visible ~29% dead patch where nothing is mid-
      // flight — the "batch, then gap" the effect showed before this fix.
      // duration/length instead tiles the full cycle regardless of count.
      const each = -(duration / particles.length);
      const tl = gsap.timeline({ paused: true, onUpdate: draw }).fromTo(
        particles,
        {
          x: (i: number) => {
            const angle = (i / particles.length) * Math.PI * 2 - Math.PI / 2;
            return Math.cos(angle * 10) * radius;
          },
          y: (i: number) => {
            const angle = (i / particles.length) * Math.PI * 2 - Math.PI / 2;
            return Math.sin(angle * 10) * radius;
          },
          scale: 1.1,
          rotate: 0,
        },
        {
          duration,
          ease: "sine",
          x: 0,
          y: 0,
          scale: 0,
          rotate: -3,
          stagger: { each, repeat: -1 },
        },
        0,
      );
      tl.seek(99);

      function resize() {
        cw = canvas!.width = container!.clientWidth;
        ch = canvas!.height = container!.clientHeight;
        radius = Math.max(cw, ch);
        tl.invalidate();
        draw();
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      onReady?.(tl);

      return () => {
        ro.disconnect();
        tl.kill();
      };
    },
    { scope: wrapRef },
  );

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
