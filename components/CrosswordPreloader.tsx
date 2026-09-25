"use client";

import { useEffect } from "react";
import { prefetchDailyCrossword } from "@/lib/crossword-client";

/**
 * Mounts in RootLayout to silently preload and cache the daily crossword puzzle
 * in the user's browser localStorage for 24 hours as soon as they enter the site.
 */
export function CrosswordPreloader() {
  useEffect(() => {
    prefetchDailyCrossword();
  }, []);

  return null;
}
