"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { ticketCta, speakerCta } from "@/lib/cta";
import { RollingText } from "@/components/motion/RollingText";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Placeholder art — any two images work here; these are just two from
 *  public/archive already in the repo. Swap for the real CDN images later,
 *  nothing else in this file depends on which images these are. */
const IMAGE_LEFT = "/archive/2024-opening-stage.jpg";
const IMAGE_RIGHT = "/archive/2025-full-house.jpg";

const TITLE_LEFT = "Present";
const BODY_LEFT =
  "Got crazy ideas or you built something so cool. Vibe coding? Hard core engineering? Stunning Design? Leadership guides? Bring your main character energy to our stage. Share your wisdom with our vibrant community!";
const TITLE_RIGHT = "Attend";
const BODY_RIGHT =
  "Join in for the premier DevFest experience. Meet like minded folks. Developer? PM? Designer? Product? Marketing? Management? Student? Find your tribe here! We provide you the space and technology. You build for and build with the community!";

/** Same source the header/hero/TicketStub all read from — never a hardcoded
 *  href here, for the exact reason lib/cta.ts exists (see there): a "Get
 *  tickets" link that quietly lands somewere wrong while ticketing.url is
 *  still null. Computed once at module scope (plain data derived from
 *  config, not client state), same as HeroCopy.tsx's own copy of this. */
const ticket = ticketCta();
const cfp = speakerCta();

/** Same rolling-hover treatment as VenueReveal's "Get directions →" / the
 *  Hero's "See Agenda →", but as a solid pill button rather than plain text —
 *  same shape/sizing as the site's one shared <Button> (rounded-full), but
 *  built by hand here rather than reusing that component: Button doesn't
 *  support RollingText, a fluid clamp() size matched to this section's body
 *  copy, or a caller-supplied bg colour (only its own fixed
 *  primary/secondary variants), all of which this needs. Text is ink, not
 *  white/paper, on both colours — same reasoning as Button's own primary
 *  variant (see there): ink-on-blue is 5.89:1, paper-on-blue is 3.56:1, and
 *  this text is well under the 18px/bold size where 3:1 would be enough.
 *  Text size matches the body copy's own clamp() exactly, not a separate
 *  fixed step, so the two read as the same voice.
 *
 *  Deliberately does NOT include self-start/self-end or the colour here —
 *  those differ per instance (self-end + bg-green for the left/ticket link,
 *  self-start + bg-blue for the right/CFP one — see each call site) and a
 *  `self-*` baked into this SHARED constant is exactly what previously made
 *  the CFP link ignore its own panel's right-alignment: `self-*` always
 *  wins over a parent's `items-end`, so setting it here for one link set it
 *  for both. */
const LINK_CLASSES =
  "inline-flex items-center gap-1.5 skew-y-[0deg] sm:skew-x-[-25deg] sm:skew-y-0 px-6 py-3 text-[clamp(1.1rem,2.4vw,1.75rem)] font-medium text-ink no-underline transition-opacity hover:opacity-90";

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
const desktopClipLeft =
  `polygon(0 0, calc(${DESKTOP_SEAM_TOP}% - ${GAP_PX}px) 0, ` +
  `calc(${DESKTOP_SEAM_BOTTOM}% - ${GAP_PX}px) 100%, 0 100%)`;
const desktopClipRight =
  `polygon(calc(${DESKTOP_SEAM_TOP}% + ${GAP_PX}px) 0, 100% 0, 100% 100%, ` +
  `calc(${DESKTOP_SEAM_BOTTOM}% + ${GAP_PX}px) 100%)`;

/** Narrow: split top/bottom along a diagonal seam that runs from
 *  NARROW_SEAM_LEFT (a % of height) at the left edge to NARROW_SEAM_RIGHT at
 *  the right edge. Averaging to 50 (55/45, not e.g. 60/70) is deliberate —
 *  the top and bottom panels should come out the same size; only 60/70
 *  averaged to 65, leaving the top panel visibly taller than the bottom. */
const NARROW_SEAM_LEFT = 55;
const NARROW_SEAM_RIGHT = 45;
const narrowClipTop =
  `polygon(0 0, 100% 0, 100% calc(${NARROW_SEAM_RIGHT}% - ${GAP_PX}px), ` +
  `0 calc(${NARROW_SEAM_LEFT}% - ${GAP_PX}px))`;
const narrowClipBottom =
  `polygon(0 calc(${NARROW_SEAM_LEFT}% + ${GAP_PX}px), 100% calc(${NARROW_SEAM_RIGHT}% + ${GAP_PX}px), ` +
  `100% 100%, 0 100%)`;

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
 *  here, since the two happen to be equal. A few points of margin below
 *  that keeps the text block off the diagonal at every height, not just
 *  the height its own anchor (top or bottom) happens to sit at. */
