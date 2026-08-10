"use client";

import { usePathname } from "next/navigation";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { FooterBrackets } from "@/components/FooterBrackets";
import { GlowButton } from "@/components/GlowButton";

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

// Fake extrusion for the fallback flat logo: a stack of identical 1px down-
// right drop-shadows in a darker gold builds a solid diagonal side, then one
// soft ambient shadow lifts it off the page.
//
// Both colours are derived from tokens rather than written as hex. The gold was
// literally `#9a6a00`, which is exactly var(--yellow) mixed 62% into black — the
// same mix the social discs below already use — so this is the identical colour
// expressed as the brand ramp instead of a hand-mixed shade. The ambient shadow
// was `rgba(30,30,30,0.22)`, i.e. the OLD --ink (#1e1e1e), which stopped
// matching the page when ink became #000.
const EXTRUDE_COLOR = "color-mix(in srgb, var(--yellow) 62%, var(--black))";
const AMBIENT_SHADOW = "color-mix(in srgb, var(--ink) 22%, transparent)";
const LOGO_FILTER = `${Array.from({ length: 8 }, () => `drop-shadow(1px 1px 0 ${EXTRUDE_COLOR})`).join(" ")} drop-shadow(0 12px 16px ${AMBIENT_SHADOW})`;

const ICONS: Record<string, React.ReactNode> = {
  X: (
    <path d="M18.9 2h3.3l-7.2 8.3L23.5 22h-6.6l-5.2-6.8L5.8 22H2.5l7.7-8.9L1.9 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
  ),
  Instagram: (
    <>
      <path
        d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5Zm0 2A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 17 4.5H7Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      <path
        d="M12 7.2A4.8 4.8 0 1 1 12 16.8 4.8 4.8 0 0 1 12 7.2Zm0 2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      <circle cx="17.3" cy="6.7" r="1.2" />
    </>
  ),
  LinkedIn: (
    <path d="M6.94 8.5v10.9H3.5V8.5h3.44ZM5.22 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM20.5 19.4h-3.43v-5.7c0-1.36-.03-3.1-1.9-3.1-1.9 0-2.19 1.48-2.19 3v5.8H9.55V8.5h3.29v1.49h.05c.46-.86 1.58-1.77 3.25-1.77 3.48 0 4.36 2.29 4.36 5.27v5.91Z" />
  ),
  YouTube: (
    <path d="M22.5 8.1a2.7 2.7 0 0 0-1.9-1.9C18.9 5.7 12 5.7 12 5.7s-6.9 0-8.6.5A2.7 2.7 0 0 0 1.5 8.1 28.4 28.4 0 0 0 1 12a28.4 28.4 0 0 0 .5 3.9 2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.7 2.7 0 0 0 1.9-1.9A28.4 28.4 0 0 0 23 12a28.4 28.4 0 0 0-.5-3.9ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
  ),
  GitHub: (
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  ),
};

export function FooterLogo({
  social,
}: {
  social: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  // The 3D field extrudes and settles the lockup itself only here; otherwise
  // the flat SVG is the logo.
  const field3D = pathname === "/" && !staticBaseline;

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
             in #1E1E1E, which was legible while the page flipped to a light
             theme behind the footer. The site is dark-only now, so on #000 the
             wordmark rendered near-invisible — only its gold fake-extrusion
             was showing. Same geometry, wordmark recoloured to --paper. */
          src="/brand-assets/devfest-logo-wo-brackets-dark.svg"
          alt="DevFest Chennai"
          className="h-full w-full"
          // In 3D mode the WebGL lockup is the visible logo; keep this laid out
          // for measurement but invisible. Otherwise show it with fake depth.
          style={field3D ? { opacity: 0 } : { filter: LOGO_FILTER }}
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
              <svg viewBox="0 0 24 24" aria-hidden className="relative h-5 w-5 fill-paper">
                {ICONS[link.label] ?? null}
              </svg>
            </GlowButton>
          ))}
        </div>
      )}
    </div>
  );
}
