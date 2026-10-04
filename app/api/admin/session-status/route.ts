import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAgenda } from "@/lib/content";
import { sessionKey as keyFor } from "@/lib/session-key";
import { setSessionStatus, type SessionStatus } from "@/lib/session-status";
import { listUserIdsForSession } from "@/lib/favorites";
import { sendPushToUsers } from "@/lib/push";

export const runtime = "nodejs";

const STATUSES: readonly SessionStatus[] = ["upcoming", "started", "ended"];

async function requireAdmin(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.uid) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdminEmail(session.user.email))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { sessionKey?: unknown; status?: unknown } | null;
  const key = body?.sessionKey;
  const status = body?.status;
  if (typeof key !== "string" || typeof status !== "string" || !STATUSES.includes(status as SessionStatus)) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const agenda = await getAgenda();
  const session = agenda.find((s) => keyFor(s) === key);
  if (!session) return Response.json({ error: "unknown session" }, { status: 400 });

  await setSessionStatus(key, status as SessionStatus);

  // Only "started"/"ended" are worth a push — "upcoming" is just an undo.
  if (status === "started" || status === "ended") {
    const userIds = await listUserIdsForSession(key);
    if (userIds.length > 0) {
      await sendPushToUsers(userIds, {
        title: session.title,
        body: status === "started" ? "This session just started." : "This session just ended.",
        url: "/my-agenda",
      });
    }
  }

  return Response.json({ ok: true, status });
}
