"use client";

import { useEffect } from "react";
import { trackCtaFromAnchor } from "@/lib/analytics";

/**
 * Document-level capture listener for conversion-link clicks. Lives here
 * rather than on every `GlowButton` / nav `<a>` so a new CTA that already
 * points at `/tickets`, the CFP form, WhatsApp, etc. is counted without a
 * second edit.
 *
 * Capture, not bubble: `MotionProvider` intercepts internal `<Link>` clicks
 * in capture and `stopPropagation()`s them for the route-transition curtain,
 * so a bubble listener would never see "Get tickets". Registered from this
 * child so its effect runs before MotionProvider's (React runs child
 * effects first) and this handler is first in the capture list.
 */
export function CtaTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      trackCtaFromAnchor(anchor);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
