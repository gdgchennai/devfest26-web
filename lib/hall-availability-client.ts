"use client";

import { HALL_AVAILABILITY_PATH } from "./hall-availability";

export const HALL_AVAILABILITY_EVENT = "hall-availability-change";
let enabled = true;
let checkedAt = 0;
let pending: Promise<boolean> | null = null;

/** Shared by navigation and Live; no timer/polling and no hall-service dependency. */
export function checkHallLiveEnabled(force = false): Promise<boolean> {
  if (pending) return pending;
  if (!force && Date.now() - checkedAt < 30_000)
    return Promise.resolve(enabled);
  pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(HALL_AVAILABILITY_PATH, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Availability check failed");
      const value = (await response.json()) as { enabled?: unknown } | null;
      if (!value || typeof value.enabled !== "boolean")
        throw new Error("Invalid availability response");
      enabled = value.enabled;
      document.documentElement.dataset.hallLiveEnabled = String(enabled);
      window.dispatchEvent(new Event(HALL_AVAILABILITY_EVENT));
    } catch {
      // A status request failing is not an instruction to disable a healthy hall.
      // Preserve the server's HTML marker if this is the first client check.
      if (document.documentElement.dataset.hallLiveEnabled === "false")
        enabled = false;
    } finally {
      clearTimeout(timeout);
    }
    return enabled;
  })().finally(() => {
    checkedAt = Date.now();
    pending = null;
  });
  return pending;
}
