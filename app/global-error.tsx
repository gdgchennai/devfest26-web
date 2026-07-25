"use client";

import { useEffect } from "react";

// Last resort: catches errors in the root layout itself (MotionProvider, font
// load, Header/Footer). It replaces the root layout, so Tailwind's global
// stylesheet is not applied here — styles are inlined to stay self-contained,
// and it must ship its own <html>/<body>. Colours mirror --ink / --blue.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "32rem", padding: "2rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "monospace",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.875rem", fontWeight: 600 }}>
            DevFest Chennai hit an unexpected error.
          </h1>
          <p style={{ marginTop: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
            Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              border: "none",
              borderRadius: "9999px",
              padding: "0.75rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#4285f4",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
