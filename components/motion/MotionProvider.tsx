"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { isLiteMode, shouldUseStaticBaseline, subscribeLiteModeChange } from "@/lib/motion-prefs";
import { hasHardwareGpu } from "@/lib/gpu";
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

// Exported so other fixed overlays that need to disappear behind the curtain
// rather than compete with it visually (the hamburger menu's full-screen
// panel) can time their own reset to land exactly when the curtain has
// finished covering the screen.
export const TRANSITION_IN_MS = 500;
const TRANSITION_OUT_MS = 600;

/**
 * The CSS custom properties homepage sections scrub directly onto <html>
 * via gsap.quickSetter as the visitor scrolls (VenueReveal's --theme,
 * --page-bg, --brackets-opacity; MoodSection's own --theme write). quickSetter
 * writes bypass GSAP's tween tracking, so killing/reverting the ScrollTrigger
 * that owns one (which happens automatically when its component unmounts —
 * i.e. any route change away from the page it's on) does NOT undo the value
 * already written; it's just left on <html> as an inline style, overriding
 * the CSS defaults for every page after it, until something removes it.
 * removeProperty (not a hardcoded value) so each falls back to its real
 * :root default (--theme: 0, --page-bg: var(--ink), --brackets-opacity: 1).
 */
function resetScrubbedTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--theme");
  root.style.removeProperty("--page-bg");
  root.style.removeProperty("--brackets-opacity");
}

/**
 * Everything this file used to export directly as `MotionProvider`. Every
 * effect and `useClientValue` read below is written assuming the preference
 * it reads (`shouldUseStaticBaseline`, chiefly) is decided once on mount and
 * never changes for the life of this component instance — true again now
 * that `LiteToggle` no longer reloads the page, because `MotionProvider`
 * below gives this a fresh `key` (and therefore a fresh mount) on every
 * toggle instead. Nothing in this component needed to change for that.
 */
