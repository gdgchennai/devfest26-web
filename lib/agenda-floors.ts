import type { Floor, Track } from "@/site.config";

/**
 * Which floor the agenda is showing. An explicit, valid `?floor=` wins; else
 * the floor that owns the requested `?track=`; else every floor at once.
 * `?floor=all` (or any value naming no real floor, or no params at all)
 * returns null — "every floor at once", the floor-side counterpart of
 * `?track=`'s own "all", and the simple view's default landing state.
 */
export function resolveFloor(floors: readonly Floor[], floorParam: string | null, trackParam: string | null): Floor | null {
  if (floorParam === "all") return null;
  const byParam = floors.find((f) => f.slug === floorParam);
  if (byParam) return byParam;
  const byTrack = floors.find((f) => trackParam !== null && f.tracks.includes(trackParam));
  return byTrack ?? null;
}

/** The floor's tracks, in the floor's own display order. */
export function floorTracks(floor: Floor, tracks: readonly Track[]): Track[] {
  return floor.tracks.flatMap((slug) => tracks.filter((t) => t.slug === slug));
}
