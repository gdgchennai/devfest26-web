import agendaData from "@/content/agenda.json";
import speakersData from "@/content/speakers.json";
import sponsorsData from "@/content/sponsors.json";
import faqData from "@/content/faq.json";
import aboutData from "@/content/about.json";
import cocData from "@/content/coc.json";
import archiveData from "@/content/archive.json";
import {
  agendaSchema,
  speakerSchema,
  sponsorSchema,
  faqItemSchema,
  archivePhotoSchema,
  type AgendaSession,
  type Speaker,
  type Sponsor,
  type FaqItem,
  type ArchivePhoto,
} from "@/lib/schemas";
import { z } from "zod";

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid content in ${label}: ${result.error.message}`);
  }
  return result.data;
}

export const agenda: AgendaSession[] = parseOrThrow(agendaSchema, agendaData, "content/agenda.json");
export const speakers: Speaker[] = parseOrThrow(z.array(speakerSchema), speakersData, "content/speakers.json");
export const sponsors: Sponsor[] = parseOrThrow(z.array(sponsorSchema), sponsorsData, "content/sponsors.json");
export const faq: FaqItem[] = parseOrThrow(z.array(faqItemSchema), faqData, "content/faq.json");
export const archivePhotos: ArchivePhoto[] = parseOrThrow(
  z.array(archivePhotoSchema),
  archiveData,
  "content/archive.json",
);
export const about = aboutData as { body: string };
export const codeOfConduct = cocData as {
  isPlaceholder: boolean;
  sections: { heading: string; body: string }[];
};

export function getSpeaker(slug: string): Speaker | undefined {
  return speakers.find((s) => s.slug === slug);
}

export function sponsorsByTier(tier: Sponsor["tier"]): Sponsor[] {
  return sponsors.filter((s) => s.tier === tier);
}
