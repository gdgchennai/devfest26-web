"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { track } from "@/lib/analytics";
import { usePushSubscription } from "@/lib/usePushSubscription";

const DISMISSED_KEY = "devfest-push-prompt-dismissed";

/** Auto-shown nudge for signed-in visitors who haven't subscribed to push
 *  notifications yet — same bottom-pill shell FavoritesProvider uses for its
 *  "sign in to save" prompt. Dismissing it (or subscribing, or declining the
 *  native permission prompt) hides it for good via localStorage — it's a
 *  one-time nudge, not a recurring nag. */
export function PushPrompt() {
  const { status: sessionStatus } = useSession();
  const { status: pushStatus, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      let stored = false;
      try {
        stored = window.localStorage.getItem(DISMISSED_KEY) === "1";
      } catch {
        // Storage unavailable (private mode) — default to not-dismissed.
      }
      setDismissed(stored);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sessionStatus !== "authenticated" || pushStatus !== "unsubscribed" || dismissed) {
        setVisible(false);
        return;
      }
      // Let the page settle before nudging — not the first thing someone sees
      // after landing on a fresh sign-in.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!cancelled) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, pushStatus, dismissed]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable (private mode, quota) — worst case it asks again.
    }
  }

  async function enable() {
    track("push_prompt_accept");
    await subscribe();
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-6 z-[60] mx-auto flex w-fit max-w-[calc(100vw-2rem)] justify-center px-4"
    >
      {/* Same glow-btn shell as FavoritesProvider's save-session prompt. */}
      <span className="glow-btn rounded-full" data-shape="pill">
        <span className="glow-btn__corners" aria-hidden="true" />
        <div className="glow-btn__surface flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-paper">
          <span>Get notified about schedule changes and announcements?</span>
          <button
            type="button"
            onClick={enable}
            className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink transition-opacity hover:opacity-90"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => {
              track("push_prompt_decline");
              dismiss();
            }}
            aria-label="Dismiss"
            className="text-paper/50 hover:text-paper"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </span>
    </div>
  );
}
