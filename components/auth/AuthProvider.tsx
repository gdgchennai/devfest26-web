"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * Makes `useSession()` available to every client component below it.
 *
 * The session fetch waits until the browser is idle so it does not contend
 * with LCP on public pages. Avatar/favorites then catch up; they are not the
 * first paint. We pass `session` in once it arrives.
 *
 * Do not call `auth()` from the root layout to seed this: cookies() would
 * force the whole tree dynamic and undo force-static on the marketing pages.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void fetch("/api/auth/session")
        .then((res) => (res.ok ? (res.json() as Promise<Session | null>) : null))
        .then((data) => {
          if (cancelled) return;
          setSession(data && data.user ? data : null);
        })
        .catch(() => {
          if (!cancelled) setSession(null);
        });
    };

    const idle = window.requestIdleCallback?.bind(window);
    if (idle) {
      const id = idle(load, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const t = window.setTimeout(load, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return (
    <SessionProvider session={session} refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
    </SessionProvider>
  );
}
