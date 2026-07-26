import { EVENT_TIME_ZONE } from "@/lib/format";

export type Track = {
  slug: string;
  name: string;
  description: string;
};

export const siteConfig = {
  name: "DevFest Chennai 2026",
  shortName: "DevFest Chennai",
  chapter: "GDG Chennai",
  tagline: "Build. Learn. Connect",

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
  date: "2026-10-10" as string | null,

  venue: {
    name: "IITM Research Park",
    // Carried over from the 2025 site — confirm before publishing for real.
    confirmed: false,
    line1: "IITM Research Park, Kanagam Road",
    line2: "Taramani, Chennai 600113",
    mapUrl: "https://maps.google.com/?q=IIT+Madras+Research+Park+Taramani+Chennai",
  },

  capacityClaim: null as string | null, // e.g. "1500+ developers" — update with 2025's real number

  ticketing: {
    // Same platform as 2025 (KonfHub); URL is new for 2026 and still pending.
    url: null as string | null,
    platform: "KonfHub",
  },

  agendaUrl: "/agenda",

  tracks: [
    { slug: "ai", name: "AI", description: "Machine learning, generative AI, and applied ML in production." },
    { slug: "cloud", name: "Cloud", description: "Cloud-native architecture, infra, and platform engineering." },
    { slug: "mobile", name: "Mobile", description: "Android, iOS, and cross-platform app development." },
    { slug: "web", name: "Web", description: "Frontend frameworks, performance, and the modern web platform." },
  ] satisfies Track[],

  whatYoullGet: [
    { title: "Talks", description: "Sessions across four tracks from practitioners building at scale." },
    // Reworded when 2026 dropped sponsorship: there are no sponsor booths.
    { title: "Hiring", description: "Meet engineering teams who are actively hiring, in person." },
    { title: "Workshops", description: "Hands-on sessions — bring a laptop, leave with working code." },
    { title: "Community", description: "Meet the Chennai developer community behind the chapter." },
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
    discord: null as string | null,
  },

  contact: {
    email: "chennai@gdgchennai.org",
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
