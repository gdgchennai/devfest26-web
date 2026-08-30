"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { ticketCta, speakerCta } from "@/lib/cta";
import { RollingText } from "@/components/motion/RollingText";
import { GlowButton } from "@/components/GlowButton";
import { uiCopy } from "@/site.config";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Placeholder art — any two images work here; these are just two from
 *  public/archive already in the repo. Swap for the real CDN images later,
 *  nothing else in this file depends on which images these are. */
const IMAGE_LEFT = "/archive/2025-speaker-research-park.jpg";
const IMAGE_RIGHT = "/archive/2025-attend.jpg";

const TITLE_LEFT = uiCopy.showMoodSection.presentTitle;
const BODY_LEFT = uiCopy.showMoodSection.presentBody;
const TITLE_RIGHT = uiCopy.showMoodSection.attendTitle;
const BODY_RIGHT = uiCopy.showMoodSection.attendBody;

/** Both panel CTAs sit on a full-bleed photo, not the flat page backdrop —
 *  size="sm" is the mobile base; these scale it up on wider screens to match
 *  the body copy's own clamp() growth, rather than staying one fixed size
 *  across every viewport. */
const PHOTO_BUTTON_SIZE = "sm:px-7 sm:py-3 sm:text-base lg:px-9 lg:py-4 lg:text-lg";

/** Same source the header/hero/TicketStub all read from — never a hardcoded
 *  href here, for the exact reason lib/cta.ts exists (see there): a "Get
 *  tickets" link that quietly lands somewhere wrong. Computed once at module
 *  scope (plain data derived from config, not client state), same as
 *  HeroCopy.tsx's own copy of this. */
const ticket = ticketCta();
const cfp = speakerCta();

/** Width of the gap between the two panels, in real pixels — not a fraction
 *  of the panel size, so it reads the same regardless of screen size. Baked
 *  directly into each clip-path's own calc() below (each panel's edge sits
 *  GAP_PX to its own side of the seam line, never on it), rather than a
 *  margin/gap on the elements — so this one constant is the only place the
 *  gap can change, and adjusting the seam position/angle below can never
 *  drift it. */
const GAP_PX = 4;

/** Desktop: split left/right along a diagonal seam that runs from
 *  DESKTOP_SEAM_TOP (a % of width) at the top edge to DESKTOP_SEAM_BOTTOM at
 *  the bottom edge. */
const DESKTOP_SEAM_TOP = 60;
const DESKTOP_SEAM_BOTTOM = 40;

/**
 * Builds one `calc(N% ± GAP_PXpx)` seam point. Every clip-path below used to
 * inline this as two `${GAP_PX}px}`-interpolated template literals joined
 * with `+` — Turbopack's production minifier constant-folds that (every
 * value involved is a static module-level number) and, with the same
 * interpolated substring appearing twice in the folded expression, corrupts
 * the merged string: `calc(60% + 4px) 0, 100% 0, 100% 100%, calc(40% + 4px)`
 * shipped as `calc(60% + 4calc(40% + 4px)` in the actual SSR HTML, silently
 * dropping the invalid clip-path (browser falls back to `none`) — dev builds
 * never hit the minifier, so this only ever showed up in prod. Routing every
 * seam point through one function call, rather than repeating the same
 * interpolation inline, sidesteps whatever in the folder's CSE keys off the
 * literal duplicate text.
 */
function seamCalc(pct: number, sign: "+" | "-"): string {
  return `calc(${pct}% ${sign} ${GAP_PX}px)`;
}

const desktopClipLeft = `polygon(0 0, ${seamCalc(DESKTOP_SEAM_TOP, "-")} 0, ${seamCalc(DESKTOP_SEAM_BOTTOM, "-")} 100%, 0 100%)`;
const desktopClipRight = `polygon(${seamCalc(DESKTOP_SEAM_TOP, "+")} 0, 100% 0, 100% 100%, ${seamCalc(DESKTOP_SEAM_BOTTOM, "+")} 100%)`;

/** Narrow: split top/bottom along a diagonal seam that runs from
 *  NARROW_SEAM_LEFT (a % of height) at the left edge to NARROW_SEAM_RIGHT at
 *  the right edge. Averaging to 50 (55/45, not e.g. 60/70) is deliberate —
 *  the top and bottom panels should come out the same size; only 60/70
 *  averaged to 65, leaving the top panel visibly taller than the bottom. */
