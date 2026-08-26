"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { navRoutes } from "@/lib/routes";
import { speakerCta } from "@/lib/cta";
import { uiCopy } from "@/site.config";
import { RollingText } from "@/components/motion/RollingText";
import { TRANSITION_IN_MS } from "@/components/motion/MotionProvider";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";

gsap.registerPlugin(useGSAP);

/** Picked by eye with the (since removed) live Y-offset adjuster. */
const TOP = 28;

/**
 * Full-mode navigation. Replaces the old always-visible pill bar (still used
 * in lite mode — see components/Header.tsx) with a glow button that morphs
 * into a cross and opens a full-screen panel that grows out of the button
 * itself — a `clip-path: circle()` expanding from the button's centre to a
 * radius that reaches the farthest corner of the viewport, recomputed on
 * every open/close so it tracks the button regardless of screen size. Once
 * the circle has fully covered the screen, the links push in left-to-right.
 *
 * Which nav renders is decided purely by CSS (`.nav-hamburger-only`, gated on
 * `html.lite`, set pre-paint) — see app/globals.css — so there's no
 * hydration flash and no JS branch needed here for that part.
 *
 * z-50 on the button, z-45 on the panel: both above page content (z-40, the
 * ScrollCue buttons — the panel needs to clear that explicitly, since
 * ScrollCueController mounts after <main> in layout.tsx and would otherwise
 * paint over an open panel at the same z-40) and below both the boot
 * preloader (z-995) and <Loader> (z-1000) and the hallway flythrough (z-500
 * in HeroSection/MemoriesHallway) — the button is meant to disappear under
 * all three, not fight them for a corner.
 */
