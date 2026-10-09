import { auth } from "@/auth";
import { saveSubscription, removeSubscription } from "@/lib/push-subscriptions";

export const runtime = "nodejs";

async function requireUid(): Promise<string | Response> {
  const session = await auth();
  if (!session?.user?.uid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return session.user.uid;
}

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function readSubscription(body: SubscriptionBody | null) {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return null;
  }
  return { endpoint, p256dh, auth };
}

export async function POST(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const sub = readSubscription(body);
  if (!sub) return Response.json({ error: "invalid subscription" }, { status: 400 });
  await saveSubscription(uid, sub);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") return Response.json({ error: "invalid endpoint" }, { status: 400 });
  await removeSubscription(endpoint);
  return Response.json({ ok: true });
}
