import { siteConfig } from "@/site.config";

/**
 * schema.org/Event structured data for the flagship day — read by Google's
 * event rich results and by AI answer engines, so date/venue/ticket-URL stay
 * driven off siteConfig instead of a hand-typed duplicate that can drift.
 * Renders nothing while `siteConfig.date` is null ("date to be announced" —
 * there's no real startDate to publish yet).
 */
export function EventJsonLd() {
  if (!siteConfig.date) return null;

  const json = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: siteConfig.name,
    description: `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
    startDate: `${siteConfig.date}T09:00:00+05:30`,
    endDate: `${siteConfig.date}T17:00:00+05:30`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: siteConfig.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: siteConfig.venue.line1,
        addressLocality: "Chennai",
        addressRegion: "Tamil Nadu",
        addressCountry: "IN",
      },
    },
    image: [`${siteConfig.url}/web-app-manifest-512x512.png`],
    organizer: {
      "@type": "Organization",
      name: siteConfig.chapter,
      url: siteConfig.url,
    },
    offers: {
      "@type": "AggregateOffer",
      url: `${siteConfig.url}${siteConfig.ticketing.href}`,
      priceCurrency: "INR",
      lowPrice: Math.min(...siteConfig.ticketSelector.tiers.map((t) => t.price)),
      highPrice: Math.max(...siteConfig.ticketSelector.tiers.map((t) => t.price)),
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
