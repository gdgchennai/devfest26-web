import { siteConfig, formatEventDate, uiCopy } from "@/site.config";
import { ticketCta } from "@/lib/cta";

/**
 * The one source of hero copy, shared by both hero variants:
 * `CurvedMarqueeHero` (WebGL) and `StaticHero` (lite / no-JS / error fallback).
 *
 * It exists because the two variants cannot share markup — one draws its title
 * as extruded 3D text inside a WebGL canvas, the other as an `<h1>` — so
 * without this the tagline, the date and the CTA labels would have to be typed
 * twice and would drift. Change the wording here, once.
 *
 * `ticket` comes from `ticketCta()` rather than being written out, because the
 * hero was the last place still rendering a "Get Tickets" link that quietly
 * landed on /agenda instead of the real ticketing destination — the exact
 * thing lib/cta.ts was written to stop.
 *
 * Not a component and deliberately not "use client": it is plain data derived
 * from config at module scope, so it costs the lite bundle nothing.
 */
export const heroCopy = {
  eyebrow: uiCopy.common.chapterPresents,
  title: siteConfig.shortName,
  tagline: siteConfig.tagline,
  /** Already renders "Date to be announced" when `siteConfig.date` is null. */
  dateLabel: formatEventDate(siteConfig.date),
  venueLabel: siteConfig.venue.name,
  venueConfirmed: siteConfig.venue.confirmed,
  ticket: ticketCta(),
  agenda: { href: siteConfig.agendaUrl, label: uiCopy.heroCopy.agendaLabel },
} as const;
