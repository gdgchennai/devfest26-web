import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpeaker, speakers } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig, uiCopy } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return AGENDA_READY ? speakers.map((speaker) => ({ slug: speaker.slug })) : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const speaker = getSpeaker(slug);
  if (!speaker) {
    return pageMetadata({ title: "Speaker", description: `Speaker at ${siteConfig.name}.`, path: `/speakers/${slug}`, index: false });
  }
  const role = [speaker.title, speaker.company].filter(Boolean).join(" at ");
  const talk = speaker.talk?.title ? ` Speaking on “${speaker.talk.title}”.` : "";
  return pageMetadata({
    title: speaker.name,
    description: `${speaker.name}, ${role}, at ${siteConfig.name}.${talk}`,
    path: `/speakers/${slug}`,
  });
}

export default async function SpeakerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const speaker = getSpeaker(slug);
  if (!AGENDA_READY || !speaker) notFound();

  const sameAs = [speaker.links.twitter, speaker.links.linkedin, speaker.links.github].filter(
    (href): href is string => Boolean(href),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
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
      <Frame
        src={speaker.photo}
        alt={`${uiCopy.common.portraitAltPrefix}${speaker.name}`}
        title={speaker.name}
        aspectRatio="1 / 1"
        sizes="(max-width: 640px) 100vw, 20rem"
        className="max-w-xs"
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{speaker.name}</h1>
      <p className="mt-1 text-paper/70">
        {speaker.title} · {speaker.company}
      </p>
      <p className="mt-6 text-paper/85">{speaker.bio}</p>

      {speaker.talk && (
        <div className="mt-8 rounded-lg border border-paper/10 p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-blue">{speaker.talk.track}</p>
          <h2 className="mt-1 text-xl font-semibold">{speaker.talk.title}</h2>
          <p className="mt-2 text-sm text-paper/70">{speaker.talk.abstract}</p>
        </div>
      )}

      <div className="mt-6 flex gap-4 text-sm">
        {speaker.links.twitter && (
          <a
            href={speaker.links.twitter}
            target="_blank"
            rel="noreferrer"
            className="text-blue underline underline-offset-4 hover:decoration-2"
          >
            {uiCopy.socialLabels.x}
          </a>
        )}
        {speaker.links.linkedin && (
          <a
            href={speaker.links.linkedin}
            target="_blank"
            rel="noreferrer"
            className="text-blue underline underline-offset-4 hover:decoration-2"
          >
            {uiCopy.socialLabels.linkedin}
          </a>
        )}
        {speaker.links.github && (
          <a
            href={speaker.links.github}
            target="_blank"
            rel="noreferrer"
            className="text-blue underline underline-offset-4 hover:decoration-2"
          >
            {uiCopy.socialLabels.github}
          </a>
        )}
      </div>
    </div>
  );
}
