"use client";

import { track } from "@/lib/analytics";
import { LITE_STORAGE_KEY, clearLiteMode, isLiteMode, notifyLiteModeChange } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

/**
 * The one place that knows how to flip the lite preference — shared by the
 * footer's `LiteToggle` and the intro `Loader`'s own "switch to lite" link,
 * so both drive the exact same on/off switch rather than two copies of this
 * logic that could drift apart.
 *
 * No navigation: see `MotionProvider`'s own doc comment for why a URL/
 * localStorage/`html.lite`-class write plus `notifyLiteModeChange()` is
 * enough on its own — that notification is what makes `MotionProvider`
 * remount its whole subtree fresh, the same clean slate a page reload used
 * to give every `useClientValue` read across the site.
 */
export function useLiteModeToggle(): { lite: boolean; setLite: (next: boolean) => void } {
  const lite = useClientValue(isLiteMode, false);

  function setLite(next: boolean) {
    track("lite_mode", { enabled: next ? 1 : 0 });
    if (next) window.localStorage.setItem(LITE_STORAGE_KEY, "1");
    else clearLiteMode();

    const url = new URL(window.location.href);
    url.searchParams.set("lite", next ? "1" : "0");
    window.history.replaceState(null, "", url);

    document.documentElement.classList.toggle("lite", next);
    notifyLiteModeChange();
  }

  return { lite, setLite };
}
