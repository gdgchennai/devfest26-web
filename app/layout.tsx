import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteConfig } from "@/site.config";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { SkipLink } from "@/components/SkipLink";

const googleSans = localFont({
  src: [
    {
      path: "../Google_Sans/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../Google_Sans/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf",
      weight: "100 900",
      style: "italic",
    },
  ],
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
// native controls render against a light default. `--ink` is #0a0a0b.
export const viewport: Viewport = {
  themeColor: "#0a0a0b",
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
