"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

/**
 * Makes `useSession()` available to every client component below it.
 *
 * No `session` prop: `SessionProvider` fetches `/api/auth/session` itself in
 * an effect (after first paint, so it doesn't contend with LCP) and owns the
 * resulting state from then on. A previous version pre-seeded `session` with
 * `null` to defer that fetch, then swapped in the real value once it
 * resolved — but `SessionProvider` only reads its `session` prop on its very
 * first render (a lazy `useState` initializer) and never re-syncs to later
 * prop changes, so `null` (treated as "already checked, signed out") stuck
 * permanently and the real session update was silently dropped. Every
 * consumer of `useSession()` (e.g. `AvatarButton`) saw "unauthenticated"
 * forever, even with a valid session cookie.
 *
 * Do not call `auth()` from the root layout to seed this: cookies() would
 * force the whole tree dynamic and undo force-static on the marketing pages.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
    </SessionProvider>
  );
}
