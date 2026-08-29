"use client";

import { useSearchParams } from "next/navigation";
import { SignInButton } from "@/components/auth/SignInButton";
import { safeInternalPath } from "@/lib/safe-redirect";

/** The /signin page's button — returns the visitor to `?callbackUrl=` after
 *  sign-in (sanitised to a same-host path — no open redirects), else /my-agenda. */
export function SignInPanel() {
  const params = useSearchParams();
  return <SignInButton callbackUrl={safeInternalPath(params.get("callbackUrl"), "/my-agenda")} />;
}
