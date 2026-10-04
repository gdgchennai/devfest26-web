import "server-only";
import { getDb } from "@/lib/db";
import { newUserId } from "@/lib/id";

export type UserRecord = {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  image: string | null;
  display_name: string | null;
  created_at: number;
  /** DB-granted admin role, set from /admin/users. See lib/admin.ts — the
   *  ADMIN_EMAILS env allow-list is a separate, always-wins bootstrap. */
  is_admin: number;
};

/**
 * Find the account for a Google `sub`, creating one on first sign-in. Returns
 * the row so the caller can stamp our own `id` onto the session token.
 */
export async function upsertUserByGoogle(profile: {
  sub: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<UserRecord> {
  const db = await getDb();

  const existing = await db
    .prepare("SELECT * FROM users WHERE google_sub = ?")
    .bind(profile.sub)
    .first<UserRecord>();

  if (existing) {
    // Keep the Google-sourced fields fresh, but never touch display_name.
    await db
      .prepare("UPDATE users SET email = ?, name = ?, image = ? WHERE id = ?")
      .bind(profile.email ?? null, profile.name ?? null, profile.image ?? null, existing.id)
      .run();
    return {
      ...existing,
      email: profile.email ?? null,
      name: profile.name ?? null,
      image: profile.image ?? null,
    };
  }

  const row: UserRecord = {
    id: newUserId(),
    google_sub: profile.sub,
    email: profile.email ?? null,
    name: profile.name ?? null,
    image: profile.image ?? null,
    display_name: null,
    created_at: Date.now(),
    is_admin: 0,
  };

  await db
    .prepare(
      "INSERT INTO users (id, google_sub, email, name, image, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.google_sub, row.email, row.name, row.image, row.display_name, row.created_at)
    .run();

  return row;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const db = await getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRecord>();
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE users SET is_admin = ? WHERE id = ?")
    .bind(isAdmin ? 1 : 0, userId)
    .run();
}

/**
 * Every account, with its ticket name resolved the same way the profile page
 * resolves one (an explicit ticket_claims link wins, else a direct email
 * match) — but batched into three queries total instead of one-per-user, for
 * the /admin/users list. `null` means no ticket found under either path.
 */
export async function listUsersWithTicketNames(): Promise<Array<UserRecord & { ticket_name: string | null }>> {
  const db = await getDb();
  const [usersResult, ticketsResult, claimsResult] = await Promise.all([
    db.prepare("SELECT * FROM users ORDER BY created_at DESC").all<UserRecord>(),
    db.prepare("SELECT email, ticket_name FROM tickets").all<{ email: string; ticket_name: string | null }>(),
    db.prepare("SELECT user_id, ticket_email FROM ticket_claims").all<{ user_id: string; ticket_email: string }>(),
  ]);

  const ticketByEmail = new Map(ticketsResult.results.map((t) => [t.email.toLowerCase(), t.ticket_name]));
  const claimedEmailByUser = new Map(claimsResult.results.map((c) => [c.user_id, c.ticket_email.toLowerCase()]));

  return usersResult.results.map((user) => {
    const claimedEmail = claimedEmailByUser.get(user.id);
    const ticketName =
      (claimedEmail ? ticketByEmail.get(claimedEmail) : undefined) ??
      (user.email ? ticketByEmail.get(user.email.toLowerCase()) : undefined) ??
      null;
    return { ...user, ticket_name: ticketName };
  });
}
