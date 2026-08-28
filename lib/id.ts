/**
 * Opaque, random public identifiers. The `usr_` prefix makes a stray id in a
 * log or a URL self-describing, and keeps our handles visibly distinct from
 * Google's `sub` (which never leaves the `users.google_sub` column).
 */
export function newUserId(): string {
  return `usr_${crypto.randomUUID().replace(/-/g, "")}`;
}
