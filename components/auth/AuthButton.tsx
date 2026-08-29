import Link from "next/link";

/**
 * Nav entry for the account area, in the two nav surfaces:
 *  - "pill" → lite-mode Header's pill bar
 *  - "menu" → full-mode HamburgerMenu's link list
 *
 * Always "My profile" → /profile. That page handles the signed-out case
 * itself (shows a Google sign-in prompt), so there's nothing session-aware
 * to do here.
 */
export function AuthButton({ variant }: { variant: "pill" | "menu" }) {
  if (variant === "menu") {
    return (
      <Link href="/profile" className="text-paper/90 hover:text-paper">
        My profile →
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      className="block rounded-full px-3 py-1.5 text-sm text-paper/70 transition-colors hover:bg-paper/5 hover:text-paper"
    >
      My profile
    </Link>
  );
}
