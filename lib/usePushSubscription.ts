"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export type PushStatus = "unsupported" | "ios-not-installed" | "loading" | "subscribed" | "unsubscribed";

/** Subscribe-state changes made by one hook instance (e.g. the /profile button)
 *  are broadcast so every other instance (the auto-prompt) agrees at once. */
const CHANGE_EVENT = "devfest-push-change";

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
  /** Resolves true only when the subscription was stored on the server. */
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
} {
  const [status, setStatusState] = useState<PushStatus>("loading");

  function setStatus(next: PushStatus) {
    setStatusState(next);
    if (next === "subscribed" || next === "unsubscribed") {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
    }
  }

  useEffect(() => {
    const onChange = (e: Event) => setStatusState((e as CustomEvent<PushStatus>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

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
        setStatusState(sub ? "subscribed" : "unsubscribed");
        // Re-send it so the row belongs to whoever is signed in now (the
        // browser keeps the subscription across sign-outs). Idempotent upsert;
        // 401 when signed out is fine.
        if (sub) {
          fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          }).catch(() => {});
        }
      } catch {
        setStatusState("unsubscribed");
      }
    })();
  }, []);

  async function subscribe(): Promise<boolean> {
    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("unsubscribed");
        return false;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("push not configured");
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        // Not stored server-side, so nothing could ever be sent to it.
        await sub.unsubscribe().catch(() => {});
        throw new Error(`subscribe failed: ${res.status}`);
      }
      track("push_subscribe", { subscribed: 1 });
      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("[push] subscribe failed", err);
      setStatus("unsubscribed");
      return false;
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
