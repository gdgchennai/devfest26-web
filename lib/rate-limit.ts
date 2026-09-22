/**
 * Best-effort sliding-window throttle, per key (usually a client IP).
 *
 * Memory is per Worker isolate, and isolates come and go — so this bounds a burst
 * from one client, not a determined attacker. For a hard limit, add a Cloudflare
 * rate-limiting rule on the route (see docs/environment.md).
 */
const buckets = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  // Keep the map from growing without bound on a long-lived isolate.
  if (buckets.size > 5000) {
    for (const [k, times] of buckets) {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return false;
}

export function clientKey(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
}
