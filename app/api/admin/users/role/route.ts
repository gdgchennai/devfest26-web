import { requireAdminApi, isAdminEmail } from "@/lib/admin";
import { getUserById, setUserAdmin } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const body = (await req.json().catch(() => null)) as { userId?: unknown; isAdmin?: unknown } | null;
  const userId = body?.userId;
  const nextIsAdmin = body?.isAdmin;
  if (typeof userId !== "string" || typeof nextIsAdmin !== "boolean") {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const target = await getUserById(userId);
  if (!target) return Response.json({ error: "unknown user" }, { status: 400 });

  // ADMIN_EMAILS already grants this account admin regardless of the DB flag
  // — flipping is_admin for it would silently do nothing, which reads as a
  // bug from the UI. Block it with a clear reason instead.
  if (await isAdminEmail(target.email)) {
    return Response.json({ error: "managed via ADMIN_EMAILS, not editable here" }, { status: 400 });
  }

  // Never let an admin remove their own access from this screen — the only
  // way back in would be another admin, or ADMIN_EMAILS.
  if (userId === admin.id && !nextIsAdmin) {
    return Response.json({ error: "can't remove your own admin access" }, { status: 400 });
  }

  await setUserAdmin(userId, nextIsAdmin);
  return Response.json({ ok: true, isAdmin: nextIsAdmin });
}
