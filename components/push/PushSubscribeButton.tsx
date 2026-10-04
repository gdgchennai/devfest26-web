"use client";

import { usePushSubscription } from "@/lib/usePushSubscription";
import { GlowButton } from "@/components/GlowButton";

/** Lets a signed-in visitor opt in/out of DevFest push notifications
 *  (announcements, schedule changes). Renders nothing if the platform can't
 *  support it at all — iOS Safari gets a one-line hint instead, since the fix
 *  there is "add to home screen", not a button press. */
export function PushSubscribeButton() {
  const { status, subscribe, unsubscribe } = usePushSubscription();

  if (status === "unsupported") return null;
  if (status === "ios-not-installed") {
    return <p className="text-sm text-paper/60">Add this site to your Home Screen to get push notifications.</p>;
  }

  return (
    <GlowButton
      shape="pill"
      size="md"
      disabled={status === "loading"}
      pressed={status === "subscribed"}
      onClick={status === "subscribed" ? unsubscribe : subscribe}
    >
      {status === "subscribed" ? "Notifications on ✓" : "Get notified about updates →"}
    </GlowButton>
  );
}
