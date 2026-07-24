export type Track = {
  slug: string;
  name: string;
  description: string;
};

export type NavItem = {
  label: string;
  href: string;
};

export const siteConfig = {
  name: "DevFest Chennai 2026",
  shortName: "DevFest Chennai",
  chapter: "GDG Chennai",
  tagline: "Build. Learn. Connect",

  // `null` renders "Date to be announced" everywhere this is read from.
  // Set to an ISO string once the organising team confirms it.
  date: null as string | null,

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
    { title: "Hiring", description: "Meet teams that are actively hiring at the sponsor booths." },
    { title: "Workshops", description: "Hands-on sessions — bring a laptop, leave with working code." },
    { title: "Community", description: "Meet the Chennai developer community behind the chapter." },
  ],

  // Four reasons, stated still — see architecture doc on cutting the 12-item marquee.
  whyJoinUs: [
    "The largest single-day developer gathering in Chennai.",
    "Speakers from product teams, not just conference circuits.",
    "Direct line to sponsors who are hiring in Chennai right now.",
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

  nav: [
    { label: "Home", href: "/" },
    { label: "Agenda", href: "/agenda" },
    { label: "Speakers", href: "/speakers" },
    { label: "Venue", href: "/venue" },
    { label: "About", href: "/about" },
  ] satisfies NavItem[],

  brandDisclaimer:
    "DevFest Chennai is an independent, community-run event organised by GDG Chennai under Google's Community Guidelines. It is not produced or endorsed by Google.",
} as const;

export function formatEventDate(date: string | null): string {
  if (!date) return "Date to be announced";
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
