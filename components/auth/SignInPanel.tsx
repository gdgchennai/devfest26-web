"use client";

import { useSearchParams } from "next/navigation";
import { SignInButton } from "@/components/auth/SignInButton";
import { safeInternalPath } from "@/lib/safe-redirect";

/** The /signin page's button — returns the visitor to `?callbackUrl=` after
 *  sign-in (sanitised to a same-host path — no open redirects), else /my-agenda. 
 *  Includes custom error handling and banners when authentication fails or is cancelled. */
export function SignInPanel() {
  const params = useSearchParams();
  const error = params.get("error");

  const getErrorMessage = (err: string) => {
    switch (err) {
      case "Configuration":
        return "The sign-in attempt was cancelled or interrupted. Please try signing in again.";
      case "AccessDenied":
        return "Access was denied. Please contact support or try a different account.";
      default:
        return "An error occurred during authentication. Please try again.";
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      {error && (
        <div className="w-full rounded-2xl border border-[var(--red)]/30 bg-[var(--red)]/10 p-4 text-center text-xs text-[var(--red)] animate-fade-in shadow-sm flex items-start gap-3">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-[var(--red)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-left font-sans text-paper/90">
            <p className="font-bold text-[13px] text-[var(--red-pastel)]">Sign-In Failed</p>
            <p className="mt-0.5 leading-relaxed text-xs text-paper/70">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}
      <SignInButton callbackUrl={safeInternalPath(params.get("callbackUrl"), "/my-agenda")} />
    </div>
  );
}
