"use client";

import { SessionProvider } from "next-auth/react";

/** Makes `useSession()` available to every client component below it. Mounted
 *  once, high in app/layout.tsx. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
