import "server-only";
import { getDb } from "@/lib/db";

export type TrackRole = "admin" | "track_lead";
export type TrackRoleGrant = { track: string; role: TrackRole };

export async function listRolesForUser(userId: string): Promise<TrackRoleGrant[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT track, role FROM user_track_roles WHERE user_id = ?")
    .bind(userId)
    .all<TrackRoleGrant>();
  return results;
}

/** Every grant, grouped by user — for the /admin/users list (one query, not one per row). */
export async function listAllRoles(): Promise<Map<string, TrackRoleGrant[]>> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT user_id, track, role FROM user_track_roles")
    .all<TrackRoleGrant & { user_id: string }>();
  const byUser = new Map<string, TrackRoleGrant[]>();
  for (const { user_id, track, role } of results) {
    byUser.set(user_id, [...(byUser.get(user_id) ?? []), { track, role }]);
  }
  return byUser;
}

/** Sets (or, with `role: null`, removes) one user's role on one track. */
export async function setTrackRole(
  userId: string,
  track: string,
  role: TrackRole | null,
  grantedBy: string | null,
): Promise<void> {
  const db = await getDb();
  if (role === null) {
    await db.prepare("DELETE FROM user_track_roles WHERE user_id = ? AND track = ?").bind(userId, track).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO user_track_roles (user_id, track, role, granted_by, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, track) DO UPDATE SET role = excluded.role, granted_by = excluded.granted_by`,
    )
    .bind(userId, track, role, grantedBy, Date.now())
    .run();
}
