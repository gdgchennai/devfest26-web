import "server-only";
import { getDb } from "@/lib/db";

let tableEnsured = false;
async function ensureTable(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (tableEnsured) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS session_recommendations (
          session_key TEXT PRIMARY KEY,
          updated_at  INTEGER NOT NULL,
          updated_by  TEXT
        )`,
      )
      .run();
    tableEnsured = true;
  } catch {
    // Ignore in case table exists or DB is temporarily unavailable
  }
}

/**
 * Returns a Set of all active recommended session keys.
 */
export async function getRecommendedSessionKeys(): Promise<Set<string>> {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { results } = await db
      .prepare("SELECT session_key FROM session_recommendations")
      .all<{ session_key: string }>();
    return new Set(results.map((r) => r.session_key));
  } catch {
    return new Set();
  }
}

/**
 * Sets or removes a session recommendation in D1.
 */
export async function setSessionRecommended(
  sessionKey: string,
  recommended: boolean,
  userId?: string | null,
): Promise<void> {
  const db = await getDb();
  await ensureTable(db);

  if (recommended) {
    await db
      .prepare(
        `INSERT INTO session_recommendations (session_key, updated_at, updated_by)
         VALUES (?, ?, ?)
         ON CONFLICT(session_key) DO UPDATE SET
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
      )
      .bind(sessionKey, Date.now(), userId ?? null)
      .run();
  } else {
    await db
      .prepare("DELETE FROM session_recommendations WHERE session_key = ?")
      .bind(sessionKey)
      .run();
  }
}
