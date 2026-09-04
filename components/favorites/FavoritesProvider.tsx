"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";
import { currentInternalPath } from "@/lib/safe-redirect";

type FavoritesContextValue = {
  /** True once the initial fetch has resolved (or there's nobody signed in). */
  ready: boolean;
  isFavorite: (key: string) => boolean;
  /** Add if absent, remove if present. Signed-out visitors get a "sign in to
   *  save" prompt instead — no redirect until they choose to. */
  toggle: (key: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const EMPTY: ReadonlySet<string> = new Set();

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [fetchDone, setFetchDone] = useState(false);
  const [prompt, setPrompt] = useState(false);
  // Guards against overlapping writes for the same key racing each other.
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/favorites")
      .then((r) => (r.ok ? (r.json() as Promise<{ favorites?: string[] }>) : { favorites: [] }))
      .then((data) => {
        if (!cancelled) setKeys(new Set(data.favorites ?? []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetchDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const authed = status === "authenticated";
  // Signing in makes the "sign in to save" prompt moot.
  const showPrompt = prompt && !authed;
  const ready = status === "loading" ? false : authed ? fetchDone : true;
  const activeKeys = authed ? keys : EMPTY;

  const isFavorite = useCallback((key: string) => activeKeys.has(key), [activeKeys]);

  const toggle = useCallback(
    (key: string) => {
      if (!authed) {
        track("login_prompt", { source: "save_session" });
        setPrompt(true);
        return;
      }
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);

      const adding = !keys.has(key);
      track("save_session", { saved: adding ? 1 : 0 });
      setKeys((prev) => {
        const next = new Set(prev);
        if (adding) next.add(key);
        else next.delete(key);
        return next;
      });

      fetch("/api/favorites", {
        method: adding ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionKey: key }),
      })
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ favorites?: string[] }>)
            : Promise.reject(new Error(String(r.status))),
        )
        .then((data) => {
          setKeys(new Set(data.favorites ?? []));
        })
        .catch(() => {
          setKeys((prev) => {
            const next = new Set(prev);
            if (adding) next.delete(key);
            else next.add(key);
            return next;
          });
        })
        .finally(() => {
          inFlight.current.delete(key);
        });
    },
    [authed, keys],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ ready, isFavorite, toggle }),
    [ready, isFavorite, toggle],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      {showPrompt && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-6 z-[60] mx-auto flex w-fit max-w-[calc(100vw-2rem)] justify-center px-4"
        >
          {/* Same glow-btn shell GlowButton renders — the rotating four-colour
              ring + corner pooling from app/globals.css — wrapped by hand
              because the pill holds its own buttons, not a single label. */}
          <span className="glow-btn rounded-full" data-shape="pill">
            <span className="glow-btn__corners" aria-hidden="true" />
            <div className="glow-btn__surface flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-paper">
              <span>Sign in to save sessions to your agenda.</span>
              <button
                type="button"
                onClick={() => {
                  track("login", { method: "google", source: "save_session" });
                  signIn("google", { callbackUrl: currentInternalPath("/agenda") });
                }}
                className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink transition-opacity hover:opacity-90"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setPrompt(false)}
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
      )}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within <FavoritesProvider>");
  return ctx;
}
