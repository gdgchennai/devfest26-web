import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { getUserById, type UserRecord } from "@/lib/users";

/** Comma-separated organizer emails from ADMIN_EMAILS (see
 *  docs/environment.md) — the bootstrap allow-list. It always grants admin
 *  regardless of the DB `is_admin` flag, so whoever controls the deploy's
 *  secrets can never be locked out by a DB change made from /admin/users. */
async function adminEmails(): Promise<Set<string>> {
  const { env } = await getCloudflareContext({ async: true });
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const allowed = await adminEmails();
  return allowed.has(email.toLowerCase());
}

/** The full admin check: ADMIN_EMAILS (env) OR the DB `is_admin` flag. Use
 *  this everywhere except the one place env-only matters (deciding whether a
 *  user's admin status *came from* the env list, e.g. to disable the toggle
 *  for them in /admin/users). */
export async function isAdminUser(user: Pick<UserRecord, "email" | "is_admin"> | null): Promise<boolean> {
  if (!user) return false;
  if (await isAdminEmail(user.email)) return true;
  return user.is_admin === 1;
}

/** Signed-in + admin, or null. Fetches the user row once so callers get both
 *  the admin verdict and the row (for `is_admin`-sourced UI decisions) without
 *  querying twice. */
export async function currentAdminUser(uid: string | undefined): Promise<UserRecord | null> {
  if (!uid) return null;
  const user = await getUserById(uid);
  if (!user || !(await isAdminUser(user))) return null;
  return user;
}

/** Shared gate for every /api/admin/** route: the admin's own row on success,
 *  or the 401/403 Response to return as-is. */
export async function requireAdminApi(): Promise<UserRecord | Response> {
  const session = await auth();
  if (!session?.user?.uid) return Response.json({ error: "unauthorized" }, { status: 401 });
  const admin = await currentAdminUser(session.user.uid);
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  return admin;
}