const NARROW_SEAM_LEFT = 55;
const NARROW_SEAM_RIGHT = 45;
const narrowClipTop = `polygon(0 0, 100% 0, 100% ${seamCalc(NARROW_SEAM_RIGHT, "-")}, 0 ${seamCalc(NARROW_SEAM_LEFT, "-")})`;
const narrowClipBottom = `polygon(0 ${seamCalc(NARROW_SEAM_LEFT, "+")}, 100% ${seamCalc(NARROW_SEAM_RIGHT, "+")}, 100% 100%, 0 100%)`;

/**
 * Both panels' Images fill the WHOLE section (inset-0, same box, same
 * default centred object-cover) and only afterwards get clipped down to
 * their own diagonal sliver — deliberately, on both counts:
 *
 * - Sizing an inner box to just "this panel's share" (an earlier attempt)
 *   broke the diagonal itself: DESKTOP_SEAM_TOP/BOTTOM aren't equal, so
 *   the clip's actual edge is WIDER than their average at one end — a box
 *   sized to the average left a wedge of the clip with no image under it
 *   at all, i.e. a visible notch out of the diagonal, not a clean edge. The
 *   image has to cover the clip's full extent, which means covering the
 *   full section, not some smaller box.
 * - It's also what makes the two panels' crops actually comparable: both
 *   photos now go through the exact same box and the exact same
 *   object-position rule, so neither is more/less zoomed than the other —
 *   the earlier per-panel box sizing gave the (much narrower) right panel's
 *   photo a far more aggressive crop than the left's, which is what read as
 *   asymmetric between the two, independent of the notch bug above.
 */

/** Desktop text safe-width: the narrowest either panel ever gets, over its
 *  WHOLE height, is min(DESKTOP_SEAM_BOTTOM, 100 - DESKTOP_SEAM_TOP) — 40%
 *  here, since the two happen to be equal. A couple of points of margin
 *  below that keeps the text block off the diagonal at every height, not
 *  just the height its own anchor (top or bottom) happens to sit at — was
 *  -6 (34%), which left the body copy wrapping tightly with plenty of
 *  unused photo space still visible past it; -2 gives it noticeably more
 *  room while keeping the same safety margin, just smaller. */
const DESKTOP_TEXT_MAX_WIDTH = Math.min(DESKTOP_SEAM_BOTTOM, 100 - DESKTOP_SEAM_TOP) - 2;
/** Same idea for the narrow (stacked) layout's panels — was a flat 85%. */
const NARROW_TEXT_MAX_WIDTH = "92%";

/** A dark pool under whichever corner the text sits in, so it reads clearly
 *  against busy/light photo content — the per-character drop-shadow on the
 *  text itself (see PanelCopy) helps against small-scale texture but isn't
 *  enough against a bright patch of sky, a screen, stage lighting, etc.
 *  Full-panel-sized (not sized to the text box) so it stays right under the
 *  text regardless of exactly how long the body copy runs, and radial
 *  (not a straight edge-to-edge gradient) so it stays a soft pool in that
 *  one corner rather than darkening a whole straight band across the photo.
 *  Sits between the Image and PanelCopy (z-index 0 vs PanelCopy's 20). */
function TextScrim({ corner }: { corner: "top left" | "bottom right" }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: `radial-gradient(ellipse 75% 65% at ${corner}, rgba(0,0,0,0.75), transparent 65%)` }}
    />
  );
}

