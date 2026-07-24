export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function mapRange(inMin: number, inMax: number, outMin: number, outMax: number, value: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

/** Approximates cubic-bezier(0.4, 0, 1, 1) — an accelerating ease-in. */
export function easeInAccelerating(t: number): number {
  return Math.pow(clamp(t), 2.2);
}

/** Approximates cubic-bezier(0.16, 1, 0.3, 1) — a fast-out-slow-in settle. */
export function easeOutSettle(t: number): number {
  const c = clamp(t);
  return 1 - Math.pow(1 - c, 3);
}
