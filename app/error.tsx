"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";

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
      <Eyebrow dotColor="red" className="mb-3">
        Something went wrong
      </Eyebrow>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">This page hit an error.</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        The rest of the site is fine — retry this page, or head somewhere else.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button href="/" variant="secondary">
          Back home
        </Button>
      </div>
    </div>
  );
}
