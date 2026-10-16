"use client";

import { useEffect } from "react";
import {
  checkHallLiveEnabled,
  HALL_AVAILABILITY_EVENT,
} from "@/lib/hall-availability-client";
import { HALL_FALLBACK_PATH } from "@/lib/hall-availability";

/** One shared startup check also covers navigation outside the Live page. */
export function HallAvailability() {
  useEffect(() => {
    function apply() {
      if (
        /^\/live\/?$/.test(location.pathname) &&
        document.documentElement.dataset.hallLiveEnabled === "false"
      )
        location.replace(HALL_FALLBACK_PATH);
    }
    function resume(event: PageTransitionEvent) {
      if (event.persisted) void checkHallLiveEnabled(true).then(apply);
    }
    window.addEventListener(HALL_AVAILABILITY_EVENT, apply);
    window.addEventListener("pageshow", resume);
    void checkHallLiveEnabled().then(apply);
    return () => {
      window.removeEventListener(HALL_AVAILABILITY_EVENT, apply);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
  return null;
}
