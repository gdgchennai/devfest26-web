import "server-only";
import { getDb } from "@/lib/db";
import { newPushSubscriptionId } from "@/lib/id";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Stores a subscription, or refreshes its keys if the endpoint already exists
 *  (the browser re-subscribed, e.g. after the old key pair expired). */
export async function saveSubscription(userId: string, sub: PushSubscriptionRecord): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
    .bind(newPushSubscriptionId(), userId, sub.endpoint, sub.p256dh, sub.auth, Date.now())
    .run();
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
}

export async function listSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .all<PushSubscriptionRecord>();
  return results;
}

export async function listAllSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions")
    .all<PushSubscriptionRecord>();
  return results;
}

export async function hasSubscription(userId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first();
  return row !== null;
}
