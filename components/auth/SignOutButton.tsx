"use client";

import { signOut } from "next-auth/react";
import { GlowButton } from "@/components/GlowButton";

export function SignOutButton() {
  return (
    <GlowButton onClick={() => signOut({ callbackUrl: "/" })} shape="pill" size="md">
      Sign out
    </GlowButton>
  );
}
