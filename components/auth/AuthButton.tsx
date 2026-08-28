"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

/**
 * Sign-in entry point for the two nav surfaces:
 *  - "pill"  → lite-mode Header's pill bar
 *  - "menu"  → full-mode HamburgerMenu's link list
 *
 * Signed in, it becomes a link to /profile (sign-out lives on that page).
 */
export function AuthButton({ variant }: { variant: "pill" | "menu" }) {
  const { data, status } = useSession();

  if (variant === "menu") {
    if (status === "authenticated") {
      return (
        <Link href="/profile" className="text-paper/90 hover:text-paper">
          {data.user?.name ? data.user.name.split(" ")[0] : "Profile"} →
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="text-paper/90 hover:text-paper"
      >
        Sign in →
      </button>
    );
  }

  // pill
  const cls =
    "block rounded-full px-3 py-1.5 text-sm text-paper/70 transition-colors hover:bg-paper/5 hover:text-paper";
  if (status === "loading") return null;
  if (status === "authenticated") {
    return (
      <Link href="/profile" className={cls}>
        {data.user?.name ? data.user.name.split(" ")[0] : "Profile"}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => signIn("google")} className={cls}>
      Sign in
    </button>
  );
}
