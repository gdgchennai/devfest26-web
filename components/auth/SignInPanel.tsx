"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export function SignInPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const callbackUrl = params.get("callbackUrl") || "/my-agenda";

  // Already signed in? Nothing to do here — go where they were headed.
  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [status, callbackUrl, router]);

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="mt-8 inline-flex items-center gap-3 rounded-full border border-paper/15 bg-surface px-6 py-3 text-sm font-medium text-paper transition-colors hover:border-paper/40"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4 3.1c1-2.9 3.7-4.9 6.8-4.9z" />
      </svg>
      Continue with Google
    </button>
  );
}
