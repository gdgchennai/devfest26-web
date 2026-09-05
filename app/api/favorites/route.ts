import { auth } from "@/auth";
import { getAgenda } from "@/lib/content";
import { sessionKey } from "@/lib/session-key";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";

export const runtime = "nodejs";

async function requireUid(): Promise<string | Response> {
  const session = await auth();
  if (!session?.user?.uid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return session.user.uid;
}

async function readKey(req: Request, validKeys: Set<string>): Promise<string | null> {
  const body = (await req.json().catch(() => null)) as { sessionKey?: unknown } | null;
  const key = body?.sessionKey;
  return typeof key === "string" && validKeys.has(key) ? key : null;
}

export async function GET() {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  return Response.json({ favorites: await listFavorites(uid) });
}

export async function POST(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const agenda = await getAgenda();
  const key = await readKey(req, new Set(agenda.map(sessionKey)));
  // Only keys that name a real session get written.
  if (!key) return Response.json({ error: "unknown session" }, { status: 400 });
  await addFavorite(uid, key);
  return Response.json({ favorites: await listFavorites(uid) });
}

export async function DELETE(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const agenda = await getAgenda();
  const key = await readKey(req, new Set(agenda.map(sessionKey)));
  // Only keys that name a real session get written.
  if (!key) return Response.json({ error: "unknown session" }, { status: 400 });
  await removeFavorite(uid, key);
  return Response.json({ favorites: await listFavorites(uid) });
}
