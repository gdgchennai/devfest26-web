import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { siteConfig } from "@/site.config";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { BootPreloaderRelease } from "@/components/motion/BootPreloaderRelease";
import { ScrollCueController } from "@/components/motion/ScrollCue";
import { SkipLink } from "@/components/SkipLink";
import { Header } from "@/components/Header";
import { HamburgerMenu } from "@/components/HamburgerMenu";

/*
 * A subset WOFF2, not the raw TTF. `next/font/local` copies the file verbatim —
 * it neither transcodes nor subsets — so pointing this at the 4.6 MB source
 * shipped 4.6 MB to every visitor, roughly nine times the entire hero photo
 * payload. `npm run fonts` regenerates it; see scripts/subset-fonts.mjs.
 *
 * No italic face. Nothing in the site renders italic, and the 4.8 MB italic
 * source was one stray <em> away from being downloaded. If italic is ever
 * genuinely needed, subset that source too rather than pointing at the raw file.
 */
const googleSans = localFont({
  src: "../public/fonts/google-sans-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
  // Image, url, and metadataBase are deliberately omitted until the production
  // domain is confirmed; the fields below already give WhatsApp/social a proper
  // title + description unfurl (the agenda link circulates in WhatsApp groups).
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_IN",
    title: siteConfig.name,
    description: `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
  },
};

// The site is committed-dark (bg-ink). Without this, mobile browser chrome and
// native controls render against a light default.
//
// Must stay in step with `--ink` in globals.css — this was #0a0a0b against an
// --ink of #1e1e1e, so mobile address bars rendered near-black above a
// noticeably lighter charcoal page. Kept as a literal because `viewport` is
// serialised at build time and cannot read a CSS custom property.
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below intentionally toggles a
    // class on <html> before hydration, so the server and client class lists
    // differ by design (the standard pre-paint-script pattern).
    <html lang="en" suppressHydrationWarning className={`${googleSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ink text-paper" suppressHydrationWarning>
        {/*
         * First-paint preloader. Server-rendered AND styled inline (below) so
         * the four dots bounce from the very first paint — before the JS bundle
         * downloads, before the GSAP <Loader> can mount, and independent of the
         * external stylesheet or any script running. It is VISIBLE BY DEFAULT
         * (no class gate — a script-added class would only land after first
         * paint in dev, which is what caused the "black screen then dots"). It is
         * hidden only for reduced-motion (CSS media query) or lite (`no-boot`,
         * added by the bridge script), and swapped out for the real loader once
         * HeroSection adds `boot-done`. Colours are literal hex, not var()s, so
         * the dots are right even before globals.css applies. Geometry mirrors
         * the <Loader> SVG (same viewBox + dot centres) for a seamless hand-off.
         */}
        <style
          dangerouslySetInnerHTML={{
            __html: `#boot-preloader{position:fixed;inset:0;z-index:995;display:flex;align-items:center;justify-content:center;background:#fff}#boot-preloader svg{display:block;width:min(82vw,720px);height:auto}#boot-preloader circle{transform-box:fill-box;transform-origin:center;animation:boot-bounce 1.25s ease-in-out infinite}#boot-preloader circle:nth-of-type(2){animation-delay:.12s}#boot-preloader circle:nth-of-type(3){animation-delay:.24s}#boot-preloader circle:nth-of-type(4){animation-delay:.36s}@keyframes boot-bounce{0%,45%,100%{transform:translateY(0)}22%{transform:translateY(-20%)}}html.no-boot #boot-preloader,html.boot-done #boot-preloader{display:none}@media(prefers-reduced-motion:reduce){#boot-preloader{display:none}}`,
          }}
        />
        {/* Mirrors isLiteMode() in lib/motion-prefs.ts, including the `?lite=0`
            opt-out — without that branch a stale stored preference would hide
            the boot preloader on a ?lite=0 load that then plays the full intro.
            Inlined rather than imported: it must run before any module does. */}
        <Script id="intro-bridge" strategy="beforeInteractive">
          {`(function(){try{var p=new URLSearchParams(location.search).get('lite');var lite=p==='1'||(p!=='0'&&localStorage.getItem('devfest-lite')==='1');var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce||lite){document.documentElement.classList.add('no-boot');}if(lite){document.documentElement.classList.add('lite');}}catch(e){}})();`}
        </Script>
        <div id="boot-preloader" aria-hidden="true">
          <svg viewBox="0 250 1728 535" xmlns="http://www.w3.org/2000/svg">
            <circle cx="415.5" cy="516.5" r="78.5" fill="#4285f4" />
            <circle cx="714.5" cy="516.5" r="78.5" fill="#ea4335" />
            <circle cx="1013.5" cy="516.5" r="78.5" fill="#f9ab00" />
            <circle cx="1312.5" cy="516.5" r="78.5" fill="#34a853" />
          </svg>
        </div>
        {/* Takes the preloader above back down on every route. Must live here,
            not in a page-level component — see BootPreloaderRelease. */}
        <BootPreloaderRelease />
        <SkipLink />
        <MotionProvider>
          {/* Both mount unconditionally; which one is visible is a pure CSS
              gate on `html.lite` (see .nav-hamburger-only/.nav-lite-only in
              app/globals.css) so there's no hydration flash. Full mode gets
              the hamburger (components/HamburgerMenu.tsx); lite mode gets
              the plain pill bar (components/Header.tsx). Fixed, so neither
              adds anything to the document flow the ScrollTrigger pins below
              are measured against. */}
          <Header />
          <HamburgerMenu />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <ScrollCueController />
        </MotionProvider>
      </body>
    </html>
  );
}
