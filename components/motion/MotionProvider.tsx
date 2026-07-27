"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { EASE_CURTAIN } from "@/components/motion/eases";
import { useClientValue } from "@/lib/useClientValue";

gsap.registerPlugin(ScrollTrigger);

type MotionContextValue = {
  /** Always used imperatively (from effects/handlers), so a ref — not state
   *  that would need to trigger a re-render once the instance is ready. */
  lenisRef: React.RefObject<Lenis | null>;
  curtainRef: React.RefObject<HTMLDivElement | null>;
  /** The same node as curtainRef.current, as state — safe to read during render (e.g. for a portal target). */
  curtainEl: HTMLDivElement | null;
  staticBaseline: boolean;
};

const MotionContext = createContext<MotionContextValue | null>(null);

export function useMotion() {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error("useMotion must be used within MotionProvider");
  return ctx;
}

const TRANSITION_IN_MS = 500;
const TRANSITION_OUT_MS = 600;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [curtainEl, setCurtainEl] = useState<HTMLDivElement | null>(null);
  const staticBaseline = useClientValue(shouldUseStaticBaseline, false);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const router = useRouter();
  const transitioningRef = useRef(false);

  // One Lenis instance for the whole site, created here and kept alive
  // across route changes (root layout never remounts on navigation).
  useEffect(() => {
    // Always land at the top on a fresh load / refresh — opt out of the
    // browser's native scroll restoration and reset before Lenis takes over.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const instance = new Lenis({ autoRaf: false });
    instance.scrollTo(0, { immediate: true, force: true });
    const tick = (time: number) => instance.raf(time * 1000);
    instance.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenisRef.current = instance;

    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Route-transition mode: intercept internal link clicks, sweep the
  // shared curtain in, commit the navigation behind it, sweep back out.
  useEffect(() => {
    if (staticBaseline) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return;

      // Capture phase (see the listener registration below) so this runs
      // before Next's own <Link> click handler — otherwise Link has already
      // navigated by the time a bubble-phase listener could preventDefault.
      e.preventDefault();
      e.stopPropagation();
      if (transitioningRef.current || !curtainRef.current) {
        router.push(href);
        return;
      }

      transitioningRef.current = true;
      const curtain = curtainRef.current;
      gsap.set(curtain, { clipPath: "inset(100% 0 0 0)", pointerEvents: "auto" });
      gsap.to(curtain, {
        clipPath: "inset(0% 0 0 0)",
        duration: TRANSITION_IN_MS / 1000,
        ease: EASE_CURTAIN,
        onComplete: () => {
          lenisRef.current?.scrollTo(0, { immediate: true });
          router.push(href);
        },
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router, staticBaseline]);

  // Once the new route has painted behind the closed curtain, sweep out.
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    if (transitioningRef.current && curtainRef.current) {
      gsap.to(curtainRef.current, {
        clipPath: "inset(0 0 100% 0)",
        duration: TRANSITION_OUT_MS / 1000,
        ease: EASE_CURTAIN,
        onComplete: () => {
          transitioningRef.current = false;
          gsap.set(curtainRef.current, { pointerEvents: "none" });
        },
      });
    }

    ScrollTrigger.refresh();
  }, [pathname]);

  return (
    <MotionContext.Provider value={{ lenisRef, curtainRef, curtainEl, staticBaseline }}>
      <div
        ref={(el) => {
          curtainRef.current = el;
          setCurtainEl(el);
        }}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[999] bg-ink"
        style={{ clipPath: "inset(0 0 100% 0)" }}
      />
      {children}
    </MotionContext.Provider>
  );
}
