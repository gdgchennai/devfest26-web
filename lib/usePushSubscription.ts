"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export type PushStatus = "unsupported" | "ios-not-installed" | "loading" | "subscribed" | "unsubscribed";

function isIosNotInstalled(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIos && !standalone;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Shared subscribe/unsubscribe logic for the DevFest Web Push feature —
 *  used by both the explicit button on /profile and the auto-shown prompt.
 *  Keeping one copy means both always agree on current status. */
export function usePushSubscription(): {
  status: PushStatus;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
} {
  const [status, setStatus] = useState<PushStatus>("loading");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      // Already permanently denied — re-requesting would just silently fail,
      // so there's nothing left for either UI to offer.
      if (Notification.permission === "denied") {
        setStatus("unsupported");
        return;
      }
      if (isIosNotInstalled()) {
        setStatus("ios-not-installed");
        return;
      }
      try {
        const sub = await existingSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  async function subscribe() {
    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("unsubscribed");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("push not configured");
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      track("push_subscribe", { subscribed: 1 });
      setStatus("subscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }

  async function unsubscribe() {
    setStatus("loading");
    try {
      const sub = await existingSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      track("push_subscribe", { subscribed: 0 });
      setStatus("unsubscribed");
    } catch {
      setStatus("subscribed");
    }
  }

  return { status, subscribe, unsubscribe };
}