/**
 * Title + body, over a photo — always white/drop-shadowed regardless of
 * theme, same reasoning as VenueReveal's own caption (see there): this
 * sits on the photo itself, not the flat --page-bg backdrop, so it needs
 * to read the same however --theme happens to be scrubbed elsewhere on
 * the page right now. `align="top"` renders the title first (so it's the
 * upper element); `align="bottom"` renders it last (so it's the lower
 * one, body above it) — matching "Present"'s title-then-body layout on
 * the left and "Attend"'s body-then-title layout on the right.
 * `maxWidth` is passed as an inline style, not a Tailwind class — a
 * `w-[${n}%]` template string only ever exists at runtime, never as
 * literal text in this file, so Tailwind's static build-time scan would
 * never see it and would emit no CSS for it at all.
 *
 * The text (and the link) stay hidden behind their own masks until the
 * panel's photo has fully flown in, then reveal once, via SplitText's
 * `mask` option (the same per-line/char clipping-span technique
 * VenueReveal's swapText and ExpectShowcase's char-rise both already use
 * elsewhere on the page — see either) — content SLIDES inside a fixed,
 * clipping wrapper rather than fading or flying in unclipped, which is
 * what makes it read as a "reveal" rather than an "entrance". `direction`
 * controls which way that reveal reads: "down" (the left panel) enters
 * each line from below and stages top line first, so it cascades top →
 * bottom; "up" (the right panel) enters each line from above and stages
 * bottom line first, cascading bottom → top — a deliberate mirror, not
 * just the same effect reused. The link gets the same idea on the
 * horizontal axis: "down" slides its button in from the left (reveals
 * left → right), "up" from the right (reveals right → left).
 */
