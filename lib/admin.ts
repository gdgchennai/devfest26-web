import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Comma-separated organizer emails from ADMIN_EMAILS (see
 *  docs/environment.md). No role column on `users` — this repo has no other
 *  concept of a privileged user, so an allow-list env var is the whole
 *  mechanism. Case-insensitive. */
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
