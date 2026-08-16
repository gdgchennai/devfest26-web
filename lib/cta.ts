import { siteConfig } from "@/site.config";

/**
 * What the site's two recruiting call-to-actions should actually say, given
 * how much of `siteConfig` is still unconfirmed. Both follow the same rule:
 * never render a label that promises something the config cannot deliver —
 * which is also why both always resolve to a real destination now (ticketing
 * through our own /tickets page, speaking through Sessionize) rather than
 * ever needing a "nowhere to send you yet" state.
 */
export type Cta = { available: true; href: string; label: string; external: boolean };

/**
 * Tickets are sold through our own /tickets page, not an external platform —
 * always available, since that page exists regardless of anything else being
 * confirmed yet. (It was previously gated on an external ticketing URL, in
 * the same spirit as speakerCta() below: a "Get Tickets" button that quietly
 * lands somewhere unset is a lie, and it was rendered that way in both the
 * header and the homepage CTA before this existed.)
 */
export function ticketCta(): Cta {
  return {
    available: true,
    href: siteConfig.ticketing.href,
    label: siteConfig.ticketing.availableLabel,
    external: false,
  };
}

/**
 * The speaker pitch — always the external CFP form (Sessionize). There's no
 * local /cfp page to fall back to (see lib/routes.ts's retiredRoutes), so
 * every "this could be you" slot on the site points straight at the form,
 * in a new tab.
 */
export function speakerCta(): Cta {
  return { available: true, href: siteConfig.cfp.formUrl, label: "Submit a talk", external: true };
}
