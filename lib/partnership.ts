/**
 * The /partner page's content, in one place — read by both the React page
 * (app/partner/page.tsx) and its markdown twin (partnerMarkdown() in
 * lib/markdown.ts), the same single-source rule the rest of lib/markdown.ts
 * follows. Prose that would otherwise be typed into JSX lives here so a wording
 * change is a one-file edit and the HTML and markdown can't drift apart.
 *
 * The dated windows are real ISO dates run through shortEventDate() at render,
 * never hand-typed display strings — same convention as SubEvent.date.
 */
import { siteConfig, shortEventDate } from "@/site.config";

/** "Sep 5 – Oct 10, 2026" — a compact window for the timeline. The year sits
 *  once, on the end date, when both fall in the same year. */
function dateWindow(startISO: string, endISO: string): string {
  const end = shortEventDate(endISO);
  const start = shortEventDate(startISO);
  const sameYear = startISO.slice(0, 4) === endISO.slice(0, 4);
  return `${sameYear ? start.replace(/,\s*\d{4}$/, "") : start} – ${end}`;
}

/** Shown wherever an asset link isn't filled in yet. */
export const ASSET_PENDING = "Shared with confirmed partners.";

export const partnership = {
  heading: "Community Partnership",
  lede: `${siteConfig.name} is a movement across the tech communities in and around Chennai, not a single event. Partner with ${siteConfig.chapter} and we grow together.`,

  what: {
    heading: "What this is",
    body: [
      `A community-to-community partnership between ${siteConfig.chapter}, who organise ${siteConfig.name}, and other tech communities, meetups and student groups. You help spread the word about DevFest; we back you and your community with passes, discounts, stage time and more.`,
      "It isn't a sponsorship deal. It's communities helping communities grow.",
    ],
  },

  why: {
    heading: "Why partner",
    intro: "DevFest is bigger than one day. Teaming up with other groups lets us:",
    points: [
      "Reach people who'd never otherwise hear about DevFest",
      "Build real community-to-community ties, not one-off event hype",
      "Give smaller and local meetups a platform, and some love back",
      "Make Chennai's tech ecosystem a little more connected",
    ],
    outro: "If you run a community, meetup or student group, this is a way to grow together instead of everyone working in a silo.",
  },

  asks: {
    heading: "What we ask of partners",
    items: [
      {
        title: "Promote the event",
        body: "Spread the word about DevFest Chennai to your community, through whichever channels work for you — group chats, newsletters, socials.",
      },
      {
        title: "Host a Roadshow",
        note: "optional, but great if you can",
        body: "A Roadshow is any event, planned or already on your calendar, that features DevFest as a brand. Add DevFest branding and a mention to your own meetup, or plan something around it.",
      },
      {
        title: "Social media shoutouts",
        body: "When you post about your event or meetup:",
        points: [
          "Use the official hashtags",
          "Add the DevFest Chennai Roadshow logo to your event page, banners and posters",
          "Share photos and details after the event too, not just before",
        ],
      },
      {
        title: "Nominations",
        note: "optional",
        body: "Want your members more involved? You can nominate volunteers and speakers. We review each one for fit — see the fine print below.",
      },
      {
        title: "Follow the Code of Conduct",
        body: "Everything under this partnership — your Roadshow, DevFest itself, every collab activity — runs under our Code of Conduct.",
        link: { label: "Read the Code of Conduct", href: siteConfig.codeOfConduct.url },
      },
    ],
  },

  benefits: {
    heading: "What partners get",
    items: [
      { lead: "Complimentary passes for organisers", detail: "At least two for your core organising team." },
      { lead: "Discounted DevFest tickets", detail: "For your community members and attendees." },
      { lead: "F&B support for your meetup or Roadshow", detail: "Case by case — depends on scale and logistics." },
      { lead: "Goodies and giveaways for Roadshow attendees", detail: "If you host one. Case by case." },
      { lead: "A main stage feature", detail: "During DevFest we recognise your community and your Roadshow from the main stage, in front of everyone." },
      { lead: "Speaker and volunteer opportunities", detail: "Your nominated folks get a real shot at being part of DevFest." },
    ],
  },

  finePrint: {
    heading: "Good to know",
    intro: "So expectations are clear on both sides:",
    points: [
      "F&B support and giveaways aren't guaranteed — we evaluate case by case, depending on the event, its scale, and what we have available.",
      "Nominations aren't automatic — submitting one doesn't mean selection. Our team reviews and decides.",
      "The main stage feature is recognition and a shoutout, not a guaranteed speaking slot for your community.",
      "Roadshow activities need to fall inside the timeline below — anything outside that window doesn't count.",
      "Use the branding as we provide it — don't modify the logo or use it out of context.",
    ],
  },

  timeline: {
    heading: "Timeline",
    rows: [
      { activity: "Roadshow events", window: dateWindow("2026-09-05", "2026-10-10") },
      { activity: "Volunteer nominations", window: dateWindow("2026-09-01", "2026-09-15") },
      { activity: "Speaker nominations", window: dateWindow("2026-09-01", "2026-09-20") },
    ],
    note: "Plan your Roadshow and nominations inside these dates — we can't take submissions outside the window.",
  },

  assets: {
    heading: "Assets",
    intro: "Everything you need to represent DevFest Chennai. Fill-ins arrive once you're a confirmed partner.",
    // `href` present → the label links to it. Absent → ASSET_PENDING copy.
    items: [
      { label: "DevFest Chennai logo", href: null as string | null },
      { label: "Official hashtags", href: null as string | null },
      { label: "Code of Conduct", href: siteConfig.codeOfConduct.url },
    ],
  },

  contact: {
    heading: "Questions?",
    body: `Reach the ${siteConfig.chapter} organising team about anything in this doc.`,
    email: siteConfig.contact.email,
  },
} as const;
