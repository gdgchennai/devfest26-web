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

/** Update the user-chosen display name. Empty/blank clears it (falls back to
 *  the Google name). Trimmed and length-capped by the caller. */
export async function setDisplayName(id: string, displayName: string | null): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE users SET display_name = ? WHERE id = ?")
    .bind(displayName, id)
    .run();
}
