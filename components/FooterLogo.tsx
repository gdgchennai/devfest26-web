"use client";

import { usePathname } from "next/navigation";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { FooterBrackets } from "@/components/FooterBrackets";
import { GlowButton } from "@/components/GlowButton";
import { SocialIcon } from "@/components/SocialIcon";
import { BRACKETS_FIELD_ROUTES } from "@/components/motion/BracketsField";
import { uiCopy } from "@/site.config";

/*
 * The footer centrepiece: the official DevFest wordmark + "Chennai" pill
 * (brand-assets/devfest-logo-wo-brackets-dark.svg — the dark-background variant;
 * see the src below), framed by the two brackets.
 *
 * Two rendering modes, keyed off whether the 3D BracketsField is live (only on
 * the homepage, only with motion enabled):
 *
 *  • 3D mode — BracketsField extrudes BOTH this lockup and the two brackets in
 *    WebGL and settles them here as the page bottom is reached (it reads this
 *    box via id="footer-logo"). Those meshes live behind the footer (z-0), so
 *    the flat <img> is kept for layout/measurement but hidden (opacity 0), and
 *    <FooterBrackets> renders nothing.
 *  • Fallback — everywhere else (other routes, reduced-motion / lite / save-
 *    data): the flat SVG shows with a stacked-drop-shadow fake extrusion, and
 *    <FooterBrackets> draws a static pair in the same slots.
 *
 * No card: the brackets can only show where the footer is transparent. The
 * white pill carries a hairline border (in the SVG) so it reads on the page.
 */

export function FooterLogo({
  social,
}: {
  social: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  // The 3D field extrudes and settles the lockup itself only on routes that
  // mount <BracketsField/> (see BRACKETS_FIELD_ROUTES). Everywhere else the
  // flat SVG is the logo.
  const field3D = BRACKETS_FIELD_ROUTES.includes(pathname) && !staticBaseline;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10">
      {/* The logo box. `relative` so the static fallback brackets can anchor to
          it; the 3D field reads this same box via id="footer-logo". The capped
          width leaves the transparent gutters the brackets settle into, and the
          aspect-ratio keeps the box measured before the image loads so the 3D
          settle target is stable. */}
      <div className="relative mx-auto aspect-[1370/531] w-[min(60vw,420px)]">
        <FooterBrackets />
        {/* eslint-disable-next-line @next/next/no-img-element -- a static brand
            SVG measured by the motion layer; next/image adds nothing here. */}
        <img
          id="footer-logo"
          /* The -dark variant: the supplied lockup draws the DevFest wordmark
             in #F0F0F0 (near-white) — the file meant for a dark backdrop,
             which is what the footer stays on now (--page-bg settles on
             black at Location and never moves again). See BracketsField's
             own LOGO_FILE for the -light counterpart (dark wordmark, for a
             light footer) this deliberately does NOT use. */
          src="/brand-assets/devfest-logo-wo-brackets-dark.svg"
          alt={uiCopy.footerLogo.alt}
          className="h-full w-full"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          // In 3D mode the WebGL lockup is the visible logo; keep this laid out
          // for measurement but invisible. Otherwise show it flat, no filter.
          style={field3D ? { opacity: 0 } : undefined}
        />
      </div>

      {/* Social buttons — same glass/neon treatment as the site's other CTAs
          (see components/GlowButton.tsx), circle-shaped for an icon-only
          control. aria-label carries the accessible name since the visible
          content is just the icon. */}
      {social.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {social.map((link) => (
            <GlowButton key={link.label} href={link.href} target="_blank" rel="noreferrer" shape="circle" size="sm">
              <span className="sr-only">{link.label}</span>
              <SocialIcon name={link.label} className="relative h-5 w-5 fill-paper" />
            </GlowButton>
          ))}
        </div>
      )}
    </div>
  );
}