function PanelCopy({
  title,
  body,
  link,
  align,
  anchorClassName,
  maxWidth,
  wrapRef,
  startAt,
  direction,
}: {
  title: string;
  body: string;
  /** "Get tickets" (left) / "← Submit CFP" (right) — see LINK_CLASSES.
   *  Slotted next to the body, on the side furthest from the title: after
   *  it when align="top" (title, body, link), before it when
   *  align="bottom" (link, body, title). */
  link: ReactNode;
  align: "top" | "bottom";
  anchorClassName: string;
  maxWidth: string;
  /** The section's own root — the reveal's ScrollTrigger watches this,
   *  same trigger element the panel's photo fly-in already uses, just a
   *  later point on it (see `startAt`). */
  wrapRef: React.RefObject<HTMLElement | null>;
  /** ScrollTrigger `start` value matching the exact point THIS panel's own
   *  photo fly-in (see ShowMoodSection) finishes — the reveal has nothing
   *  to sit in front of until the image it's captioning has actually
   *  arrived. */
  startAt: string;
  /** "down" for the left/top panel (Present), "up" for the right/bottom
   *  one (Attend) — see the component doc comment above for what each
   *  actually does. */
  direction: "down" | "up";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const linkMaskRef = useRef<HTMLDivElement>(null);
  // Tracks the live split instances across renders — see the defensive
  // revert below for why this needs to survive between effect runs rather
  // than living only as a local const inside the callback.
  const splitsRef = useRef<{ heading: SplitText; body: SplitText } | null>(null);
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  useGSAP(
    () => {
      if (staticBaseline) return;
      if (!headingRef.current || !bodyRef.current || !wrapRef.current) return;

      // Defensive: React (Strict Mode, dev-only) mounts this effect, runs
      // its cleanup, then mounts it again — same DOM nodes both times. The
      // cleanup below reverts the split it created, but if for any reason
      // that hasn't run yet before this fires again, splitting an ALREADY-
      // split, `mask`-wrapped element a second time recurses into its own
      // nested masking spans — the actual cause of a "Maximum call stack
      // size exceeded" crash here. Reverting the PREVIOUS instance (there's
      // no static SplitText.revert(element) — only instance.revert())
      // first makes each run start from plain text regardless of what ran
      // before it.
      splitsRef.current?.heading.revert();
      splitsRef.current?.body.revert();

      // "down" content rises up INTO place (masked from below, matching
      // swapText's own default direction); "up" content drops down into
      // place (masked from above) — the mirror image of that.
      const fromY = direction === "down" ? 100 : -100;
      const headingSplit = SplitText.create(headingRef.current, { type: "lines", mask: "lines" });
      const bodySplit = SplitText.create(bodyRef.current, { type: "lines", mask: "lines" });
      splitsRef.current = { heading: headingSplit, body: bodySplit };
      gsap.set(headingSplit.lines, { yPercent: fromY, opacity: 0 });
      gsap.set(bodySplit.lines, { yPercent: fromY, opacity: 0 });

      const linkButton = linkMaskRef.current?.firstElementChild as HTMLElement | null;
      // The button's own mask wrapper is sized exactly to it (inline-block,
      // overflow-hidden — see the JSX), so sliding the button horizontally
      // inside it reveals rather than just moves it: "down" panels slide
      // the button in from the left (reads left → right), "up" panels from
      // the right (reads right → left).
      if (linkButton) gsap.set(linkButton, { xPercent: direction === "down" ? -100 : 100 });

      const trigger = ScrollTrigger.create({
        trigger: wrapRef.current,
        start: startAt,
        once: true,
        onEnter: () => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.7 } });
          tl.to(headingSplit.lines, { yPercent: 0, opacity: 1, stagger: 0.05 });
          tl.to(
            bodySplit.lines,
            { yPercent: 0, opacity: 1, stagger: { each: 0.05, from: direction === "down" ? "start" : "end" } },
            "<0.15",
          );
          if (linkButton) {
            tl.to(linkButton, { xPercent: 0, duration: 0.5 }, ">-0.25");
            // The mask needs overflow-hidden DURING the slide (that's what
            // makes it a reveal rather than just a move), but left on
            // afterward it permanently clips GlowButton's halo/corner glow,
            // which bleeds past the button's own box. Once the slide lands,
            // there's nothing left to mask, so let the glow show in full.
            tl.set(linkMaskRef.current, { overflow: "visible" });
          }
        },
      });

      return () => {
        trigger.kill();
        headingSplit.revert();
        bodySplit.revert();
      };
    },
    { scope: containerRef, dependencies: [staticBaseline] },
  );

  const heading = (
    // Sized off ITS OWN BOX's width (cqw — container query units, relative
    // to containerRef's content width, see its [container-type:inline-size]
    // below), NOT the viewport (vw). This box is a fraction of the viewport
    // — ~38% on desktop (DESKTOP_TEXT_MAX_WIDTH), ~92% on the narrow/stacked
    // layout (NARROW_TEXT_MAX_WIDTH) — and those two fractions are too
    // different for one vw-based clamp() to fit both: tuned to fit "Attend"
    // on the wide desktop share, the same vw number is far too large for
    // the much narrower mobile share, and vice versa. cqw sidesteps that
    // entirely — 100cqw IS this box's own available width, at whatever
    // breakpoint, so the same clamp() shrinks the word to fit progressively
    // as ITS box narrows, rather than as the viewport does. 21cqw is tuned
    // so "Present" (the longer of the two titles) comfortably fits 100cqw
    // with room to spare, not right up against the edge.
    //
    // whitespace-nowrap stays as a backstop, not the primary fix: "Present"
    // is one word with no break point regardless, and SplitText's `mask`
    // wraps it in an overflow:clip span sized to this element's own box —
    // if that box were ever forced narrower than the word's rendered width
    // for some other reason, nowrap is what keeps the mask sized to the
    // whole word (clipped only by the diagonal further out) instead of
    // hard-clipping mid-word.
    <h3
      ref={headingRef}
      className="whitespace-nowrap text-[clamp(1.5rem,21cqw,6rem)] font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,1)]"
    >
      {title}
    </h3>
  );
  const paragraph = (
    <p
      ref={bodyRef}
      className="text-[clamp(1.1rem,2.4vw,1.75rem)] text-white/85 drop-shadow-[0_1px_12px_rgba(0,0,0,1)]"
    >
      {body}
    </p>
  );
  // inline-block, sized to the button's own content — the mask the link
  // slides inside (see the doc comment above). align-self matches what the
  // link ITSELF actually carries (see cfpLink/ticketLink in ShowMoodSection:
  // self-start + align="top" for CFP, self-end + align="bottom" for tickets)
  // — that class alone has no effect once the link isn't a direct flex child
  // anymore, so it has to live on this wrapper instead for the alignment to
  // still apply.
  //
  // overflow is only "hidden" for the reveal animation itself (staticBaseline
  // false): the button starts positioned off to the side and slides in, and
  // hidden is what turns that into a reveal rather than a floating
  // mispositioned button. Left permanently, it clips GlowButton's halo/corner
  // glow, which bleeds past the button's own box — so the animated case turns
  // it back to visible once the slide lands (see the tl.set() above), and the
  // static-baseline case (no animation runs at all, see the early return
  // above) never turns it hidden in the first place.
  const linkMask = (
    <div
      ref={linkMaskRef}
      className={`inline-block ${staticBaseline ? "overflow-visible" : "overflow-hidden"} ${align === "top" ? "self-start" : "self-end"}`}
    >
      {link}
    </div>
  );
  return (
    <div
      ref={containerRef}
      // w-full (NOT shrink-to-fit, its default as an absolutely-positioned
      // box with only left/top/max-width set) is load-bearing together
      // with [container-type:inline-size]: cqw units inside this box
      // resolve against ITS width, but shrink-to-fit content ALSO resolves
      // against its children's rendered width — a circular dependency the
      // instant a child sizes itself in cqw. w-full breaks the cycle by
      // resolving this box's width from its own (definite-sized, absolute
      // inset-0) parent instead, capped at maxWidth same as before.
      className={`absolute z-20 flex w-full flex-col gap-4 p-6 sm:p-10 [container-type:inline-size] ${anchorClassName}`}
      style={{ maxWidth }}
    >
      {align === "top" ? (
        <>
          {heading}
          {paragraph}
          {linkMask}
        </>
      ) : (
        <>
          {linkMask}
          {paragraph}
          {heading}
        </>
      )}
    </div>
  );
}