function MotionProviderInner({ children }: { children: React.ReactNode }) {
  const [curtainEl, setCurtainEl] = useState<HTMLDivElement | null>(null);
  const staticBaseline = useClientValue(shouldUseStaticBaseline, false);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const router = useRouter();
  const transitioningRef = useRef(false);
  // Set only by the link-click handler below, i.e. only on a FORWARD navigation.
  // Browser back/forward never goes through that handler, so it never sets this
  // — which is how those keep their restored scroll position while every link
  // click lands at the top of its destination. Consumed (and cleared) by the
  // per-pathname effect once the new route has rendered.
  const scrollResetPendingRef = useRef(false);

  // Promote GSAP tweens to compositor layers (translate3d) only when a
  // hardware GPU is actually driving them. Software GL pays extra for those
  // layers; html.gpu gates CSS will-change the same way (see globals.css).
  useEffect(() => {
    const gpu = hasHardwareGpu();
    document.documentElement.classList.toggle("gpu", gpu);
    gsap.config({ force3D: gpu });
    return () => {
      document.documentElement.classList.remove("gpu");
      gsap.config({ force3D: "auto" });
    };
  }, []);

  // One Lenis instance for the whole site, created here and kept alive
  // across route changes (root layout never remounts on navigation).
  useEffect(() => {
    // Land at the top on a fresh load or refresh, but NOT when the visitor
    // arrived via back/forward — there, returning them to where they were is
    // the whole point, so the browser's restoration is left alone.
    const navType = (
      performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    )?.type;
    const isHistoryNav = navType === "back_forward";

    // Opting out of native restoration is only needed to win the race against
    // the browser's own (sometimes post-hydration) restore on refresh. It is
    // handed straight back afterwards: leaving it "manual" for the session was
    // what made in-session back/forward forget its position on every route.
    let handBack = 0;
    if (!isHistoryNav && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
      handBack = window.setTimeout(() => {
        history.scrollRestoration = "auto";
      }, 1000);
    }
    if (!isHistoryNav) window.scrollTo(0, 0);

    /*
     * Smooth scrolling IS motion, and this used to run for everyone — so a
     * visitor with `prefers-reduced-motion: reduce` still got momentum
     * smoothing on every wheel tick, plus the knock-on effects: PageDown and
     * arrow keys glide instead of jumping, and find-in-page/anchor jumps land
     * somewhere other than where the browser put them. Reduced motion and lite
     * both get the browser's own scroll instead.
     *
     * ScrollTrigger needs no replacement wiring for it. The `instance.on
     * ("scroll", ScrollTrigger.update)` line below exists only because Lenis
     * takes the scroll over; left alone, ScrollTrigger listens to native scroll
     * events itself. `lagSmoothing(0)` is skipped for the same reason — it is
     * there to keep Lenis and the ticker in step, and the default is the better
     * behaviour without it.
     *
     * Read straight from the preference rather than from the `staticBaseline`
     * render value on purpose: that value is the SSR default on the hydration
     * pass and only settles a render later, which would build and immediately
     * destroy a Lenis instance for every lite visitor. It cannot change without
     * a reload, so reading it once here is safe.
     */
    if (shouldUseStaticBaseline()) {
      return () => {
        window.clearTimeout(handBack);
        if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      };
    }

    let cancelled = false;
    let instance: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;
    let onRefresh: (() => void) | null = null;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      instance = new Lenis({ autoRaf: false });
      if (!isHistoryNav) instance.scrollTo(0, { immediate: true, force: true });
      tick = (time: number) => instance!.raf(time * 1000);
      instance.on("scroll", ScrollTrigger.update);
      // The other half of the integration, and it was missing: Lenis measures
      // its own scroll limit (document height) once and caches it, and the
      // homepage's pinned sections (VenueReveal, MoodSection, ExpectShowcase)
      // each insert a pin-spacer — hundreds to thousands of px of NEW document
      // height — dynamically, well after Lenis's first measurement. Without
      // this, Lenis's cached limit goes stale the moment a spacer grows the
      // page past it: it clamps scrolling to the stale (shorter) limit and
      // stops responding to wheel/touch input, while the DOM's real
      // scrollHeight is already taller — reading as "scrolling just stops
      // working" partway down the page, worse the more pinned content
      // precedes the stuck point. `refresh` fires on every ScrollTrigger
      // recalculation (including each pin's own creation), so this keeps
      // Lenis's limit in step continuously rather than once at load.
      onRefresh = () => instance?.resize();
      ScrollTrigger.addEventListener("refresh", onRefresh);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenisRef.current = instance;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(handBack);
      if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      if (onRefresh) ScrollTrigger.removeEventListener("refresh", onRefresh);
      if (tick) gsap.ticker.remove(tick);
      instance?.destroy();
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
      // A link click is a forward navigation — its destination opens at the top.
      // The actual reset runs in the per-pathname effect below, after the new
      // route has rendered and just before ScrollTrigger.refresh() (which would
      // otherwise save/restore the stale position from the page just left).
      scrollResetPendingRef.current = true;

      if (transitioningRef.current || !curtainRef.current) {
        resetScrubbedTheme();
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
          lenisRef.current?.scrollTo(0, { immediate: true, force: true });
          // The screen is now fully covered, so this is the point to reset
          // the CSS custom properties VenueReveal/MoodSection scrub directly
          // onto <html> as the visitor scrolls (--theme, --page-bg,
          // --brackets-opacity — see resetScrubbedTheme). Those are
          // gsap.quickSetter writes, not tweens, so nothing about a
          // ScrollTrigger dying on unmount ever puts them back — leave a
          // visitor mid-scroll through the pastel-blue Location section,
          // click a menu link, and the new page inherited that blue
          // permanently (until a hard refresh reset the inline styles).
          resetScrubbedTheme();
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

    // Fallback for route changes the click handler above never saw — browser
    // back/forward chiefly. No curtain to hide behind there, but this still
    // needs to run: a stuck --theme/--page-bg from the page just left is
    // wrong for the one just arrived at regardless of how the visitor got
    // there. Harmless if onClick's own call already handled it.
    resetScrubbedTheme();

    // Land forward navigations at the top, now that the destination route has
    // actually rendered. Must happen before ScrollTrigger.refresh() below:
    // refresh() records the current scroll, recalculates, then restores it, so
    // a stale position left over from the page just left would be baked in
    // (reading as "opens halfway down the page"). Back/forward never set the
    // flag, so their restored position is left untouched.
    if (scrollResetPendingRef.current) {
      scrollResetPendingRef.current = false;
      if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    }

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
        // Literal black, not bg-ink: --ink is theme-driven and interpolates
        // toward white as VenueReveal scrubs --theme through the pastel-blue
        // Location section (see resetScrubbedTheme below) — a curtain tied
        // to it would itself draw light there instead of covering the page
        // in black.
        className="pointer-events-none fixed inset-0 z-[999] bg-black"
        style={{ clipPath: "inset(0 0 100% 0)" }}
      />
      {children}
    </MotionContext.Provider>
  );
}

/**
 * Keys `MotionProviderInner` (and therefore its whole subtree — Header,
 * HamburgerMenu, every page, Footer, ScrollCueController; see app/layout.tsx)
 * on the lite preference, so a `LiteToggle` flip tears the entire motion
 * layer down and remounts it fresh, same clean slate a page reload used to
 * give it (new Lenis instance, new ScrollTriggers, new WebGL scenes, every
 * `useClientValue` read re-evaluated) — without an actual navigation. See
 * `subscribeLiteModeChange`'s own doc comment for why this is the one place
 * that needed to change rather than every individual consumer.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const lite = useSyncExternalStore(subscribeLiteModeChange, isLiteMode, () => false);
  return <MotionProviderInner key={lite ? "lite" : "full"}>{children}</MotionProviderInner>;
}
