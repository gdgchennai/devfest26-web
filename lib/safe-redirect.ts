/**
 * Coerce an arbitrary "where to go next" value (a `callbackUrl` query param, a
 * stored return path, an Auth.js redirect target) to a path we're willing to
 * navigate to: **same-host, path-only, no open redirects**.
 *
 * Anything absolute (`https://evil.com`), scheme-relative (`//evil.com`), a
 * backslash trick browsers fold into `//`, or otherwise unparseable collapses
 * to `fallback`.
 */
export function safeInternalPath(
  input: string | null | undefined,
  fallback = "/",
): string {
  if (typeof input !== "string") return fallback;

  const value = input.trim();
  if (!value.startsWith("/")) return fallback;
  // "//host", "/\host", and their encoded forms all resolve to another origin
  // in a browser — reject before parsing.
  if (/^\/[/\\]/.test(value) || /^\/(%2f|%5c)/i.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, "http://internal.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://internal.invalid") return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

/**
 * The path the visitor is on right now (pathname + query), for "send me back
 * here after sign-in". Client-only — returns `fallback` during SSR.
 */
export function currentInternalPath(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  return safeInternalPath(window.location.pathname + window.location.search, fallback);
}
