import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { siteConfig, uiCopy } from "@/site.config";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { BootPreloaderRelease } from "@/components/motion/BootPreloaderRelease";
import { ScrollCueController } from "@/components/motion/ScrollCue";
import { Header } from "@/components/Header";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { CtaTracker } from "@/components/CtaTracker";

// Self-hosted at build time by next/font/google — no runtime request to
// Google. Only `normal` style: nothing in the site renders italic.
// adjustFontFallback: false — Next only ships fallback-font metrics for its
// own curated font list, which doesn't include Google Sans; leaving the
// default on just produces a "failed to find override values" warning with
// no fallback ever generated.
const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: "variable",
  style: "normal",
  variable: "--font-google-sans",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
  // Resolves every relative URL in metadata (OpenGraph, alternates, icons)
  // against the real domain — required for crawlers/agents to treat this
  // site's URLs as canonical rather than relative/unresolvable.
  metadataBase: new URL(siteConfig.url),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "en_IN",
    // No `title` / `description` here on purpose: with them omitted, Next fills
    // og:title and og:description from each page's own resolved `title` /
    // `description` ("Agenda — DevFest 2026 Chennai", the partner page's own
    // blurb, etc.), so a shared link unfurls as the page it points to. Pages
    // that set neither fall back to the `title.default` / `description` at the
    // top of this object.
    //
    // `images` DOES stay here — the social-card raster (WhatsApp/Slack/
    // LinkedIn/X/Discord). Relative path; metadataBase makes it absolute for
    // crawlers. 2160×1080 (2:1); platforms wanting 1.91:1 crop a hair.
    images: [{ url: "/banner/main.jpg", width: 2160, height: 1080, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    // Same as openGraph above — title/description inferred per page.
    images: ["/banner/main.jpg"],
  },
  // Controls iOS "Add to Home Screen" behaviour — apple-icon.png (auto-detected
  // from app/) supplies the icon itself. Matches the site's committed-dark
  // theme (see viewport.themeColor below).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.shortName,
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
            __html: `#boot-preloader{position:fixed;inset:0;z-index:995;display:flex;align-items:center;justify-content:center;background:#fff}#boot-preloader svg{display:block;width:min(82vw,720px);height:auto}#boot-preloader circle{transform-box:fill-box;transform-origin:center;animation:boot-bounce 1.25s ease-in-out infinite}#boot-preloader circle:nth-of-type(2){animation-delay:.12s}#boot-preloader circle:nth-of-type(3){animation-delay:.24s}#boot-preloader circle:nth-of-type(4){animation-delay:.36s}@keyframes boot-bounce{0%,45%,100%{transform:translateY(0)}22%{transform:translateY(-20%)}}#boot-preloader>p{position:absolute;bottom:1.5rem;left:0;right:0;margin:0;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,0,0,.5)}@media(min-width:1024px){#boot-preloader>p{display:none}}#boot-lite-prompt{position:absolute;left:50%;bottom:3.75rem;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:.5rem;width:min(88vw,340px);padding:.75rem 1rem;border:1px solid rgba(0,0,0,.2);border-radius:1rem;background:#fff;text-align:center}#boot-lite-prompt .msg{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.875rem;line-height:1.35;color:rgba(0,0,0,.8)}#boot-lite-prompt .row{display:flex;gap:1rem}#boot-lite-prompt button{background:none;border:0;padding:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#000;cursor:pointer}#boot-lite-prompt button.dismiss{font-weight:500;color:rgba(0,0,0,.6)}html.no-boot #boot-preloader,html.boot-done #boot-preloader{display:none}@media(prefers-reduced-motion:reduce){#boot-preloader{display:none}}`,
          }}
        />
        {/* Mirrors isLiteMode() in lib/motion-prefs.ts, including the `?lite=0`
            opt-out — without that branch a stale stored preference would hide
            the boot preloader on a ?lite=0 load that then plays the full intro.
            Inlined rather than imported: it must run before any module does. */}
        <Script id="intro-bridge" strategy="beforeInteractive">
          {`(function(){try{var p=new URLSearchParams(location.search).get('lite');var lite=p==='1'||(p!=='0'&&localStorage.getItem('devfest-lite')==='1');var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce||lite){document.documentElement.classList.add('no-boot');}if(lite){document.documentElement.classList.add('lite');}}catch(e){}})();`}
        </Script>
        <div id="boot-preloader">
          <svg viewBox="0 250 1728 535" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="415.5" cy="516.5" r="78.5" fill="#4285f4" />
            <circle cx="714.5" cy="516.5" r="78.5" fill="#ea4335" />
            <circle cx="1013.5" cy="516.5" r="78.5" fill="#f9ab00" />
            <circle cx="1312.5" cy="516.5" r="78.5" fill="#34a853" />
          </svg>
          <p>{uiCopy.loader.desktopHint}</p>
          {/* Slow-load opt-out for the pre-hydration window — the JS bundle
              itself is what's slow on a bad connection, so the React <Loader>'s
              own prompt can't help until it exists. Revealed by the inline
              script below once the boot preloader has been up past the slow
              threshold; a plain reload to ?lite=1 (no React to do the smooth
              swap yet). Kept in sync with SLOW_AFTER in useAssetsLoaded.ts. */}
          <div id="boot-lite-prompt">
            <p className="msg">{uiCopy.loader.litePromptBody}</p>
            <div className="row">
              <button type="button" id="boot-lite-accept">
                {uiCopy.loader.litePromptAcceptLabel}
              </button>
              <button type="button" id="boot-lite-dismiss" className="dismiss">
                {uiCopy.loader.litePromptDismissLabel}
              </button>
            </div>
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;if(r.classList.contains('no-boot'))return;var b=document.getElementById('boot-lite-prompt');if(!b)return;var dismissed=0;try{dismissed=sessionStorage.getItem('devfest-lite-prompt-dismissed')==='1'}catch(e){}var t=setTimeout(function(){if(!dismissed&&!r.classList.contains('boot-done')&&!r.classList.contains('no-boot'))b.style.display='flex'},4000);var a=document.getElementById('boot-lite-accept');if(a)a.addEventListener('click',function(){try{localStorage.setItem('devfest-lite','1')}catch(e){}var u=new URL(location.href);u.searchParams.set('lite','1');location.href=u.href});var d=document.getElementById('boot-lite-dismiss');if(d)d.addEventListener('click',function(){clearTimeout(t);b.style.display='none';try{sessionStorage.setItem('devfest-lite-prompt-dismissed','1')}catch(e){}});})();`,
          }}
        />
        {/* Takes the preloader above back down on every route. Must live here,
            not in a page-level component — see BootPreloaderRelease. */}
        <BootPreloaderRelease />
        <AuthProvider>
          <FavoritesProvider>
            <MotionProvider>
          {/* Capture-phase click listener for conversion hrefs. Must be a
              child of MotionProvider so its effect registers before the
              route-transition interceptor — see CtaTracker. */}
          <CtaTracker />
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
          </FavoritesProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId={siteConfig.analytics.measurementId} />
    </html>
  );
}
