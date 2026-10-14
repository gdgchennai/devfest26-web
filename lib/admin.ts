import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { siteConfig } from "@/site.config";
import { getUserById, type UserRecord } from "@/lib/users";
import { listRolesForUser, type TrackRole } from "@/lib/track-roles";

/**
 * Three levels of access, all resolved here:
 *
 *  - **super admin** — an `ADMIN_EMAILS` (env) account. Every track, can grant
 *    anything, can never be locked out by a DB change. Not stored in the DB.
 *  - **admin** (per track) — manages that track's sessions, sees the whole
 *    People list, and can grant `admin` / `track_lead` on that track — never
 *    on a track they aren't admin of.
 *  - **track lead** (per track) — marks that track's sessions started/ended.
 *    No People list, no promoting.
 *
 * The legacy `users.is_admin` flag (migration 0013) is no longer read.
 */
export type Access = {
  user: UserRecord;
  isSuper: boolean;
  /** Track slug → the role this user holds on it. Empty for a super admin
   *  (who needs no rows); use the helpers below rather than reading it. */
  roles: ReadonlyMap<string, TrackRole>;
};

/** Comma-separated organizer emails from ADMIN_EMAILS (see docs/environment.md). */
async function adminEmails(): Promise<Set<string>> {
  const { env } = await getCloudflareContext({ async: true });
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

/** True for a super admin (ADMIN_EMAILS). Their access isn't editable in-app. */
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return (await adminEmails()).has(email.toLowerCase());
}

/** Signed-in with any access, or null. Fetches the user and their grants once. */
export async function getAccess(uid: string | undefined): Promise<Access | null> {
  if (!uid) return null;
  const user = await getUserById(uid);
  if (!user) return null;
  const isSuper = await isAdminEmail(user.email);
  const grants = isSuper ? [] : await listRolesForUser(user.id);
  if (!isSuper && grants.length === 0) return null;
  return { user, isSuper, roles: new Map(grants.map((g) => [g.track, g.role])) };
}

const ALL_TRACKS: readonly string[] = siteConfig.tracks.map((t) => t.slug);

/** Tracks whose sessions this person can mark started/ended. */
export function manageableTracks(a: Access): readonly string[] {
  return a.isSuper ? ALL_TRACKS : [...a.roles.keys()];
}

/** Venue-wide sessions have no track — only a super admin can change those. */
export function canManageSession(a: Access, track: string | null): boolean {
  if (a.isSuper) return true;
  return track !== null && a.roles.has(track);
}

/** Tracks this person can grant roles on: all of them for a super admin, else
 *  the ones they are `admin` (not just lead) of. */
export function grantableTracks(a: Access): readonly string[] {
  if (a.isSuper) return ALL_TRACKS;
  return [...a.roles].filter(([, role]) => role === "admin").map(([track]) => track);
}

export function canViewPeople(a: Access): boolean {
  return grantableTracks(a).length > 0;
}

/** Shared gate for every /api/admin/** route: the caller's access on success,
 *  or the 401/403 Response to return as-is. */
export async function requireAccessApi(): Promise<Access | Response> {
  const session = await auth();
  if (!session?.user?.uid) return Response.json({ error: "unauthorized" }, { status: 401 });
  const access = await getAccess(session.user.uid);
  if (!access) return Response.json({ error: "forbidden" }, { status: 403 });
  return access;
}
