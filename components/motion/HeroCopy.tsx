import { siteConfig, formatEventDate, uiCopy } from "@/site.config";
import { ticketCta, volunteerCta, speakerCta } from "@/lib/cta";
import { AGENDA_READY } from "@/lib/routes";

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
  /** null until the agenda is actually publishable — see AGENDA_READY. */
  agenda: AGENDA_READY ? { href: siteConfig.agendaUrl, label: uiCopy.heroCopy.agendaLabel } : null,
  volunteer: { href: volunteerCta().href, label: uiCopy.heroCopy.volunteerLabel },
} as const;

/**
 * The hero CTA row, resolved once here so `CurvedMarqueeHero` and `StaticHero`
 * render the same buttons in the same order.
 *
 * `HERO_BUTTONS` (see next.config.ts) is an optional comma-separated allow-list
 * — e.g. `HERO_BUTTONS=tickets,cfp` — that trims or picks the row per deploy
 * without a code change. Unset means "all of them". Order is fixed here, not
 * taken from the env, so the row can't be accidentally reshuffled.
 *
 * `agenda` is gated twice: it only exists while `AGENDA_READY` is on (naming it
 * in the env does nothing before then), and it's still subject to the
 * allow-list once it is — so `HERO_BUTTONS` without `agenda` hides it even
 * after the agenda is published.
 */
const HERO_BUTTON_ORDER = ["tickets", "cfp", "volunteer", "agenda"] as const;
type HeroButtonKey = (typeof HERO_BUTTON_ORDER)[number];

export type HeroButton = { key: HeroButtonKey; href: string; label: string };

const heroButtonDefs: Record<HeroButtonKey, HeroButton | null> = {
  tickets: { key: "tickets", href: heroCopy.ticket.href, label: uiCopy.common.getTicketsLabel },
  cfp: { key: "cfp", href: speakerCta().href, label: uiCopy.heroCopy.cfpLabel },
  volunteer: { key: "volunteer", href: heroCopy.volunteer.href, label: heroCopy.volunteer.label },
  agenda: heroCopy.agenda ? { key: "agenda", href: heroCopy.agenda.href, label: heroCopy.agenda.label } : null,
};

const heroButtonAllowList: readonly HeroButtonKey[] = (() => {
  const raw = process.env.HERO_BUTTONS?.trim();
  if (!raw) return HERO_BUTTON_ORDER;
  const requested = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return HERO_BUTTON_ORDER.filter((key) => requested.has(key));
})();

export const heroButtons: HeroButton[] = heroButtonAllowList
  .map((key) => heroButtonDefs[key])
  .filter((b): b is HeroButton => b !== null);
