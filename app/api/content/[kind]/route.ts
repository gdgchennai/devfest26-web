import { NextResponse } from "next/server";
import {
  CONTENT_CACHE_CONTROL,
  getAgenda,
  getArchivePhotos,
  getSpeakers,
  type ContentKind,
} from "@/lib/content";

export const dynamic = "force-dynamic";

const KINDS = new Set<ContentKind>(["agenda", "speakers", "archive"]);

function json(data: unknown) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": CONTENT_CACHE_CONTROL,
      "CDN-Cache-Control": CONTENT_CACHE_CONTROL,
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind as ContentKind)) {
    return NextResponse.json({ error: "unknown content" }, { status: 404 });
  }

  switch (kind as ContentKind) {
    case "agenda":
      return json(await getAgenda());
    case "speakers":
      return json(await getSpeakers());
    case "archive":
      return json(await getArchivePhotos());
  }
}
