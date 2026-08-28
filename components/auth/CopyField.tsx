"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

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
      className="group inline-flex items-center gap-2 rounded-md border border-paper/15 px-2.5 py-1.5 font-mono text-sm text-paper/80 transition-colors hover:border-paper/40"
      title="Copy to clipboard"
    >
      <span className="max-w-[16rem] truncate">{value}</span>
      <span className="text-xs text-paper/50 group-hover:text-paper/80">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
