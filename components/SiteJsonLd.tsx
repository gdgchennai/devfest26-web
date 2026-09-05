import { siteConfig } from "@/site.config";
import { JsonLd } from "@/components/JsonLd";
import { siteDescription, venuePostalAddress } from "@/lib/seo";

const ORG_ID = `${siteConfig.url}/#organization`;
const SITE_ID = `${siteConfig.url}/#website`;

/**
 * Sitewide Organization + WebSite graph. Event-specific markup stays on the
 * homepage (EventJsonLd) so inner routes do not claim to *be* the event.
 */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": ORG_ID,
            name: siteConfig.chapter,
            alternateName: "Google Developer Group Chennai",
            url: siteConfig.url,
            email: siteConfig.contact.email,
            logo: {
              "@type": "ImageObject",
              url: `${siteConfig.url}/web-app-manifest-512x512.png`,
              width: 512,
              height: 512,
            },
            sameAs: Object.values(siteConfig.social),
            address: venuePostalAddress(),
          },
          {
            "@type": "WebSite",
            "@id": SITE_ID,
            url: siteConfig.url,
            name: siteConfig.name,
            alternateName: siteConfig.shortName,
            description: siteDescription,
            inLanguage: "en-IN",
            publisher: { "@id": ORG_ID },
          },
        ],
      }}
    />
  );
}

export { ORG_ID };
