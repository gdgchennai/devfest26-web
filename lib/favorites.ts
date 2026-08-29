import "server-only";
import { getDb } from "@/lib/db";

/** All session keys this user has starred. */
export async function listFavorites(userId: string): Promise<string[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT session_key FROM favorites WHERE user_id = ? ORDER BY created_at")
    .bind(userId)
    .all<{ session_key: string }>();
  return results.map((r) => r.session_key);
}

export async function addFavorite(userId: string, sessionKey: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      "INSERT INTO favorites (user_id, session_key, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    )
    .bind(userId, sessionKey, Date.now())
    .run();
}

export async function removeFavorite(userId: string, sessionKey: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare("DELETE FROM favorites WHERE user_id = ? AND session_key = ?")
    .bind(userId, sessionKey)
    .run();
}

export async function countFavorites(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
