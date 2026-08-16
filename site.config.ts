import { EVENT_TIME_ZONE } from "@/lib/format";

export type Track = {
  slug: string;
  name: string;
  description: string;
};

export type SubEvent = {
  slug: string;
  title: string;
  /** Plain `YYYY-MM-DD`, same convention as `date` above — run through
   *  `shortEventDate()` at render time (see TicketsList.tsx), not
   *  pre-formatted here. It used to be a hand-typed display string ("Aug 29,
   *  2026"), a different convention from the flagship card's date (which
   *  goes through `shortEventDate` and read "17 October 2026") — two
   *  formats on the same page for what's supposed to be the same kind of
   *  data. One function producing both is what actually guarantees they
   *  match, rather than two hardcoded strings that merely happened to look
   *  similar. */
  date: string;
  description: string;
  ctaLabel: string;
};

export const siteConfig = {
  name: "DevFest Chennai 2026",
  shortName: "DevFest Chennai",
  chapter: "GDG Chennai",
  tagline: "Chennai's biggest tech festival",

  /*
   * THE event date. Change it here and it changes everywhere at once — the
   * hero, the agenda header and the ticket stub all read this one field, and
   * `null` puts every one of them back to "Date to be announced".
   *
   * Plain `YYYY-MM-DD`, deliberately: it is the easiest thing to edit
   * correctly, and it is unambiguous because `formatEventDate` renders it in
   * IST. A date-only string parses as UTC midnight, and IST is UTC+5:30, so
   * it always lands on the same calendar day in Chennai.
   *
   * If you move this, move the session dates in content/agenda.json with it —
   * they are the same day and nothing enforces that automatically.
   */
  date: "2026-10-17" as string | null,

  venue: {
    name: "IITM Research Park",
    // Carried over from the 2025 site — confirm before publishing for real.
    confirmed: true,
    line1: "IITM Research Park, Kanagam Road",
    line2: "Taramani, Chennai 600113",
    mapUrl: "https://maps.google.com/?q=IIT+Madras+Research+Park+Taramani+Chennai",
  },

  capacityClaim: "1200+ enthusiasts", // e.g. "1500+ developers" — update with 2025's real number

  ticketing: {
    // Same platform as 2025 (KonfHub); URL is new for 2026 and still pending.
    //
    // Must stay `null` until the real URL exists — NOT "#". `ticketCta()` in
    // lib/cta.ts branches on `if (url)`, and "#" is truthy, so a placeholder
    // there renders a live, external-styled "Get Tickets →" button on the
    // hero, the ticket stub, the 404 highlights and ShowMoodSection, all
    // landing nowhere. That is the exact failure lib/cta.ts exists to stop.
    // `null` gives the honest "Coming Soon" state instead.
    url: null as string | null,
    platform: "KonfHub",
    // What the CTA says in each of ticketCta()'s two states — kept here,
    // not hardcoded in lib/cta.ts, so every editable piece of copy lives in
    // one place (same reasoning as `subEvents` below).
    availableLabel: "Get Tickets →",
    comingSoonLabel: "Coming Soon",
  },

  agendaUrl: "/agenda",

  tracks: [
    { slug: "ai", name: "AI", description: "Machine learning, generative AI, and applied ML in production." },
    { slug: "cloud", name: "Cloud", description: "Cloud-native architecture, infra, and platform engineering." },
    { slug: "mobile", name: "Mobile", description: "Android, iOS, and cross-platform app development." },
    { slug: "web", name: "Web", description: "Frontend frameworks, performance, and the modern web platform." },
  ] satisfies Track[],

  // The community events feeding into the main festival, for the /tickets
  // "Pick your event" page. Every field below — names, dates, copy, CTA
  // labels — is a placeholder stand-in until the chapter finalises this
  // year's satellite-event lineup; edit them here before publishing rather
  // than hunting through components for hardcoded event copy.
  //
  // The flagship event itself (DevFest 2026) is NOT in this list — TicketsList
  // builds that card from the `date`/`venue`/`ticketing` fields above plus
  // ticketCta(), so its date and "Get tickets" link stay real instead of a
  // copy here that can drift out of sync.
  subEvents: [
    {
      slug: "code-for-communities",
      title: "Code for communities",
      date: "2026-08-29",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
    {
      slug: "ai-for-science",
      title: "AI for Science",
      date: "2026-09-05",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
    {
      slug: "road-to-idex",
      title: "Road to IDeX",
      date: "2026-09-15",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
    {
      slug: "devfest-on-campus",
      title: "DevFest on Campus",
      date: "2026-09-30",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
    {
      slug: "build-with-ai-wtm",
      title: "Build with AI - WTM edition",
      date: "2026-08-29",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
    {
      slug: "hardware-tinkering-labs",
      title: "Hardware Tinkering Labs",
      date: "2026-09-05",
      description:
        "The big brown fox jumped over the lazy dog. The big brown fox jumped over the lazy dog.",
      ctaLabel: "Coming soon",
    },
  ] satisfies SubEvent[],

  whatYoullGet: [
    { title: "Talks", description: "Hear from some of the best minds out there as they talk about real stories and projects." },
    { title: "Networking", description: "Not your average social media connections. Real networking, projects, careers and collaborations." },
    { title: "Workshops", description: "Hands-on sessions — bring a laptop, leave with working code." },
    { title: "Community", description: "Join us as we celebrate the community while you find your tribe here." },
  ],

  // Four reasons, stated still — see architecture doc on cutting the 12-item marquee.
  whyJoinUs: [
    "The largest single-day developer gathering in Chennai.",
    "Speakers from product teams, not just conference circuits.",
    "Direct line to companies hiring developers in Chennai right now.",
    "Run entirely by volunteers from the local GDG chapter.",
  ],

  cfp: {
    // `null` renders "Opening soon" — set ISO timestamps once dates are locked.
    opensAt: null as string | null,
    closesAt: null as string | null,
    formUrl: null as string | null,
  },

  social: {
    x: "https://x.com/gdgchennai",
    linkedin: "https://www.linkedin.com/company/gdg-chennai",
    instagram: "https://www.instagram.com/gdgchennai",
    youtube: "https://www.youtube.com/@GDGChennai",
    github: "https://github.com/gdg-chennai",
    discord: "https://discord.com/invite/eSyuFW3ywQ",
  },

  contact: {
    email: "hello@gdgchennai.in",
  },

  // Header nav lived here as its own five-item list while the site had nine
  // routes. It now comes from `navRoutes` in lib/routes.ts, which is the one
  // list the 404's rescue grid reads too.

  brandDisclaimer:
    "DevFest Chennai is an independent, community-run event organised by GDG Chennai under Google's Community Guidelines. It is not produced or endorsed by Google.",
} as const;

// Sponsor tiers lived here until 2026 dropped sponsorship. See the
// architecture doc if they come back — nothing else referenced them.

export function formatEventDate(date: string | null): string {
  if (!date) return "Date to be announced";
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    // Without this the build server's zone decides the day. Vercel builds in
    // UTC, and any negative-offset zone renders a date-only string as the day
    // before. See EVENT_TIME_ZONE.
    timeZone: EVENT_TIME_ZONE,
  });
}

/** "Oct 17, 2026" — abbreviated month, day, comma, year. en-US, not en-IN:
 *  en-IN orders day before month with no comma ("17 Oct 2026"); en-US is
 *  what actually produces this "Mon DD, YYYY" pattern. */
export function shortEventDate(date: string | null): string {
  if (!date) return "Date to be announced";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });
}
