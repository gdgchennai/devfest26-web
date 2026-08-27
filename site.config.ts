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
   *  pre-formatted here. It used to be a hand-typed display string ("Sep 5,
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
    { slug: "tech", name: "Tech", description: "General tech talks." },
    { slug: "deep tech", name: "Deep Tech", description: "Tech in Science, Math, Hardware." },
    { slug: "experience", name: "Experience", description: "Open lounges for anyone to experince building and creating with AI" },
    { slug: "competition", name: "Competition", description: "Competition zones for humans and AI agents." },
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
      slug: "kug-virtual",
      title: "KUG Virtual meetup",
      date: "2026-09-05",
      description:
        "Join KUG's virtual meetup to learn what's new in Android and Kotlin",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "ai-for-science",
      title: "AI for Science",
      date: "2026-09-13",
      description:
        "Learn how AI impacts fields beyond tech. Explore how science is evolving with AI",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "react-chennai",
      title: "React Chennai meetup",
      date: "2026-09-19",
      description:
        "React did not disappear. Come join to learn what's going on within React",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "code-for-communities",
      title: "Code for communities",
      date: "2026-09-19",
      description:
        "Hackathon styled dev sprint. Build solutions for Resilience, Innovation, Sustainability and Cooperation.",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "bwai-cyber",
      title: "Build with AI: Cyber Security edition",
      date: "2026-09-26",
      description:
        "Learn about building security and privacy into agentic systems.",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "kug-irl",
      title: "KUG meetup",
      date: "2026-09-26",
      description:
        "Connect and learn with the Kotlin Community of Chennai.",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "army-exclusive",
      title: "Android and AI for the Indian Army",
      date: "2026-10-03",
      description:
        "Enabling our protectors, protect their data.",
      ctaLabel: "Not open to public",
    },
    {
      slug: "build-with-ai-wtm",
      title: "Build with AI - WTM edition",
      date: "2026-10-03",
      description:
        "Women come, learn, build and talk about AI.",
      ctaLabel: "Coming soon →",
    },
    {
      slug: "devfest-on-campus",
      title: "DevFest on Campus",
      date: "2026-10-10",
      description:
        "Bringing the DevFest spirit to campus.",
      ctaLabel: "Coming soon →",
    },
  ] satisfies SubEvent[],

  whatYoullGet: [
    { title: "Roadshows", description: "Catch a DevFest Roadshow near you. A month long celebration hosted across the city." },
    { title: "Build sessions", description: "Come, vibe, build, share your projects with an amazing audience." },
    { title: "Competitions", description: "Bring your A game to our favorite competitions ranging from pitchathons to CTFs." },
    { title: "Talks", description: "Hear from some of the best minds out there as they talk about real stories and projects." },
    { title: "Networking", description: "Not your average social media connections. Real networking, projects, careers and collaborations." },
    { title: "Community", description: "Join us as we celebrate the community while you find your tribe here." },
  ],

  cfp: {
    // Every "Submit CFP" CTA site-wide goes straight here, in a new tab —
    // see speakerCta() in lib/cta.ts, which every consumer reads through.
    // There's no local CFP page/form to fall back to (see lib/routes.ts's
    // retiredRoutes["/cfp"]), so unlike ticketing this isn't nullable.
    formUrl: "https://sessionize.com/gdgchennai",
  },

  codeOfConduct: {
    // No local /code-of-conduct page any more (see lib/routes.ts's
    // retiredRoutes entry for visitors who still land on the old URL) —
    // every "Code of Conduct" link site-wide (the footer) goes straight to
    // Google's own GDG Code of Conduct instead of a local copy that would
    // need to be kept in sync with it by hand.
    url: "https://developers.google.com/events/gdd-india/code-of-conduct",
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

/**
 * Every other piece of button/label/heading/body copy that isn't part of
 * `siteConfig` above — page headings, aria-labels, button text, section
 * copy. Before this existed, this was the last category of user-facing
 * text still typed directly into JSX across app/ and components/, which
 * meant a wording change meant grepping the whole tree instead of editing
 * one file. Grouped by the component/page that reads it, in the same shape
 * as that component's own props/locals, so a given file's section here
 * reads like a copy of what it renders.
 *
 * A handful of strings that are the exact same words in more than one
 * component live under `common` instead of being typed out twice (and, in
 * the case of `getTicketsLabel`/`portraitAltPrefix`/`venueAlt`, a couple of
 * these were ALREADY drifting apart before this existed — see their own
 * comments below).
 */
export const uiCopy = {
  common: {
    /** Ticket Stub and Hero Copy both render this as "<chapter> presents". */
    chapterPresents: `${siteConfig.chapter} presents`,
    /** TicketStub and StaticHero's mono venue line both append this when
     *  `siteConfig.venue.confirmed` is false. */
    unconfirmedSuffix: " · unconfirmed",
    /** TicketsList's flagship card and VenueReveal's static-baseline photo
     *  both use this same alt text for the venue photo. */
    venueAlt: `${siteConfig.venue.name}, the DevFest Chennai venue`,
    /** The speaker-detail page, SpeakerWall and AgendaBoard's session card
     *  all build a portrait's alt text as this prefix + the speaker's name. */
    portraitAltPrefix: "Portrait of ",
    /** CurvedMarqueeHero's and VenueReveal's "Get tickets" CTAs — kept as one
     *  shared string specifically because these two had quietly drifted to
     *  identical text independently; ShowMoodSection's own ticket CTA reads
     *  differently ("← Get tickets", see showMoodSection below) and is not
     *  this. */
    getTicketsLabel: "Get tickets →",
  },

  /** X/Instagram/LinkedIn/YouTube/GitHub/Discord display names — shared by
   *  Footer's site-wide social row (siteConfig.social) and the per-speaker
   *  social links on the speaker detail page (speaker.links). */
  socialLabels: {
    x: "X",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    github: "GitHub",
    discord: "Discord",
  },

  header: {
    navAriaLabel: "Primary",
  },

  hamburgerMenu: {
    homeAriaLabel: "Go to homepage",
    openAriaLabel: "Open menu",
    closeAriaLabel: "Close menu",
    panelAriaLabel: "Site menu",
    cfpLabel: "Submit CFP",
  },

  footer: {
    codeOfConductLabel: "Code of Conduct",
  },

  footerLogo: {
    alt: "DevFest Chennai",
  },

  errorPage: {
    eyebrow: "Something went wrong",
    heading: "This page hit an error.",
    body: "The rest of the site is fine — retry this page, or head somewhere else.",
    retryLabel: "Try again",
    homeLabel: "Back home",
  },

  globalErrorPage: {
    eyebrow: "Something went wrong",
    heading: "DevFest Chennai hit an unexpected error.",
    body: "Please try again in a moment.",
    retryLabel: "Try again",
  },

  agendaPage: {
    heading: "Agenda",
  },

  contactPage: {
    heading: "Contact",
    bodyPrefix:
      "Questions about DevFest Chennai 2026 — sponsorship, speaking, volunteering, or anything else? Reach the ",
    bodySuffix: " organising team directly.",
  },

  memoriesPage: {
    heading: "Memories",
    body: "Moments from DevFest Chennai 2024 and 2025.",
  },

  speakersPage: {
    heading: "Speakers",
    cfpOpenBody: "The 2026 lineup is being finalised. The call for proposals is how you get on it.",
    moreToComeBody: "More speakers still to be announced.",
  },

  notFoundPage: {
    statusLabel: "404",
    heading: "Page not found.",
    whatMostPeopleWantHeading: "What most people are looking for",
    everywhereElseHeading: "Everywhere else on the site",
    whileYoureHere: "While you’re here",
    archiveBlurb: "The 2024 and 2025 archive is the one part of this site that was never going to 404.",
    closing: "Hope to see you at DevFest.",
    highlights: {
      agendaEyebrow: "The day",
      agendaTitle: "Agenda",
      agendaDescription: "Four tracks, one day. The full schedule as it firms up.",
      ticketsEyebrow: "Get in",
      ticketsDescription: "Book your place at DevFest Chennai 2026.",
      speakingEyebrow: "Get on stage",
      speakingTitle: "Speak at DevFest",
      speakingDescription: "First-time speakers as welcome as conference regulars.",
    },
    recovery: {
      fallbackPreviousPageLabel: "the previous page",
      triedLabel: "tried",
      suggestionFoundBody: "That address doesn't exist, but one very close to it does.",
      nothingFoundBody:
        "That link is either out of date or was never a page here — but you're in the right place. Here's what most people come for.",
      goToPrefix: "Go to ",
      backHomeLabel: "Back home",
      backToPrefix: "← Back to ",
    },
  },

  speakerWall: {
    inviteLabel: "This could be you",
    inviteSrLabel: "submit a talk to the call for proposals",
  },

  agendaBoard: {
    previousSessionSr: "Previous session",
    nextSessionSr: "Next session",
    previousEyebrow: "Previous",
    upNextEyebrow: "Up next",
    liveNowLabel: "Live now",
  },

  agenda: {
    onNowLabel: "On now",
  },

  agendaTimeline: {
    viewFullAgendaLabel: "View full agenda →",
  },

  agendaView: {
    allTracksLabel: "All",
  },

  ticketSelector: {
    heading: "Get your tickets now",
    imAPrompt: "I'm a",
    identifyPrompt: "and I identify as",
    buyTicketLabel: "Buy ticket",
    placeholderPrompt: "Pick your details above to find the right ticket",
  },

  ticketStub: {
    dateFieldLabel: "Date",
    venueFieldLabel: "Venue",
    tbaDate: "TBA",
    admitOneLabel: "Admit one",
  },

  ticketsList: {
    heading: "Pick your event",
    flagshipDescriptionPrefix: "The flagship day — ",
    flagshipDescriptionMiddle: "'s main event at ",
    flagshipDescriptionSuffix: ".",
    previousEventSr: "Previous event",
    nextEventSr: "Next event",
    mainEventLabel: "Main event",
  },

  heroCopy: {
    agendaLabel: "See Agenda →",
  },

  liteToggle: {
    label: "Lite version",
    onLabel: "on",
    offLabel: "off",
  },

  loader: {
    introAriaSuffix: " intro",
    readyStatus: "Ready.",
    loadingStatusPrefix: "Loading ",
    loadingStatusSuffix: "…",
    enterCtaLabel: "Enter the DevFest experience →",
    switchToLiteLabel: "I don't like animations →",
    desktopHint: "Best experienced in Desktop/wide screens",
  },

  memoriesHallway: {
    scrollHint: "Scroll",
  },

  scrollCue: {
    nextCardLabel: "Next card",
    previousCardLabel: "Previous card",
    scrollToNextSectionLabel: "Scroll to next section",
    previousSectionLabel: "Previous section",
  },

  expectShowcase: {
    heading: "About DevFest",
    previousCardSr: "Previous card",
    nextCardSr: "Next card",
  },

  readySection: {
    lines: ["Get ready to join the", "biggest tech festival.", "Hosted by GDG Chennai."],
  },

  moodSection: {
    heading: "What’s your DevFest mood?",
  },

  seeYouThereSection: {
    heading: "See you there!",
    links: [{ label: "Join the conversation →" }, { label: "Become a Partner →" }],
  },

  showMoodSection: {
    presentTitle: "Present",
    presentBody:
      "Got crazy ideas or you built something so cool. Vibe coding? Hard core engineering? Stunning Design? Leadership guides? Bring your main character energy to our stage. Share your wisdom with our vibrant community!",
    attendTitle: "Attend",
    attendBody:
      "Join in for the premier DevFest experience. Meet like minded folks. Developer? PM? Designer? Product? Marketing? Management? Student? Find your tribe here! We provide you the space and technology. You build for and build with the community!",
    cfpLinkLabel: "Submit CFP →",
    ticketLinkLabel: "← Get tickets",
  },

  staticHero: {
    switchToFullExperienceLabel: "Switch to the full experience →",
  },

  venueReveal: {
    roadshowsText: "Roadshows and Meetups from Sep 5th onwards",
    disclaimerText: "Note: Roadshow and meetup venues differ and tickets sold separately.",
    locationHeading: "Location",
    saveTheDateHeading: "Save the Date",
    getDirectionsLabel: "Get directions →",
  },
} as const;

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
