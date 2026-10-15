import { requireAccessApi, isAdminEmail, grantableTracks } from "@/lib/admin";
import { getUserById } from "@/lib/users";
import { listRolesForUser, setTrackRole, type TrackRole } from "@/lib/track-roles";
import { siteConfig } from "@/site.config";

export const runtime = "nodejs";

const ROLES: readonly TrackRole[] = ["admin", "track_lead"];

/** Set one user's role on one track: `{ userId, track, role }`, `role: null` removes it. */
export async function POST(req: Request) {
  const me = await requireAccessApi();
  if (me instanceof Response) return me;

  const body = (await req.json().catch(() => null)) as { userId?: unknown; track?: unknown; role?: unknown } | null;
  const { userId, track, role } = body ?? {};
  if (
    typeof userId !== "string" ||
    typeof track !== "string" ||
    !siteConfig.tracks.some((t) => t.slug === track) ||
    !(role === null || (typeof role === "string" && ROLES.includes(role as TrackRole)))
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  // The rule that keeps scoped admins scoped: you can only grant (or take
  // away) a role on a track you are admin of. Track leads can't grant at all.
  if (!grantableTracks(me).includes(track)) {
    return Response.json({ error: "you can't manage roles on that track" }, { status: 403 });
  }
  if (userId === me.user.id) {
    return Response.json({ error: "can't change your own role" }, { status: 400 });
  }

  const target = await getUserById(userId);
  if (!target) return Response.json({ error: "unknown user" }, { status: 400 });
  if (await isAdminEmail(target.email)) {
    return Response.json({ error: "super admins are managed via ADMIN_EMAILS" }, { status: 400 });
  }

  await setTrackRole(userId, track, role as TrackRole | null, me.isSuper ? null : me.user.id);
  return Response.json({ ok: true, roles: await listRolesForUser(userId) });
}
