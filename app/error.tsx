"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { uiCopy } from "@/site.config";

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
        {uiCopy.errorPage.eyebrow}
      </Eyebrow>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.errorPage.heading}</h1>
      <p className="mt-3 max-w-xl text-paper/70">{uiCopy.errorPage.body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => unstable_retry()}>{uiCopy.errorPage.retryLabel}</Button>
        <Button href="/" variant="secondary">
          {uiCopy.errorPage.homeLabel}
        </Button>
      </div>
    </div>
  );
}
