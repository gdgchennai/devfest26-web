"use client";

import { useState } from "react";

/** Compact, one-line identifier with click-to-copy. Shows a shortened form
 *  (`usr_1a2b3c…7f8g`) but copies the whole value. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const shown =
    value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value;

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="inline-flex items-center gap-2 rounded-md bg-paper/5 px-2.5 py-1.5 font-mono text-sm text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper"
      title={`Copy ${value}`}
      aria-label={`Copy user ID ${value}`}
    >
      <span>{shown}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
        {copied ? (
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
          </>
        )}
      </svg>
    </button>
  );
}
