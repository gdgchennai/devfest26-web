import { requireAccessApi, canManageSession } from "@/lib/admin";
import { getAgenda } from "@/lib/content";
import { sessionKey as keyFor } from "@/lib/session-key";
import { setSessionRecommended } from "@/lib/recommendations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireAccessApi();
  if (access instanceof Response) return access;

  const body = (await req.json().catch(() => null)) as {
    sessionKey?: unknown;
    recommended?: unknown;
  } | null;

  const key = body?.sessionKey;
  const recommended = body?.recommended;

  if (typeof key !== "string" || typeof recommended !== "boolean") {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const agenda = await getAgenda();
  const session = agenda.find((s) => keyFor(s) === key);
  if (!session) return Response.json({ error: "unknown session" }, { status: 400 });

  // Admins and track leads only act on their own tracks' sessions.
  if (!canManageSession(access, session.track)) {
    return Response.json({ error: "not your track" }, { status: 403 });
  }

  await setSessionRecommended(key, recommended, access.user.id);

  return Response.json({ ok: true, recommended });
}
