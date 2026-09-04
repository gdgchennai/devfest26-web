import { siteConfig } from "@/site.config";
import { JsonLd } from "@/components/JsonLd";
import { ORG_ID } from "@/components/SiteJsonLd";
import { siteDescription, venuePostalAddress } from "@/lib/seo";

/**
 * schema.org/Event for the flagship day — Google event rich results.
 * Renders nothing while `siteConfig.date` is null.
 */
export function EventJsonLd() {
  if (!siteConfig.date) return null;

  const tickets = siteConfig.ticketSelector.tickets.filter((t) => t.visible);
  const offers = (tickets.length > 0 ? tickets : siteConfig.ticketSelector.tickets).map((t) => ({
    "@type": "Offer",
    name: t.name,
    category: t.category === "student" ? "Student" : "Professional",
    price: t.price,
    priceCurrency: "INR",
    url: t.href || `${siteConfig.url}${siteConfig.ticketing.href}`,
    validFrom: t.opens,
    priceValidUntil: t.closes,
    availability: "https://schema.org/InStock",
  }));

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Event",
        "@id": `${siteConfig.url}/#event`,
        name: siteConfig.name,
        description: siteDescription,
        url: siteConfig.url,
        inLanguage: "en-IN",
        isAccessibleForFree: false,
        startDate: `${siteConfig.date}T09:00:00+05:30`,
        endDate: `${siteConfig.date}T17:00:00+05:30`,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        image: [`${siteConfig.url}/banner/main.jpg`],
        location: {
          "@type": "Place",
          name: siteConfig.venue.name,
          url: siteConfig.venue.mapUrl,
          address: venuePostalAddress(),
        },
        organizer: { "@id": ORG_ID },
        performer: { "@id": ORG_ID },
        offers,
      }}
    />
  );
}
