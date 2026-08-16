import agendaData from "@/content/agenda.json";
import speakersData from "@/content/speakers.json";
import cocData from "@/content/coc.json";
import archiveData from "@/content/archive.json";
import {
  agendaSchema,
  speakerSchema,
  archivePhotoSchema,
  type AgendaSession,
  type Speaker,
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
export const archivePhotos: ArchivePhoto[] = parseOrThrow(
  z.array(archivePhotoSchema),
  archiveData,
  "content/archive.json",
);

/** Photos that fly past the camera in the hero tunnel. */
export const hallwayPhotos: ArchivePhoto[] = archivePhotos.filter((p) => p.role === "hallway");

/** Photos waiting at the end of it. Disjoint from the above by construction. */
export const stackPhotos: ArchivePhoto[] = archivePhotos.filter((p) => p.role === "stack");
export const codeOfConduct = cocData as {
  isPlaceholder: boolean;
  sections: { heading: string; body: string }[];
};

export function getSpeaker(slug: string): Speaker | undefined {
  return speakers.find((s) => s.slug === slug);
}
