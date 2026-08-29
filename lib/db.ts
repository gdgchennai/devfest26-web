import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The D1 handle for the current request. `async: true` works in every server
 * context (route handlers, server components, server actions) — `next dev`
 * included, since next.config.ts already wires initOpenNextCloudflareForDev().
 *
 * Throws rather than returning null: every caller here needs the database, and
 * a missing binding is a deploy misconfiguration we want loud, not silent.
 */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error(
      "D1 binding `DB` is missing — create the database and set database_id in wrangler.jsonc",
    );
  }
  return env.DB;
}
