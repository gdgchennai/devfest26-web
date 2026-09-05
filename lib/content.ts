import "server-only";
import agendaFile from "@/content/agenda.json";
import speakersFile from "@/content/speakers.json";
import archiveFile from "@/content/archive.json";
import { getDb } from "@/lib/db";
import {
  agendaSchema,
  speakerSchema,
  archivePhotoSchema,
  type AgendaSession,
  type Speaker,
  type ArchivePhoto,
} from "@/lib/schemas";
import { z } from "zod";

export type ContentKind = "agenda" | "speakers" | "archive";

const speakersSchema = z.array(speakerSchema);
const archiveSchema = z.array(archivePhotoSchema);

const FILE_FALLBACK: Record<ContentKind, unknown> = {
  agenda: agendaFile,
  speakers: speakersFile,
  archive: archiveFile,
};

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid content in ${label}: ${result.error.message}`);
  }
  return result.data;
}

/** Don't let a hung D1 binding stall HTML (especially `next dev` / cold Worker). */
const D1_BUDGET_MS = 2000;

async function readDocument(kind: ContentKind): Promise<unknown> {
  const fromD1 = (async (): Promise<unknown | null> => {
    try {
      const db = await getDb();
      const row = await db.prepare("SELECT payload FROM content_documents WHERE kind = ?").bind(kind).first<{ payload: string }>();
      return row?.payload ? (JSON.parse(row.payload) as unknown) : null;
    } catch {
      return null;
    }
  })();
  const timedOut = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), D1_BUDGET_MS);
  });
  const payload = await Promise.race([fromD1, timedOut]);
  return payload ?? FILE_FALLBACK[kind];
}

export async function getAgenda(): Promise<AgendaSession[]> {
  return parseOrThrow(agendaSchema, await readDocument("agenda"), "agenda");
}

export async function getSpeakers(): Promise<Speaker[]> {
  return parseOrThrow(speakersSchema, await readDocument("speakers"), "speakers");
}

export async function getArchivePhotos(): Promise<ArchivePhoto[]> {
  return parseOrThrow(archiveSchema, await readDocument("archive"), "archive");
}

export async function getSpeaker(slug: string): Promise<Speaker | undefined> {
  const speakers = await getSpeakers();
  return speakers.find((s) => s.slug === slug);
}

export { hallwayPhotosFrom, stackPhotosFrom } from "@/lib/archive-roles";

export const CONTENT_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";
