import { auth } from "@/auth";
import { agenda } from "@/lib/content";
import { sessionKey } from "@/lib/session-key";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";

export const runtime = "nodejs";

// Only keys that name a real session get written — a favorite for a made-up
// key is just junk in the table.
const VALID_KEYS = new Set(agenda.map(sessionKey));

async function requireUid(): Promise<string | Response> {
  const session = await auth();
  if (!session?.user?.uid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return session.user.uid;
}

async function readKey(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => null)) as { sessionKey?: unknown } | null;
  const key = body?.sessionKey;
  return typeof key === "string" && VALID_KEYS.has(key) ? key : null;
}

export async function GET() {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  return Response.json({ favorites: await listFavorites(uid) });
}

export async function POST(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const key = await readKey(req);
  if (!key) return Response.json({ error: "unknown session" }, { status: 400 });
  await addFavorite(uid, key);
  return Response.json({ favorites: await listFavorites(uid) });
}

export async function DELETE(req: Request) {
  const uid = await requireUid();
  if (uid instanceof Response) return uid;
  const key = await readKey(req);
  if (!key) return Response.json({ error: "unknown session" }, { status: 400 });
  await removeFavorite(uid, key);
  return Response.json({ favorites: await listFavorites(uid) });
}
