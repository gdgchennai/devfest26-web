import type { Metadata } from "next";
import { formatEventDate, siteConfig } from "@/site.config";

export const OG_IMAGE = {
  url: "/banner/main.webp",
  width: 2160,
  height: 1080,
  alt: siteConfig.name,
} as const;

export const siteDescription = `${siteConfig.tagline} — ${formatEventDate(siteConfig.date)} at ${siteConfig.venue.name}, Chennai. The flagship annual conference from ${siteConfig.chapter}.`;

const MARKDOWN_EXACT = new Set(["/", "/agenda", "/speakers", "/tickets", "/tickets/select", "/partner"]);

export function absoluteUrl(path: string): string {
  if (path === "/") return siteConfig.url;
  return `${siteConfig.url}${path}`;
}

function markdownAlternate(path: string): string | undefined {
  if (MARKDOWN_EXACT.has(path) || path.startsWith("/speakers/")) {
    return path === "/" ? `${siteConfig.url}/md` : `${siteConfig.url}/md${path}`;
  }
  return undefined;
}

/**
 * Per-page metadata. The root layout must NOT set `alternates.canonical` to
 * "/" — that would stamp the homepage as canonical on every child route and
 * collapse Google's index into a single URL.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogTitle = path === "/" ? siteConfig.name : `${title} — ${siteConfig.name}`;
  const md = markdownAlternate(path);

  return {
    title: path === "/" ? { absolute: siteConfig.name } : title,
    description,
    alternates: {
      canonical: path,
      ...(md ? { types: { "text/markdown": md } } : {}),
    },
    openGraph: {
      url,
      title: ogTitle,
      description,
    },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export function venuePostalAddress() {
  return {
    "@type": "PostalAddress" as const,
    streetAddress: siteConfig.venue.line1,
    addressLocality: "Chennai",
    addressRegion: "Tamil Nadu",
    postalCode: "600113",
    addressCountry: "IN",
  };
}

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
