/**
 * The /creators page's copy, in one place — read by both the React page
 * (components/creators/CreatorsContent.tsx) and its markdown twin (creatorsMarkdown() in
 * lib/markdown.ts), the same split as lib/partnership.ts. Edit the words here and both
 * follow; before this, the copy lived only in the JSX and a twin would have been a second
 * hand-typed copy to keep in step.
 *
 * `**double asterisks**` mark bold. They render as <strong> on the page and are already
 * Markdown for the twin. Plain data, no imports — safe for a client component and the server.
 */
export const creators = {
  eyebrow: "GDG Chennai Presents",
  title: "DEVFEST CHENNAI 2026",
  tagline: "Build. Secure. Scale.",
  dateLine: "17 October 2026 · IIT Madras Research Park · Chennai",

  heading: "An Invitation to Creators",
  intro: {
    paragraphs: [
      "DevFest Chennai is a community-led technology conference by **Google Developer Group Chennai (GDG Chennai)**, a non-profit developer community supported by Google for the past **15 years**. This year, we're bringing together developers, builders, creators and curious minds to explore how technology and AI are changing the way we build, create and work.",
      "And we believe content creators are an important part of that conversation.",
      "AI has touched almost every kind of work, and content creation is no different. From ideation and scripting to videography, editing, design and publishing, creators are finding new ways to use AI in their everyday workflows.",
    ],
    highlight: "We'd love to bring those experiences into our community.",
  },

  why: {
    heading: "Why Join us?",
    lede: "We want to give our community a chance to hear the real creator perspective.",
    questions: [
      "How did you start using AI?",
      "What changed in the way you create?",
      "Which tools actually make a difference?",
      "What still needs a human touch?",
      "And how do you see content creation evolving as AI becomes a bigger part of the process?",
    ],
    closing:
      "Your story, experiences and perspective can help developers and community members see AI from a completely different angle.",
  },

  join: {
    heading: "What You Can Do at DevFest?",
    joinUs: {
      title: "Join Us",
      body: "We'd be happy to invite you to DevFest Chennai 2026 and provide your event ticket. Come experience the event, meet the community and be part of the conversations happening throughout the day.",
    },
    lounge: {
      title: "Creator Lounge",
      body: "We're creating a dedicated **Creator Lounge**, a space for creators and the community to hang out, connect and have some fun.",
      listLabel: "The lounge could include:",
      items: [
        "Creator and community meet-ups",
        "Fun activities and interactive sessions",
        "Casual conversations around AI and content",
        "Creator stories and experiences",
        "Opportunities to connect with developers and builders",
      ],
    },
  },

  together: {
    heading: "Create Something Together",
    highlight: "We're also open to ideas.",
    body: "If you have an activity, mini-session, challenge, collaboration or something fun you'd like to do with the community, let's build it together. There doesn't need to be a fixed format. We'd love to hear what you think would make the experience interesting for both creators and the community.",
  },

  bigger: {
    heading: "The Bigger Idea",
    highlight: "Build. Secure. Scale. isn't just about software.",
    body: "It's about how all of us are adapting to a world where technology and AI are becoming part of how we work and create.",
    closer: "Creators are builders too.",
  },

  closing: {
    body: "We'd love to bring your perspective into the room and give the community a chance to learn from how you build, create and use AI every day.",
    heading: "We'd love to have you at DevFest 2026 Chennai. 🚀",
    date: "17 October 2026",
    venue: "IIT Madras Research Park, Chennai",
    links: [
      { label: "DevFest Chennai: devfest.gdgchennai.in", href: "https://devfest.gdgchennai.in" },
      { label: "GDG Chennai: gdg.community.dev/gdg-chennai/", href: "https://gdg.community.dev/gdg-chennai/" },
    ],
  },
} as const;
