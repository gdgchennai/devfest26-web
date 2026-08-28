"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type FavoritesContextValue = {
  /** True once the initial fetch has resolved (or there's nobody signed in). */
  ready: boolean;
  isFavorite: (key: string) => boolean;
  /** Add if absent, remove if present. Signed-out visitors get sent to Google
   *  first; the click that triggered sign-in isn't replayed afterwards. */
  toggle: (key: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const EMPTY: ReadonlySet<string> = new Set();

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [fetchDone, setFetchDone] = useState(false);
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
  const ready = status === "loading" ? false : authed ? fetchDone : true;
  const activeKeys = authed ? keys : EMPTY;

  const isFavorite = useCallback((key: string) => activeKeys.has(key), [activeKeys]);

  const toggle = useCallback(
    (key: string) => {
      if (!authed) {
        void signIn("google");
        return;
      }
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);

      const adding = !keys.has(key);
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
          // Roll the optimistic change back.
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

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within <FavoritesProvider>");
  return ctx;
}
