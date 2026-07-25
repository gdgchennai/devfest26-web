"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level boundary: catches errors in a page subtree that a SectionBoundary
// didn't contain. The root layout (Header, Footer, nav) stays mounted around
// this, so the visitor is never stranded. `unstable_retry` is this Next
// version's recovery prop (not the standard `reset`).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-20 sm:px-8">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-paper/60">
        <span className="h-2.5 w-2.5 rounded-full bg-red" />
        Something went wrong
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">This page hit an error.</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        The rest of the site is fine — retry this page, or head somewhere else.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full bg-blue px-6 py-3 text-sm font-medium text-paper hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-paper/30 px-6 py-3 text-sm font-medium text-paper hover:bg-paper/10"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
