"use client";

import type { AgendaSession } from "@/lib/schemas";
import { sessionKey } from "@/lib/session-key";
import { useFavorites } from "@/components/favorites/FavoritesProvider";

/**
 * Star toggle for a single agenda session. Signed-out visitors who click it
 * are taken to Google sign-in (handled in FavoritesProvider). Non-break
 * sessions only — a tea break isn't something you save.
 */
export function FavoriteButton({
  session,
  className = "",
}: {
  session: AgendaSession;
  className?: string;
}) {
  const { ready, isFavorite, toggle } = useFavorites();
  const key = sessionKey(session);
  const saved = isFavorite(key);

  return (
    <button
      type="button"
      onClick={() => toggle(key)}
      aria-pressed={saved}
      aria-label={saved ? `Remove "${session.title}" from your agenda` : `Save "${session.title}" to your agenda`}
      data-ready={ready}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-paper/15 text-paper/60 transition-colors hover:border-paper/40 hover:text-paper aria-pressed:border-yellow aria-pressed:text-yellow ${className}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={saved ? "currentColor" : "none"} aria-hidden="true">
        <path
          d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
