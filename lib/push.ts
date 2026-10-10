import "server-only";
import { buildPushPayload, type PushSubscription as WebPushSubscription } from "@block65/webcrypto-web-push";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { siteConfig } from "@/site.config";
import {
  listAllSubscriptions,
  listSubscriptionsForUser,
  removeSubscription,
  type PushSubscriptionRecord,
} from "@/lib/push-subscriptions";

export type PushNotification = {
  title: string;
  body: string;
  /** Opened on click. Relative paths resolve against siteConfig.url. */
  url?: string;
};

async function vapidKeys() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PRIVATE_KEY is missing — see docs/environment.md");
  }
  return {
    subject: `mailto:${siteConfig.contact.email}`,
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

function toWebPushSubscription(sub: PushSubscriptionRecord): WebPushSubscription {
  return {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
}

/** Sends to one subscription; drops it from D1 if the push service reports it
 *  gone (user revoked permission, cleared site data, or uninstalled). */
async function sendToSubscription(sub: PushSubscriptionRecord, notification: PushNotification): Promise<void> {
  const vapid = await vapidKeys();
  const payload = await buildPushPayload(
    { data: JSON.stringify(notification), options: { ttl: 60 * 60 * 24 } },
    toWebPushSubscription(sub),
    vapid,
  );
  const res = await fetch(sub.endpoint, payload);
  if (res.status === 404 || res.status === 410) {
    await removeSubscription(sub.endpoint);
  }
}

export async function sendPushToUser(userId: string, notification: PushNotification): Promise<void> {
  const subs = await listSubscriptionsForUser(userId);
  await Promise.all(subs.map((sub) => sendToSubscription(sub, notification)));
}

/** Notifies a specific set of users (e.g. everyone who favorited a session),
 *  chunked the same way sendPushToAll is. */
export async function sendPushToUsers(userIds: string[], notification: PushNotification): Promise<void> {
  const chunkSize = 25;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    await Promise.all(chunk.map((userId) => sendPushToUser(userId, notification)));
  }
}

/** Broadcasts to every subscriber. Fans out in chunks so one Worker
 *  invocation doesn't open thousands of outbound fetches at once. */
export async function sendPushToAll(notification: PushNotification): Promise<void> {
  const subs = await listAllSubscriptions();
  const chunkSize = 25;
  for (let i = 0; i < subs.length; i += chunkSize) {
    const chunk = subs.slice(i, i + chunkSize);
    await Promise.all(chunk.map((sub) => sendToSubscription(sub, notification)));
  }
}