export function HamburgerMenu() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLSpanElement>(null);
  const barBottomRef = useRef<HTMLSpanElement>(null);

  const { contextSafe } = useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-menu-item]", panel);
      // Starting state lives here (not in CSS) so it only ever applies once
      // GSAP has taken over — the Tailwind `invisible opacity-0` classes on
      // the panel are what prevent the pre-JS/SSR flash.
      gsap.set(panel, { autoAlpha: 0, clipPath: "circle(0px at 0px 0px)" });
      gsap.set(items, { x: -48, autoAlpha: 0 });
    },
    { scope: panelRef },
  );

  // Distance from `origin` to the farthest corner of the viewport — the
  // radius the circle needs to fully cover the screen no matter where the
  // button sits.
  function coverRadius(originX: number, originY: number) {
    const dx = Math.max(originX, window.innerWidth - originX);
    const dy = Math.max(originY, window.innerHeight - originY);
    return Math.hypot(dx, dy);
  }

  function buttonOrigin() {
    const rect = buttonRef.current!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  const openMenu = contextSafe(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { x, y } = buttonOrigin();
    const radius = coverRadius(x, y);
    const items = gsap.utils.toArray<HTMLElement>("[data-menu-item]", panel);
    const reduced = shouldUseStaticBaseline();

    gsap.set(panel, { autoAlpha: 1, clipPath: `circle(0px at ${x}px ${y}px)` });
    gsap.set(items, { x: -48, autoAlpha: 0 });

    const tl = gsap.timeline();
    tl.to(barTopRef.current, { rotate: 45, y: 6, duration: 0.3, ease: "power2.inOut" }, 0)
      .to(barBottomRef.current, { rotate: -45, y: -6, duration: 0.3, ease: "power2.inOut" }, 0)
      .to(
        panel,
        {
          clipPath: `circle(${radius}px at ${x}px ${y}px)`,
          duration: reduced ? 0 : 0.7,
          ease: "power3.inOut",
        },
        0,
      )
      // Items only start pushing in once the circle has (nearly) covered the
      // screen — "show menu items after the menu screen fully loads".
      .to(
        items,
        { x: 0, autoAlpha: 1, duration: reduced ? 0 : 0.5, ease: "power3.out", stagger: reduced ? 0 : 0.08 },
        reduced ? 0 : 0.55,
      );
  });

  const closeMenu = contextSafe(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { x, y } = buttonOrigin();
    const items = gsap.utils.toArray<HTMLElement>("[data-menu-item]", panel);
    const reduced = shouldUseStaticBaseline();

    const tl = gsap.timeline({ onComplete: () => gsap.set(panel, { autoAlpha: 0 }) });
    tl.to(barTopRef.current, { rotate: 0, y: 0, duration: 0.3, ease: "power2.inOut" }, 0)
      .to(barBottomRef.current, { rotate: 0, y: 0, duration: 0.3, ease: "power2.inOut" }, 0)
      .to(
        items,
        { x: -48, autoAlpha: 0, duration: reduced ? 0 : 0.3, ease: "power2.in", stagger: reduced ? 0 : 0.04 },
        0,
      )
      .to(
        panel,
        { clipPath: `circle(0px at ${x}px ${y}px)`, duration: reduced ? 0 : 0.5, ease: "power3.inOut" },
        reduced ? 0 : 0.2,
      );
  });

  const toggle = contextSafe(() => {
    setOpen((value) => {
      const next = !value;
      if (next) openMenu();
      else closeMenu();
      return next;
    });
  });

  const close = contextSafe(() => {
    setOpen(false);
    closeMenu();
  });

  // Snaps the menu shut with no animation — reset, not a transition, because
  // the moment this runs the screen is already fully covered by
  // MotionProvider's route-transition curtain (app/../MotionProvider.tsx), so
  // there's nothing visible for an animation to do.
  const closeInstant = contextSafe(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const items = gsap.utils.toArray<HTMLElement>("[data-menu-item]", panel);
    gsap.set(panel, { autoAlpha: 0, clipPath: "circle(0px at 0px 0px)" });
    gsap.set(items, { x: -48, autoAlpha: 0 });
    gsap.set([barTopRef.current, barBottomRef.current], { rotate: 0, y: 0 });
    setOpen(false);
  });

  // For internal nav clicks, let the curtain be the thing that visually
  // hides the menu — it draws in OVER the still-open panel — rather than the
  // panel vanishing on its own a beat before the curtain even appears. It's
  // reset only once the curtain has fully covered the screen, timed off the
  // same TRANSITION_IN_MS the curtain itself sweeps on, so by the time it
  // sweeps back out the menu is already gone and the new page is what's
  // revealed underneath.
  //
  // This has to run in the CAPTURE phase (not `close` on <Link>'s onClick,
  // a bubble-phase React handler): MotionProvider's curtain listens on
  // `document` in the capture phase and calls stopPropagation() before any
  // bubble-phase handler runs, so relying on onClick alone left the panel
  // open with no close ever firing. Effects run child-before-parent, and
  // HamburgerMenu is a child of MotionProvider, so this listener attaches
  // (and therefore runs) first on the same document target.
  useEffect(() => {
    function onClickCapture(event: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target as HTMLElement | null;
      if (!target || !panel.contains(target)) return;
      const anchor = target.closest("a");
      const href = anchor?.getAttribute("href");
      // Same "will the curtain intercept this?" check MotionProvider itself
      // uses — an external link (Get tickets, Submit CFP's Sessionize form)
      // isn't touched by the curtain, so it keeps the normal animated
      // `close` from its own onClick instead.
      if (href && href.startsWith("/") && !href.startsWith("//") && anchor?.target !== "_blank") {
        window.setTimeout(closeInstant, TRANSITION_IN_MS);
      }
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Belt-and-suspenders: the capture listener above handles the normal case,
  // but closing instantly on the route actually changing means the menu
  // can't get stuck open after a navigation no matter how it was triggered.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (open) closeInstant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const speaker = speakerCta();

  return (
    <div className="nav-hamburger-only">
      {/* Floating "back to home" — only away from "/", where there's
          otherwise no quick way back except the Home entry buried inside the
          menu panel. Mirrors the hamburger's own positioning/z-index on the
          opposite corner. */}
      {!isHome && (
        <div
          className="pointer-events-none fixed left-4 z-50 sm:left-8"
          style={{ top: `${TOP}px` }}
        >
          <Link
            href="/"
            aria-label={uiCopy.hamburgerMenu.homeAriaLabel}
            className="glow-btn pointer-events-auto h-11 w-11 rounded-2xl"
            data-shape="box"
          >
            <span className="glow-btn__corners" aria-hidden="true" />
            <span className="glow-btn__surface flex h-11 w-11 items-center justify-center rounded-2xl">
              <span className="glow-btn__label">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                  <path
                    d="M4 11.5 12 4l8 7.5M6 9.5V20h5v-6h2v6h5V9.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </Link>
        </div>
      )}

      <div
        className="pointer-events-none fixed right-4 z-50 sm:right-8"
        style={{ top: `${TOP}px` }}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? uiCopy.hamburgerMenu.closeAriaLabel : uiCopy.hamburgerMenu.openAriaLabel}
          onClick={toggle}
          className="glow-btn pointer-events-auto h-11 w-11 rounded-2xl"
          data-shape="box"
        >
          <span className="glow-btn__corners" aria-hidden="true" />
          <span className="glow-btn__surface flex h-11 w-11 items-center justify-center rounded-2xl">
            <span className="glow-btn__label relative block h-3.5 w-5">
              <span
                ref={barTopRef}
                className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-paper"
              />
              <span
                ref={barBottomRef}
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-paper"
              />
            </span>
          </span>
        </button>
      </div>

      {/*
       * Full-screen: a clip-path circle grown from the button's centre (see
       * openMenu/closeMenu) rather than a corner-anchored card, so it reads
       * as the button itself expanding to cover the page. Same background at
       * every size now that it's always full-bleed.
       */}
      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label={uiCopy.hamburgerMenu.panelAriaLabel}
        aria-hidden={!open}
        ref={panelRef}
        className="invisible fixed inset-0 z-[45] flex flex-col items-center justify-center gap-8 bg-ink/75 px-6 text-3xl opacity-0 backdrop-blur-md sm:text-5xl"
      >
        {navRoutes
          .filter((route) => route.href !== "/")
          .map((route) => (
            <div key={route.href} data-menu-item>
              <Link href={route.href} onClick={close} className="text-paper/90 hover:text-paper">
                <RollingText>{route.label}</RollingText> →
              </Link>
            </div>
          ))}
        <div data-menu-item>
          <a
            href={speaker.href}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="text-paper/90 hover:text-paper"
          >
            <RollingText>{uiCopy.hamburgerMenu.cfpLabel}</RollingText> →
          </a>
        </div>
      </div>
    </div>
  );
}
