import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteConfig } from "@/site.config";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { SkipLink } from "@/components/SkipLink";

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
  themeColor: "#1e1e1e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${googleSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ink text-paper">
        <SkipLink />
        <MotionProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
