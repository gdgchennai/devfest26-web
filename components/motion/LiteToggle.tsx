"use client";

import { clearLiteMode, isLiteMode, LITE_STORAGE_KEY } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

export function LiteToggle() {
  const lite = useClientValue(isLiteMode, false);

  function toggle() {
    if (lite) {
      clearLiteMode();
    } else {
      window.localStorage.setItem(LITE_STORAGE_KEY, "1");
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline"
    >
      {lite ? "Full version" : "Lite version"}
    </button>
  );
}
