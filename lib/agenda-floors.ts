import type { Floor, Track } from "@/site.config";

/**
 * Which floor the agenda is showing. An explicit, valid `?floor=` wins; else
 * the floor that owns the requested `?track=`; else the first floor.
 */
export function resolveFloor(floors: readonly Floor[], floorParam: string | null, trackParam: string | null): Floor {
  const byParam = floors.find((f) => f.slug === floorParam);
  if (byParam) return byParam;
  const byTrack = floors.find((f) => trackParam !== null && f.tracks.includes(trackParam));
  return byTrack ?? floors[0];
}

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
export function floorNameForTrack(floors: readonly Floor[], trackSlug: string): string | null {
  return floors.find((f) => f.tracks.includes(trackSlug))?.name ?? null;
}
