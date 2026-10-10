import "server-only";
import { getDb } from "@/lib/db";

export type SessionStatus = "upcoming" | "started" | "ended";

/** session_key -> status, for every session anyone has ever set (sessions
 *  never set default to "upcoming" in the caller, not represented here). */
export async function getSessionStatuses(): Promise<Record<string, SessionStatus>> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT session_key, status FROM session_status")
    .all<{ session_key: string; status: SessionStatus }>();
  return Object.fromEntries(results.map((r) => [r.session_key, r.status]));
}

export async function setSessionStatus(sessionKey: string, status: SessionStatus): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO session_status (session_key, status, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(session_key) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    )
    .bind(sessionKey, status, Date.now())
    .run();
}
