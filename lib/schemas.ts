import { z } from "zod";

export const trackSlugSchema = z.enum([
  "d7-auditorium",
  "d7-amphitheater",
  "agent-wars",
  "lightning",
  "vibe-coding",
  "raman-hall",
  "pitchathon",
  "creators-lounge",
  "meetup-lounge",
]);

export const agendaSessionSchema = z.object({
  /** Stable per-session identifier (slugified from the title, de-duplicated
   *  where titles repeat, e.g. "lunch-2"). What a speaker's `talkIds`
   *  references — the one way to point at a specific session without
   *  duplicating its title/track/abstract elsewhere. */
  id: z.string().min(1),
  /** Null for venue-wide sessions (e.g. check-in) that belong to no single
   *  track — shown on every track's timeline, but only once in the flat list. */
  track: trackSlugSchema.nullable(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  title: z.string().min(1),
  /** Usually one speaker, occasionally two or three for a co-presented talk —
   *  always an array, empty when the session has no speaker (breaks, the
   *  keynote before it's announced, etc.). */
  speakerSlugs: z.array(z.string().min(1)),
  hall: z.string().min(1),
  type: z.enum(["talk", "workshop", "competition", "lounge", "keynote", "break", "panel"]),
  /** Shown as the abstract on the spatial agenda board's spotlight card.
   *  Optional — most sessions don't have one yet, and "TBA" placeholder copy
   *  reads worse than just omitting the paragraph. */
  description: z.string().optional(),
});

export type AgendaSession = z.infer<typeof agendaSessionSchema>;

export const agendaSchema = z.array(agendaSessionSchema);

export const speakerSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  bio: z.string(),
  photo: z.string().nullable(),
  links: z.object({
    twitter: z.string().nullable(),
    instagram: z.string().nullable().default(null),
    linkedin: z.string().nullable(),
    github: z.string().nullable(),
  }),
  /** References into agenda.json's `id`s rather than duplicating title/track/
   *  abstract here — a speaker can be credited on more than one session, and
   *  the agenda entry stays the one source of truth for what it's actually
   *  called, which track it's on and its description. Resolved via
   *  `findTalksForSpeaker` (lib/find-speaker.ts). */
  talkIds: z.array(z.string().min(1)).default([]),
});

export type Speaker = z.infer<typeof speakerSchema>;

export const archivePhotoSchema = z.object({
  src: z.string(),
  title: z.string(),
  description: z.string(),
  year: z.union([z.literal(2024), z.literal(2025)]),
  // Intrinsic pixel size of the file in public/archive. Carried in content so
  // the hallway can shape each card to its real ratio on the first frame —
  // measuring via img.onLoad instead would reflow every card mid-scroll.
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  // Filename of the camera original in assets/. Written by `npm run archive`
  // so re-runs know which photos are already ingested; nothing renders it.
  source: z.string().optional(),
  /**
   * Which half of the hero a photo belongs to. `hallway` photos fly past the
   * camera; `stack` photos are the destination waiting at the end of the tunnel
   * and must be a disjoint set — the stack is visible from the first frame, so
   * a photo cannot both be approaching and already have gone by.
   */
  role: z.enum(["hallway", "stack"]).default("hallway"),
});

export type ArchivePhoto = z.infer<typeof archivePhotoSchema>;
