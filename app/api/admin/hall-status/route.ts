import { requireAccessApi, canManageSession } from "@/lib/admin";
import { updateHallStatus, type OccupancyStatus } from "@/lib/hall-status";
import { siteConfig } from "@/site.config";

export const runtime = "nodejs";

const VALID_STATUSES: readonly OccupancyStatus[] = ["available", "filling_fast", "houseful"];

export async function POST(req: Request) {
  const me = await requireAccessApi();
  if (me instanceof Response) return me;

  const body = (await req.json().catch(() => null)) as {
    track?: unknown;
    occupancyStatus?: unknown;
    headcount?: unknown;
    delta?: unknown;
    announcement?: unknown;
  } | null;

  const { track, occupancyStatus, headcount, delta, announcement } = body ?? {};

  if (typeof track !== "string" || !siteConfig.tracks.some((t) => t.slug === track)) {
    return Response.json({ error: "Invalid track slug" }, { status: 400 });
  }

  // Ensure caller has access to manage this track
  if (!canManageSession(me, track)) {
    return Response.json({ error: "Forbidden: You cannot manage this track" }, { status: 403 });
  }

  if (
    occupancyStatus !== undefined &&
    !(typeof occupancyStatus === "string" && VALID_STATUSES.includes(occupancyStatus as OccupancyStatus))
  ) {
    return Response.json({ error: "Invalid occupancy status" }, { status: 400 });
  }

  if (headcount !== undefined && (typeof headcount !== "number" || headcount < 0)) {
    return Response.json({ error: "Invalid headcount" }, { status: 400 });
  }

  if (delta !== undefined && typeof delta !== "number") {
    return Response.json({ error: "Invalid delta" }, { status: 400 });
  }

  if (announcement !== undefined && announcement !== null && typeof announcement !== "string") {
    return Response.json({ error: "Invalid announcement" }, { status: 400 });
  }

  const updated = await updateHallStatus(
    track,
    {
      occupancyStatus: occupancyStatus as OccupancyStatus | undefined,
      headcount: typeof headcount === "number" ? headcount : undefined,
      delta: typeof delta === "number" ? delta : undefined,
      announcement: typeof announcement === "string" || announcement === null ? announcement : undefined,
    },
    me.isSuper ? null : me.user.id,
  );

  return Response.json({ ok: true, hall: updated });
}
