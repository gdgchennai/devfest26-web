/**
 * Markdown variants of the site's pages, served at /md/* and reached at the
 * canonical URL via content negotiation — a Cloudflare Transform Rule rewrites
 * a request to `/md<path>` when `Accept: text/markdown` is present (see
 * docs/markdown-negotiation.md). Built straight from the same content sources
 * the React pages render from (site.config.ts, content/*.json via
 * lib/content.ts) rather than by converting rendered HTML, since there's no
 * reliable way to turn arbitrary JSX back into clean markdown.
 */
import { siteConfig, formatEventDate, shortEventDate } from "@/site.config";
import { agenda, speakers, getSpeaker } from "@/lib/content";
import { formatSessionTime } from "@/lib/format";
import { AGENDA_READY, siteRoutes } from "@/lib/routes";
import { partnership, ASSET_PENDING } from "@/lib/partnership";
import type { Speaker } from "@/lib/schemas";

function frontMatter(title: string): string {
  return `# ${title}\n\n> Machine-readable version of ${siteConfig.url}. See ${siteConfig.url}/llms.txt for a full site overview.\n\n`;
}

export function homeMarkdown(): string {
  const lines = [
    frontMatter(siteConfig.name),
    `${siteConfig.tagline} — the flagship annual conference from ${siteConfig.chapter}.`,
    "",
    `- Date: ${formatEventDate(siteConfig.date)}`,
    `- Venue: ${siteConfig.venue.name}, ${siteConfig.venue.line1}, ${siteConfig.venue.line2}`,
    `- Tickets: ${siteConfig.url}${siteConfig.ticketing.href}`,
    "",
    "## Tracks",
    "",
    ...siteConfig.tracks.map((t) => `- **${t.name}**: ${t.description}`),
    "",
    "## Pages",
    "",
    ...siteRoutes
      .filter((r) => !r.noIndex)
      .map((r) => `- [${r.label}](${siteConfig.url}${r.href}): ${r.description}`),
  ];
  return lines.join("\n") + "\n";
}

export function agendaMarkdown(): string {
  if (!AGENDA_READY) {
    return frontMatter("Agenda") + "The schedule is still being finalised. Check back closer to the event.\n";
  }

  const byTrack = new Map<string, typeof agenda>();
  for (const session of agenda) {
    byTrack.set(session.track, [...(byTrack.get(session.track) ?? []), session]);
  }

  const lines = [frontMatter(`Agenda — ${siteConfig.name}`), `${formatEventDate(siteConfig.date)} · ${siteConfig.venue.name}`, ""];

  for (const track of siteConfig.tracks) {
    const sessions = byTrack.get(track.slug);
    if (!sessions?.length) continue;
    lines.push(`## ${track.name}`, "");
    for (const session of sessions) {
      const speaker = session.speakerSlug ? getSpeaker(session.speakerSlug) : undefined;
      const time = `${formatSessionTime(session.start)}–${formatSessionTime(session.end)}`;
      const by = speaker ? ` — ${speaker.name}, ${speaker.title} at ${speaker.company}` : "";
      lines.push(`- **${time}** (${session.hall}) ${session.title}${by}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function speakerSummary(speaker: Speaker): string {
  const talk = speaker.talk ? ` — speaking on "${speaker.talk.title}"` : "";
  return `- [${speaker.name}](${siteConfig.url}/speakers/${speaker.slug}), ${speaker.title} at ${speaker.company}${talk}`;
}

export function speakersMarkdown(): string {
  const lines = [frontMatter(`Speakers — ${siteConfig.name}`)];
  if (!AGENDA_READY || speakers.length === 0) {
    lines.push(
      "The 2026 lineup is being finalised.",
      "",
      `Call for proposals: ${siteConfig.cfp.formUrl}`,
    );
  } else {
    lines.push(...speakers.map(speakerSummary));
  }
  return lines.join("\n") + "\n";
}

export function speakerMarkdown(slug: string): string | undefined {
  const speaker = getSpeaker(slug);
  if (!speaker) return undefined;

  const lines = [
    frontMatter(speaker.name),
    `${speaker.title} at ${speaker.company}`,
    "",
    speaker.bio,
  ];

  if (speaker.talk) {
    lines.push("", `## Talk: ${speaker.talk.title}`, "", speaker.talk.abstract, "", `Track: ${speaker.talk.track}`);
  }

  const links = Object.entries(speaker.links).filter(([, url]) => url);
  if (links.length) {
    lines.push("", "## Links", "", ...links.map(([label, url]) => `- ${label}: ${url}`));
  }

  return lines.join("\n") + "\n";
}

export function ticketsMarkdown(): string {
  const lines = [
    frontMatter(`Tickets — ${siteConfig.name}`),
    `The flagship day — ${formatEventDate(siteConfig.date)} at ${siteConfig.venue.name}.`,
    "",
    `Tickets are sold **exclusively through KonfHub**, from ${siteConfig.url}${siteConfig.ticketing.href}. There is no other authorised seller.`,
    "",
    "## Flagship tickets",
    "",
    ...siteConfig.ticketSelector.tickets.map((t) => {
      const who = t.audience === "women-diverse" ? " — for women & diverse groups" : "";
      return `- **${t.name}**${who}: ${t.currency}${t.price}. On sale ${shortEventDate(t.opens)} to ${shortEventDate(t.closes)}.`;
    }),
    "",
    `${siteConfig.ticketSelector.taxNote}. ${siteConfig.ticketSelector.addOnsNote}.`,
    "",
    "## Community events",
    "",
    ...siteConfig.subEvents.map((e) => `- **${e.title}** (${shortEventDate(e.date)}): ${e.description}`),
  ];
  return lines.join("\n") + "\n";
}

export function partnerMarkdown(): string {
  const p = partnership;
  const lines = [frontMatter(`${p.heading} — ${siteConfig.name}`), p.lede, ""];

  lines.push(`## ${p.what.heading}`, "", ...p.what.body.flatMap((para) => [para, ""]));

  lines.push(`## ${p.why.heading}`, "", p.why.intro, "", ...p.why.points.map((pt) => `- ${pt}`), "", p.why.outro, "");

  lines.push(`## ${p.asks.heading}`, "");
  p.asks.items.forEach((item, i) => {
    const note = "note" in item && item.note ? ` _(${item.note})_` : "";
    lines.push(`${i + 1}. **${item.title}**${note} — ${item.body}`);
    if ("points" in item && item.points) lines.push(...item.points.map((pt) => `   - ${pt}`));
    if ("link" in item && item.link) lines.push(`   - [${item.link.label}](${item.link.href})`);
    lines.push("");
  });

  lines.push(`## ${p.benefits.heading}`, "", ...p.benefits.items.map((b) => `- **${b.lead}** — ${b.detail}`), "");

  lines.push(`## ${p.finePrint.heading}`, "", p.finePrint.intro, "", ...p.finePrint.points.map((pt) => `- ${pt}`), "");

  lines.push(
    `## ${p.timeline.heading}`,
    "",
    "| Activity | Window |",
    "|---|---|",
    ...p.timeline.rows.map((r) => `| ${r.activity} | ${r.window} |`),
    "",
    p.timeline.note,
    "",
  );

  lines.push(
    `## ${p.assets.heading}`,
    "",
    p.assets.intro,
    "",
    ...p.assets.items.map((a) => (a.href ? `- [${a.label}](${a.href})` : `- **${a.label}**: ${ASSET_PENDING}`)),
    "",
  );

  lines.push(`## ${p.contact.heading}`, "", `${p.contact.body} ${p.contact.email}`);

  return lines.join("\n") + "\n";
}
