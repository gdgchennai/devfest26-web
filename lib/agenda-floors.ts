import type { Floor, Track } from "@/site.config";

/** The floor's tracks, in the floor's own display order. */
export function floorTracks(floor: Floor, tracks: readonly Track[]): Track[] {
  return floor.tracks.flatMap((slug) => tracks.filter((t) => t.slug === slug));
}

/**
 * The display name of the floor a track runs on ("D block 7th floor"), or
 * null when the track isn't on any configured floor. Derived from the TRACK,
 * not the hall string: halls like "F&B" carry no floor of their own, but
 * their sessions still belong to a track that does. Used to label each
 * agenda item's floor next to its hall.
 */
export function floorNameForTrack(floors: readonly Floor[], trackSlug: string | null): string | null {
  return floors.find((f) => trackSlug !== null && f.tracks.includes(trackSlug))?.name ?? null;
}
