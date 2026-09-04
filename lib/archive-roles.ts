import type { ArchivePhoto } from "@/lib/schemas";

/** Split archive photos for the hallway vs destination stack. Safe for client. */
export function hallwayPhotosFrom(photos: ArchivePhoto[]): ArchivePhoto[] {
  return photos.filter((p) => p.role === "hallway");
}

export function stackPhotosFrom(photos: ArchivePhoto[]): ArchivePhoto[] {
  return photos.filter((p) => p.role === "stack");
}