const DESKTOP_TEXT_MAX_WIDTH = Math.min(DESKTOP_SEAM_BOTTOM, 100 - DESKTOP_SEAM_TOP) - 6;

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

/** Title + body, over a photo — always white/drop-shadowed regardless of
 *  theme, same reasoning as VenueReveal's own caption (see there): this
 *  sits on the photo itself, not the flat --page-bg backdrop, so it needs
 *  to read the same however --theme happens to be scrubbed elsewhere on
 *  the page right now. `align="top"` renders the title first (so it's the
 *  upper element); `align="bottom"` renders it last (so it's the lower
 *  one, body above it) — matching "Present"'s title-then-body layout on
 *  the left and "Attend"'s body-then-title layout on the right.
 *  `maxWidth` is passed as an inline style, not a Tailwind class — a
 *  `w-[${n}%]` template string only ever exists at runtime, never as
 *  literal text in this file, so Tailwind's static build-time scan would
 *  never see it and would emit no CSS for it at all. */
function PanelCopy({
  title,
  body,
  link,
  align,
  anchorClassName,
  maxWidth,
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
}) {
  const heading = (
    // Fluid (vw-driven), not a fixed Tailwind step — same reason
    // MoodSection/ExpectShowcase both size their own big display headings
    // this way (see either): a fixed size that's big enough to look right
    // on desktop is, at the same literal px value, wider than the entire
    // mobile viewport for a single unbreakable word like "Attend" — it
    // doesn't wrap (nothing TO wrap on one word), it just overflows the
    // panel and gets sliced by the diagonal clip-path. clamp()'s middle
    // (vw) term scales continuously with viewport width so it can be this
    // large on desktop while still fitting a narrow phone, with the outer
    // two values as hard floor/ceiling.
    <h3 className="text-[clamp(3rem,13vw,7.5rem)] font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,1)]">
      {title}
    </h3>
  );
  const paragraph = (
    <p className="text-[clamp(1.1rem,2.4vw,1.75rem)] text-white/85 drop-shadow-[0_1px_12px_rgba(0,0,0,1)]">{body}</p>
  );
  return (
    <div className={`absolute z-20 flex flex-col gap-4 p-6 sm:p-10 ${anchorClassName}`} style={{ maxWidth }}>
      {align === "top" ? (
        <>
          {heading}
          {paragraph}
          {link}
        </>
      ) : (
        <>
          {link}
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

  // Only rendered when there's actually somewhere to send someone — same
  // rule CurvedMarqueeHero's own "Get tickets →" follows (see there): while
  // ticketing.url is null there's nothing to link to, so this omits the
  // link entirely rather than pointing it at the wrong place. self-end (not
  // self-start) and a leading arrow — right-aligned within the left panel,
  // by request, rather than matching the panel's own left-aligned title/body.
  const ticketLink = ticket.available ? (
    ticket.external ? (
      <a href={ticket.href} target="_blank" rel="noreferrer" className={`${LINK_CLASSES} self-end bg-green`}>
        <RollingText className="skew-y-[0deg] sm:skew-x-[25deg] sm:skew-y-0">← Get tickets</RollingText>
      </a>
    ) : (
      <Link href={ticket.href} className={`${LINK_CLASSES} self-end bg-green`}>
        <RollingText className="skew-y-[0deg] sm:skew-x-[25deg] sm:skew-y-0">← Get tickets</RollingText>
      </Link>
    )
  ) : null;

  // speakerCta() is always "available" (it falls back to the site's own
  // /cfp route when no external form URL is set — see lib/cta.ts), so
  // unlike the ticket link this one always renders. self-start and a
  // trailing arrow — left-aligned within the right panel, by request,
  // rather than matching the panel's own right-aligned title/body.
  const cfpHref = cfp.available ? cfp.href : "/cfp";
  const cfpExternal = cfp.available && cfp.external;
  const cfpLink = cfpExternal ? (
    <a href={cfpHref} target="_blank" rel="noreferrer" className={`${LINK_CLASSES} self-start bg-blue`}>
      <RollingText className="skew-y-[0deg] sm:skew-x-[25deg] sm:skew-y-0">Submit CFP →</RollingText>
    </a>
  ) : (
    <Link href={cfpHref} className={`${LINK_CLASSES} self-start bg-blue`}>
      <RollingText className="skew-y-[0deg] sm:skew-x-[25deg] sm:skew-y-0">Submit CFP →</RollingText>
    </Link>
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
          maxWidth="85%"
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
          maxWidth="85%"
        />
      </div>
    </section>
  );
}
