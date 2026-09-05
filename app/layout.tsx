import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { siteConfig, uiCopy } from "@/site.config";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { BootPreloaderRelease } from "@/components/motion/BootPreloaderRelease";
import { ScrollCueController } from "@/components/motion/ScrollCue";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { Header } from "@/components/Header";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { OG_IMAGE, siteDescription } from "@/lib/seo";
import { CtaTracker } from "@/components/CtaTracker";
import { PostHogIdentify } from "@/components/PostHogIdentify";

// Google Sans from fonts.googleapis.com (not next/font). next/font/google
// self-hosts the files and has no fallback metrics for this family, which
// produced the repeating "Failed to find font override values" warning.
const GOOGLE_SANS_CSS =
  "https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteDescription,
  applicationName: siteConfig.shortName,
  authors: [{ name: siteConfig.chapter, url: siteConfig.url }],
  creator: siteConfig.chapter,
  publisher: siteConfig.chapter,
  category: "technology",
  // Resolves every relative URL in metadata (OpenGraph, alternates, icons)
  // against the real domain — required for crawlers/agents to treat this
  // site's URLs as canonical rather than relative/unresolvable.
  metadataBase: new URL(siteConfig.url),
  // Canonical URLs are per-page (see pageMetadata in lib/seo.ts). A layout-level
  // `canonical: "/"` would make Google treat every route as a duplicate of home.
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_IN",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gdgchennai",
    creator: "@gdgchennai",
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  colorScheme: "dark",
  viewportFit: "cover",
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
    <html lang="en-IN" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink text-paper" suppressHydrationWarning>
        <a href="#main" className="skip-link">
          {uiCopy.common.skipToContent}
        </a>
        <noscript>
          <style>{`#boot-preloader{display:none!important}`}</style>
        </noscript>
        <SiteJsonLd />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ? (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT} />
        ) : null}
        <link rel="stylesheet" href={GOOGLE_SANS_CSS} />
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
         *
         * Dots are HTML, not SVG: CSS `transform-box: fill-box` on SVG circles
         * forces a bounding-box recalc every frame and was the intro's main
         * paint cost. Nested slots keep position transforms off the bouncing
         * balls so the animation is compositor-only (`translate3d`).
         */}
        <style
          dangerouslySetInnerHTML={{
            __html: `#boot-preloader{position:fixed;inset:0;z-index:995;display:flex;align-items:center;justify-content:center;background:#fff;contain:layout paint}#boot-preloader .boot-dots{position:relative;width:min(82vw,720px);aspect-ratio:1728/535}#boot-preloader .boot-dot-slot{position:absolute;top:49.813%;width:9.086%;aspect-ratio:1;transform:translate(-50%,-50%)}#boot-preloader .boot-dot-slot:nth-child(1){left:24.045%}#boot-preloader .boot-dot-slot:nth-child(2){left:41.348%}#boot-preloader .boot-dot-slot:nth-child(3){left:58.651%}#boot-preloader .boot-dot-slot:nth-child(4){left:75.955%}#boot-preloader .boot-dot{width:100%;height:100%;border-radius:50%;will-change:transform;animation:boot-bounce 1.25s ease-in-out infinite}#boot-preloader .boot-dot-slot:nth-child(2) .boot-dot{animation-delay:.12s}#boot-preloader .boot-dot-slot:nth-child(3) .boot-dot{animation-delay:.24s}#boot-preloader .boot-dot-slot:nth-child(4) .boot-dot{animation-delay:.36s}@keyframes boot-bounce{0%,45%,100%{transform:translate3d(0,0,0)}22%{transform:translate3d(0,-20%,0)}}#boot-lite-prompt{position:absolute;left:50%;bottom:max(3.75rem,calc(env(safe-area-inset-bottom,0px) + 2.5rem));transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:.5rem;width:min(88vw,340px);padding:.75rem 1rem;border:1px solid rgba(0,0,0,.2);border-radius:1rem;background:#fff;text-align:center}#boot-lite-prompt .msg{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.875rem;line-height:1.35;color:rgba(0,0,0,.8)}#boot-lite-prompt .row{display:flex;gap:1rem}#boot-lite-prompt button{background:none;border:0;padding:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#000;cursor:pointer}#boot-lite-prompt button.dismiss{font-weight:500;color:rgba(0,0,0,.6)}html.no-boot #boot-preloader,html.boot-done #boot-preloader{display:none}@media(prefers-reduced-motion:reduce){#boot-preloader{display:none}}`,
          }}
        />
        {/* Mirrors isLiteMode() in lib/motion-prefs.ts, including the `?lite=0`
            opt-out — without that branch a stale stored preference would hide
            the boot preloader on a ?lite=0 load that then plays the full intro.
            Also skips the overlay on inner routes, bots, and reduced-motion.
            Inlined: it must run before any module. */}
        <Script id="intro-bridge" strategy="beforeInteractive">
          {`(function(){try{var ua=navigator.userAgent;var bot=/Googlebot|Google-InspectionTool|AdsBot-Google|Storebot-Google|GoogleOther|bingbot|BingPreview|DuckDuckBot|Slurp|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|Chrome-Lighthouse|GPTBot|ClaudeBot|Bytespider|CCBot/i.test(ua);var p=new URLSearchParams(location.search).get('lite');var lite=p==='1'||(p!=='0'&&localStorage.getItem('devfest-lite')==='1');var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;var home=location.pathname==='/'||location.pathname==='';if(bot||reduce||lite||!home){document.documentElement.classList.add('no-boot');}if(lite){document.documentElement.classList.add('lite');}}catch(e){}})();`}
        </Script>
        <div id="boot-preloader">
          <div className="boot-dots" aria-hidden="true">
            <div className="boot-dot-slot">
              <div className="boot-dot" style={{ background: "#4285f4" }} />
            </div>
            <div className="boot-dot-slot">
              <div className="boot-dot" style={{ background: "#ea4335" }} />
            </div>
            <div className="boot-dot-slot">
              <div className="boot-dot" style={{ background: "#f9ab00" }} />
            </div>
            <div className="boot-dot-slot">
              <div className="boot-dot" style={{ background: "#34a853" }} />
            </div>
          </div>
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
          <PostHogIdentify />
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
          <ScrollProgress />
            </MotionProvider>
          </FavoritesProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId={siteConfig.analytics.measurementId} />
    </html>
  );
}
