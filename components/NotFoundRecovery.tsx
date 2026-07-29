"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { useClientValue } from "@/lib/useClientValue";
import { nearestRoute } from "@/lib/nearest-route";
import { retiredRoutes, siteRoutes } from "@/lib/routes";

/**
 * The part of the 404 that knows which URL was actually attempted, and does
 * something about it.
 *
 * Client-side by necessity: the 404 is prerendered once at /_not-found and
 * served for every unmatched path, so the path is only knowable in the
 * browser. `useClientValue` reads it through useSyncExternalStore, which
 * renders the server value during hydration and swaps afterwards — reading
 * `window.location` during render directly would mismatch.
 *
 * The slot below is height-reserved. This block appears one tick after paint,
 * and a page that shoves its own buttons downward under the cursor of someone
 * who is already annoyed is the exact opposite of helpful.
 */
export function NotFoundRecovery() {
  const attempted = useClientValue(() => window.location.pathname, null);
  const referrer = useClientValue(() => document.referrer, "");

  const retired = attempted ? retiredRoutes[attempted.replace(/\/+$/, "") || "/"] : undefined;
  const suggestion = attempted && !retired ? nearestRoute(attempted) : null;

  // Only offer "go back" for a page on this site that isn't this page.
  const back = (() => {
    if (!referrer || typeof window === "undefined") return null;
    try {
      const url = new URL(referrer);
      if (url.origin !== window.location.origin) return null;
      if (url.pathname === attempted) return null;
      const known = siteRoutes.find((r) => r.href === url.pathname);
      return { href: url.pathname, label: known ? known.label : "the previous page" };
    } catch {
      return null;
    }
  })();

  const target = retired
    ? siteRoutes.find((r) => r.href === retired.goto)
    : suggestion;

  return (
    <div className="min-h-[9.5rem]">
      {/* Both steps moved up one: the "tried" label was /35 (2.77:1, below AA)
          against a /50 path. Raising only the label would have flattened them to
          the same value and lost the hierarchy, so the pair is now /50 label
          (4.76:1) on a /70 path (8.83:1) — same relationship, both passing. */}
      {attempted && (
        <p className="font-mono text-sm break-all text-paper/70">
          <span className="text-paper/50">tried</span> {attempted}
        </p>
      )}

      <p className="mt-3 max-w-xl text-paper/70">
        {retired
          ? retired.reason
          : suggestion
            ? "That address doesn't exist, but one very close to it does."
            : "That link is either out of date or was never a page here — but you're in the right place. Here's what most people come for."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {target ? (
          <Button href={target.href}>Go to {target.label}</Button>
        ) : (
          <Button href="/">Back home</Button>
        )}

        {target && (
          <Button href="/" variant="secondary">
            Back home
          </Button>
        )}

        {back && (
          <Link
            href={back.href}
            className="text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline"
          >
            ← Back to {back.label}
          </Link>
        )}
      </div>
    </div>
  );
}
