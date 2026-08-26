import { EVENT_TIME_ZONE } from "@/lib/format";

export type Track = {
  slug: string;
  name: string;
  description: string;
};

export type TicketProfile = { key: string; label: string };

export type TicketTier = {
  /** Matches a `TicketProfile.key` below — picking that profile brings this
   *  tier to the front of the stack on /tickets/select. */
  profileKey: string;
  title: string;
  price: number;
  currency: string;
  features: string[];
  addOnsNote: string;
  /** A brand pastel Tailwind class (e.g. "bg-blue-pastel") — see the "do not
   *  hand-mix new shades" note in globals.css. */
  color: string;
  /** Where "Buy ticket" goes — an external checkout link until a real
   *  payment flow exists, same reasoning as `cfp.formUrl` below. */
  href: string;
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
    // Sold through our own /tickets page — no external ticketing platform.
    // `ticketCta()` in lib/cta.ts always points here now, so every "Get
    // Tickets" CTA site-wide (hero, header, ticket stub, 404 highlights,
    // ShowMoodSection) lands on a real page rather than an unset external
    // URL. The label stays here, not hardcoded in lib/cta.ts, so every
    // editable piece of copy lives in one place (same reasoning as
    // `subEvents` below).
    href: "/tickets",
    availableLabel: "Get Tickets →",
  },

  // The /tickets/select page's ticket picker. "I'm a ___" chooses which
  // entry in `tiers` rises to the front of the stack; "and I identify as
  // ___" is demographic data collected alongside the purchase and doesn't
  // change which ticket is shown. Every price/feature/checkout-link lives
  // here so a new tier or a price change never touches the component.
  ticketSelector: {
    taxNote: "Taxes and payment gateway charges additional",
    profiles: [
      { key: "professional", label: "Working Professional" },
      { key: "student", label: "Student" },
    ] satisfies TicketProfile[],
    identities: ["Female", "Male", "Non binary", "Prefer not to say"],
    tiers: [
      {
        profileKey: "professional",
        title: "Working professionals",
        price: 1200,
        currency: "₹",
        features: ["Access to all talks", "Access to lounges", "Lunch and Snacks"],
        addOnsNote: "Add-ons sold separately",
        color: "bg-blue-pastel",
        // TODO: swap for the real checkout link once one exists — google.com
        // is just a placeholder that actually resolves, so the tear/redirect
        // animation in TicketCard has something real to navigate to.
        href: "#",
      },
      {
        profileKey: "student",
        title: "Students",
        price: 600,
        currency: "₹",
        features: ["Access to all talks", "Access to lounges"],
        addOnsNote: "Add-ons sold separately",
        color: "bg-yellow-pastel",
        // TODO: swap for the real checkout link once one exists — google.com
        // is just a placeholder that actually resolves, so the tear/redirect
        // animation in TicketCard has something real to navigate to.
        href: "#",
      },
    ] satisfies TicketTier[],
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
    // Every "Submit CFP" CTA site-wide goes straight here, in a new tab —
    // see speakerCta() in lib/cta.ts, which every consumer reads through.
    // There's no local CFP page/form to fall back to (see lib/routes.ts's
    // retiredRoutes["/cfp"]), so unlike ticketing this isn't nullable.
    formUrl: "https://sessionize.com/gdgchennai",
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
