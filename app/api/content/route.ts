import { NextResponse } from "next/server";
import { CONTENT_CACHE_CONTROL, getAgenda, getArchivePhotos, getSpeakers } from "@/lib/content";

export const dynamic = "force-dynamic";

/** Combined public dump — same payloads as the per-kind routes. */
export async function GET() {
  const [agenda, speakers, archive] = await Promise.all([getAgenda(), getSpeakers(), getArchivePhotos()]);
  return NextResponse.json(
    { agenda, speakers, archive },
    {
      headers: {
        "Cache-Control": CONTENT_CACHE_CONTROL,
        "CDN-Cache-Control": CONTENT_CACHE_CONTROL,
      },
    },
  );
}
