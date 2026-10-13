import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgenda, getSpeaker, getSpeakers } from "@/lib/content";
import { ArrowGlyph } from "@/components/ArrowGlyph";
import { Frame } from "@/components/Frame";
import { GlowButton } from "@/components/GlowButton";
import { SocialIcon } from "@/components/SocialIcon";
import { SpeakerTalks } from "@/components/SpeakerTalks";
import { JsonLd } from "@/components/JsonLd";
import { findTalksForSpeaker } from "@/lib/find-speaker";
import { siteConfig, uiCopy } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  if (!AGENDA_READY) return [];
  const speakers = await getSpeakers();
  return speakers.map((speaker) => ({ slug: speaker.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const speaker = await getSpeaker(slug);
  if (!speaker) {
    return pageMetadata({ title: "Speaker", description: `Speaker at ${siteConfig.name}.`, path: `/speakers/${slug}`, index: false });
  }
  const role = [speaker.title, speaker.company].filter(Boolean).join(" at ");
  const agenda = await getAgenda();
  const firstTalk = findTalksForSpeaker(agenda, speaker)[0];
  const talk = firstTalk ? ` Speaking on “${firstTalk.title}”.` : "";
  return pageMetadata({
    title: speaker.name,
    description: `${speaker.name}, ${role}, at ${siteConfig.name}.${talk}`,
    path: `/speakers/${slug}`,
  });
}

/** `links` key -> the label `SocialIcon` and `uiCopy.socialLabels` key off. */
const SOCIAL_ORDER = [
  { key: "twitter", icon: "X", label: uiCopy.socialLabels.x },
  { key: "instagram", icon: "Instagram", label: uiCopy.socialLabels.instagram },
  { key: "linkedin", icon: "LinkedIn", label: uiCopy.socialLabels.linkedin },
  { key: "github", icon: "GitHub", label: uiCopy.socialLabels.github },
] as const;

export default async function SpeakerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [speaker, speakers, agenda] = await Promise.all([getSpeaker(slug), getSpeakers(), getAgenda()]);
  if (!AGENDA_READY || !speaker) notFound();

  const sameAs = [speaker.links.twitter, speaker.links.instagram, speaker.links.linkedin, speaker.links.github].filter(
    (href): href is string => Boolean(href),
  );
  const role = [speaker.title, speaker.company].filter(Boolean).join(" · ");
  const talks = findTalksForSpeaker(agenda, speaker);
  const socials = SOCIAL_ORDER.filter((s) => speaker.links[s.key]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
                { "@type": "ListItem", position: 2, name: "Speakers", item: absoluteUrl("/speakers") },
                { "@type": "ListItem", position: 3, name: speaker.name, item: absoluteUrl(`/speakers/${speaker.slug}`) },
              ],
            },
            {
              "@type": "Person",
              name: speaker.name,
              jobTitle: speaker.title,
              worksFor: { "@type": "Organization", name: speaker.company },
              description: speaker.bio,
              url: absoluteUrl(`/speakers/${speaker.slug}`),
              ...(speaker.photo ? { image: speaker.photo.startsWith("http") ? speaker.photo : `${siteConfig.url}${speaker.photo}` } : {}),
              ...(sameAs.length > 0 ? { sameAs } : {}),
            },
          ],
        }}
      />

      <Link
        href="/speakers"
        className="mb-6 inline-flex items-center gap-2 text-sm text-paper/70 transition-colors hover:text-paper"
      >
        <ArrowGlyph direction="left" />
        {uiCopy.speakersPage.heading}
      </Link>

      <div className="grid gap-10 sm:grid-cols-[18rem_1fr]">
        <div className="mx-auto w-full max-w-xs sm:mx-0">
          <Frame
            src={speaker.photo}
            alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
            title={speaker.name}
            aspectRatio="1 / 1"
            sizes="(max-width: 640px) 100vw, 18rem"
          />
          <h1 className="mt-5 text-2xl font-semibold">{speaker.name}</h1>
          {role ? <p className="mt-1 text-base text-paper/70">{role}</p> : null}

          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map((s) => (
                <GlowButton
                  key={s.key}
                  href={speaker.links[s.key]!}
                  target="_blank"
                  rel="noreferrer"
                  shape="circle"
                  size="sm"
                >
                  <span className="sr-only">{s.label}</span>
                  <SocialIcon name={s.icon} className="relative h-5 w-5 fill-paper" />
                </GlowButton>
              ))}
            </div>
          )}
        </div>

        <div>
          {speaker.bio ? <p className="whitespace-pre-line text-paper/85">{speaker.bio}</p> : null}
          <SpeakerTalks
            talks={talks}
            speakers={speakers}
            speakerSlug={speaker.slug}
            heading={uiCopy.speakerWall.talksHeading}
          />
        </div>
      </div>
    </div>
  );
}
