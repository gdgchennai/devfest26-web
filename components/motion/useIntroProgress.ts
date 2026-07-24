import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FallbackColor } from "@/lib/fallback-color";

const COLORS: FallbackColor[] = ["blue", "red", "yellow", "green"];
const MIN_DURATION = 1200;
const MAX_DURATION = 5000;
const WATCHDOG = 6000;
const ESCAPE_HATCH_AT = 1500;
const GREEN_HOLD = 180;

export function useIntroProgress(assets: string[], onSettled: () => void, disabled: boolean) {
  const [progress, setProgress] = useState(0);
  const [dotColor, setDotColor] = useState<FallbackColor>("blue");
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);
  const onSettledRef = useRef(onSettled);
  // Keep the ref in sync via an effect (not during render) so the rAF loop
  // below always calls the latest onSettled without needing it as a dep.
  useLayoutEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (disabled) return;

    let rafId: number;
    let current = 0;
    let target = assets.length === 0 ? 100 : 0;
    let loaded = 0;
    let settled = false;
    const total = Math.max(assets.length, 1);
    const start = performance.now();
    let colorIndex = 0;
    let lastSwitch = start;

    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      (img.decode ? img.decode() : Promise.resolve())
        .catch(() => {})
        .finally(() => {
          loaded += 1;
          target = (loaded / total) * 100;
        });
    });

    const escapeTimer = window.setTimeout(() => setShowEscapeHatch(true), ESCAPE_HATCH_AT);
    const watchdog = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setDotColor("green");
        setProgress(100);
        onSettledRef.current();
      }
    }, WATCHDOG);

    function loop(now: number) {
      const elapsed = now - start;
      if (elapsed >= MAX_DURATION) target = 100;

      current += (target - current) * 0.06;
      if (Math.abs(target - current) < 0.1) current = target;
      const display = Math.min(current, 100);
      setProgress(display);

      const interval = 480 - 320 * (display / 100);
      if (now - lastSwitch >= interval) {
        colorIndex = (colorIndex + 1) % COLORS.length;
        setDotColor(COLORS[colorIndex]);
        lastSwitch = now;
      }

      const ready = display >= 99.9 && target >= 100 && elapsed >= MIN_DURATION;
      if (ready && !settled) {
        settled = true;
        setDotColor("green");
        setProgress(100);
        window.clearTimeout(escapeTimer);
        window.clearTimeout(watchdog);
        window.setTimeout(() => onSettledRef.current(), GREEN_HOLD);
        return;
      }

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(escapeTimer);
      window.clearTimeout(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return { progress, dotColor, showEscapeHatch };
}
