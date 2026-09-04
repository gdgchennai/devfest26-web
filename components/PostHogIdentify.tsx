"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

/**
 * Bind the PostHog person to Auth.js's opaque `usr_…` id once the session
 * is known. Email/name go on the person, not as the distinct id — the
 * measurement token is public. Must sit under `AuthProvider`.
 *
 * Does not `reset()` on anonymous mounts: that would split one visitor
 * into a new anonymous person after every hard refresh. Reset belongs
 * on the explicit sign-out path only (SignOutButton).
 */
export function PostHogIdentify() {
  const { data: session, status } = useSession();
  const uid = session?.user?.uid;
  const email = session?.user?.email;
  const name = session?.user?.name;

  useEffect(() => {
    if (status !== "authenticated" || !uid) return;
    posthog.identify(uid, {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
    });
  }, [status, uid, email, name]);

  return null;
}
