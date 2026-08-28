"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
    >
      Sign out
    </button>
  );
}
