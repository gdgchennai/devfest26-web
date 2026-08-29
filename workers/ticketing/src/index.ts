/**
 * DevFest Chennai — ticketing / check-in Worker.
 *
 * Standalone Worker (own wrangler.jsonc, own deploy). Shares this repo with
 * the Next.js site but is not part of it. It has a `DB` binding to the same
 * D1 database and is meant to write the ticket + check-in columns on the
 * `users` table:
 *
 *   booking_id, payment_id, ticket_url, invoice_url   (migration 0002)
 *   checked_in, check_in_time                          (migration 0003)
 *
 * The app only ever reads those columns (see app/'s lib/users.ts); this
 * Worker is the writer. Keep the column names here in sync with ../../migrations.
 *
 * Not implemented yet — this is the scaffold.
 */

export interface Env {
  DB: D1Database;
  // KONFHUB_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    void env;
    return new Response(`devfest-ticketing: not implemented (${request.method} ${new URL(request.url).pathname})`, {
      status: 501,
      headers: { "content-type": "text/plain" },
    });
  },
} satisfies ExportedHandler<Env>;
