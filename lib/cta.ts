import { siteConfig } from "@/site.config";

/**
 * What the site's two recruiting call-to-actions should actually say, given
 * how much of `siteConfig` is still unconfirmed. Both follow the same rule:
 * never render a label that promises something the config cannot deliver.
 */

export type Cta =
  | { available: true; href: string; label: string; external: boolean }
  | { available: false; label: string; note: string };

/**
 * A "Get Tickets" button that quietly lands on /agenda is a lie, and it was
 * rendered that way in both the header and the homepage CTA while
 * `ticketing.url` is null. When there is nowhere to buy, we say so.
 */
export function ticketCta(): Cta {
  const url = siteConfig.ticketing.url;
  if (url) return { available: true, href: url, label: "Get Tickets →", external: true };
  return {
    available: false,
    label: "Tickets open soon",
    note: `Sold via ${siteConfig.ticketing.platform}.`,
  };
}

/**
 * The speaker pitch. Prefers the external CFP form (Sessionize) when its URL
 * is set, and otherwise points at /cfp — which already renders the
 * open / closed / opening-soon states from the same config. Set
 * `siteConfig.cfp.formUrl` and every "this could be you" slot on the site
 * starts pointing straight at the form.
 */
export function speakerCta(): Cta {
  const url = siteConfig.cfp.formUrl;
  if (url) return { available: true, href: url, label: "Submit a talk", external: true };
  return { available: true, href: "/cfp", label: "Submit a talk", external: false };
}
