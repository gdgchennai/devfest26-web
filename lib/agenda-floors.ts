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
