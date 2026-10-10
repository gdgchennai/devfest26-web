import type { Floor, Track } from "@/site.config";

/** The floor's tracks, in the floor's own display order. */
export function floorTracks(floor: Floor, tracks: readonly Track[]): Track[] {
  return floor.tracks.flatMap((slug) => tracks.filter((t) => t.slug === slug));
}