/**
 * "Show mood" — follows MoodSection. Two full-bleed photos, diagonally
 * clipped: side by side on wide screens, stacked on narrow ones (same two
 * elements each breakpoint, just a different clip-path — see
 * desktopClip and narrowClip constants above). On scroll into view, the first panel
 * flies in from off-screen left and the second from off-screen right,
 * scroll-scrubbed rather than autoplayed, so the entrance is tied directly
 * to scroll position. Placeholder images for now (see IMAGE_LEFT/RIGHT);
 * text overlay and its own animation land once these are confirmed.
 *
 * Under reduced-motion / lite: both panels sit in their settled (x: 0)
 * position immediately, no scroll-tied motion — see staticBaseline below.
 */
export function ShowMoodSection() {
  const wrapRef = useRef<HTMLElement>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  // self-end (not self-start) and a leading arrow — right-aligned within the
  // left panel, by request, rather than matching the panel's own
  // left-aligned title/body.
  const ticketLink = (
    <GlowButton
      href={ticket.href}
      className="self-end"
      size="sm"
      textClassName="text-white"
      surfaceClassName={PHOTO_BUTTON_SIZE}
    >
      <RollingText>{uiCopy.showMoodSection.ticketLinkLabel}</RollingText>
    </GlowButton>
  );

  // speakerCta() always points at Sessionize, in a new tab — see lib/cta.ts.
  // self-start and a trailing arrow — left-aligned within the right panel,
  // by request, rather than matching the panel's own right-aligned
  // title/body.
  const cfpLink = (
    <GlowButton
      href={cfp.href}
      target="_blank"
      rel="noreferrer"
      className="self-start"
      size="sm"
      textClassName="text-white"
      surfaceClassName={PHOTO_BUTTON_SIZE}
    >
      <RollingText>{uiCopy.showMoodSection.cfpLinkLabel}</RollingText>
    </GlowButton>
  );

  useGSAP(
    () => {
      const [desktopLeft, narrowTop] = leftRefs.current;
      const [desktopRight, narrowBottom] = rightRefs.current;
      if (staticBaseline || !wrapRef.current) return;

      // Desktop: the two panels are already side by side onscreen the
      // moment the section starts entering, so they fly in AS it enters —
      // starting the instant the section's top crosses the bottom of the
      // viewport, done by the time it reaches vertical centre.
      if (desktopLeft && desktopRight) {
        gsap.set([desktopLeft, desktopRight], { xPercent: (i) => (i === 0 ? -100 : 100) });
        gsap.to(desktopLeft, {
          xPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: wrapRef.current, start: "top bottom", end: "top center", scrub: true },
        });
        gsap.to(desktopRight, {
          xPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: wrapRef.current, start: "top bottom", end: "top center", scrub: true },
        });
      }

      // Narrow: the section is exactly one viewport tall (h-dvh) and never
      // pinned, so "fully in view" (top top) isn't a held range to animate
      // across — it's a single instant, and the section starts EXITING
      // immediately after it. An earlier version started the scrub AT that
      // instant and ran it onward to "center top", which sounds like "after
      // arrival" but is actually entirely during the exit — the section is
      // already sliding back out the whole time it plays, which is why it
      // only finished right as the section was leaving. This instead ends
      // AT "top top" (so it's done, not still leaving, by the point the
      // section is fully in view) and starts a little before it ("top 20%"
      // — the section already ~80% entered), so the fly-in plays out during
      // the last stretch of entry rather than the very start of it, without
      // ever bleeding into the exit half.
      if (narrowTop && narrowBottom) {
        gsap.set([narrowTop, narrowBottom], { xPercent: (i) => (i === 0 ? -100 : 100) });
        gsap.to(narrowTop, {
          xPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: wrapRef.current, start: "top 50%", end: "top top", scrub: true },
        });
        gsap.to(narrowBottom, {
          xPercent: 0,
          ease: "none",
          scrollTrigger: { trigger: wrapRef.current, start: "top 20%", end: "top top", scrub: true },
        });
      }
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  return (
    <>
      {/* Lite/reduced-motion loses MoodSection above (the scroll-scrubbed
          "What's your DevFest mood?" marquee doesn't have a static form worth
          rendering — see there), which otherwise leaves this section's two
          panels with no lead-in. Static baseline only: full motion still gets
          that line from MoodSection itself. */}
      {staticBaseline && (
        <h2 className="px-6 pb-8 pt-16 text-left text-paper text-[clamp(2rem,8vw,6rem)] font-bold leading-none tracking-tight sm:px-10">
          {uiCopy.moodSection.heading}
        </h2>
      )}
      <section ref={wrapRef} className="relative h-dvh overflow-hidden">
        {/* Desktop: left/right panels. Hidden below sm, where the top/bottom
          pair takes over instead. */}
      <div
        ref={(el) => {
          leftRefs.current[0] = el;
        }}
        className="absolute inset-0 hidden sm:block"
        style={{ clipPath: desktopClipLeft }}
      >
        <Image src={IMAGE_LEFT} alt="" fill priority={false} className="object-cover" />
        <TextScrim corner="top left" />
        <PanelCopy
          title={TITLE_LEFT}
          body={BODY_LEFT}
          link={cfpLink}
          align="top"
          anchorClassName="left-0 top-0"
          maxWidth={`${DESKTOP_TEXT_MAX_WIDTH}%`}
          wrapRef={wrapRef}
          startAt="top center"
          direction="down"
        />
      </div>
      <div
        ref={(el) => {
          rightRefs.current[0] = el;
        }}
        className="absolute inset-0 hidden sm:block"
        style={{ clipPath: desktopClipRight }}
      >
        <Image src={IMAGE_RIGHT} alt="" fill priority={false} className="object-cover" />
        <TextScrim corner="bottom right" />
        <PanelCopy
          title={TITLE_RIGHT}
          body={BODY_RIGHT}
          link={ticketLink}
          align="bottom"
          anchorClassName="bottom-0 right-0 items-end text-right"
          maxWidth={`${DESKTOP_TEXT_MAX_WIDTH}%`}
          wrapRef={wrapRef}
          startAt="top center"
          direction="up"
        />
      </div>

      {/* Narrow: top/bottom panels. Hidden at sm and up. */}
      <div
        ref={(el) => {
          leftRefs.current[1] = el;
        }}
        className="absolute inset-0 block sm:hidden"
        style={{ clipPath: narrowClipTop }}
      >
        <Image src={IMAGE_LEFT} alt="" fill priority={false} className="object-cover" />
        <TextScrim corner="top left" />
        <PanelCopy
          title={TITLE_LEFT}
          body={BODY_LEFT}
          link={cfpLink}
          align="top"
          anchorClassName="left-0 top-0"
          maxWidth={NARROW_TEXT_MAX_WIDTH}
          wrapRef={wrapRef}
          startAt="top top"
          direction="down"
        />
      </div>
      <div
        ref={(el) => {
          rightRefs.current[1] = el;
        }}
        className="absolute inset-0 block sm:hidden"
        style={{ clipPath: narrowClipBottom }}
      >
        <Image src={IMAGE_RIGHT} alt="" fill priority={false} className="object-cover" />
        <TextScrim corner="bottom right" />
        <PanelCopy
          title={TITLE_RIGHT}
          body={BODY_RIGHT}
          link={ticketLink}
          align="bottom"
          anchorClassName="bottom-0 right-0 items-end text-right"
          maxWidth={NARROW_TEXT_MAX_WIDTH}
          wrapRef={wrapRef}
          startAt="top top"
          direction="up"
        />
      </div>
      </section>
    </>
  );
}
