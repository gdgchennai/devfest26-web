"use client";

import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import { GlowButton } from "@/components/GlowButton";

export function SignOutButton() {
  return (
    <GlowButton
      onClick={() => {
        // Drop the identified person before Auth.js clears the cookie, so
        // the next visitor on this browser doesn't inherit usr_… events.
        if (posthog.__loaded) posthog.reset();
        signOut({ callbackUrl: "/" });
      }}
      shape="pill"
      size="md"
    >
      Sign out
    </GlowButton>
  );
}
