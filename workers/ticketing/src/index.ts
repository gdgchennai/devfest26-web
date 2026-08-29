/**
 * DevFest Chennai — ticketing / check-in Worker.
 *
 * Standalone Worker (own wrangler.jsonc, own deploy). Shares this repo with
 * the Next.js site but is not part of it. `DB` is bound to the same D1 as the
 * site; this Worker owns every write to the `tickets` table (the app only
 * reads it — see ../../lib/tickets.ts).
 *
 * KonfHub posts every attendee event (registration / cancel / check_in /
 * check_out) to one URL with NO authentication. The access control is the
 * URL: it lives on the workers.dev subdomain at an unguessable path segment
 * held in the WEBHOOK_PATH secret. Any other path 404s — and if the secret
 * is unset, EVERY path 404s (a deploy without it must not be open at a
 * guessable path).
 *
 * Response codes matter — KonfHub retries 3× only on 429 / 500 / 502 / 503 /
 * 504, nothing else. So: 500 on a real internal failure (get a retry), 200
 * for anything processed or safely skipped, 4xx for a structurally bad request
 * (no point retrying).
 */

import { parseWebhook } from "./konfhub";
import { applyRegistration, applyCancel, applyCheckIn, applyCheckOut } from "./store";

export interface Env {
  DB: D1Database;
  /** Secret path segment — the whole access-control model. REQUIRED: with it
   *  unset the Worker serves nothing. Local dev reads it from `.dev.vars`.
   *    npx wrangler secret put WEBHOOK_PATH -c workers/ticketing/wrangler.jsonc */
  WEBHOOK_PATH?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = env.WEBHOOK_PATH?.replace(/^\/+/, "");
    if (!secret) {
      console.error("WEBHOOK_PATH is not set — refusing all requests");
      return text(404, "not found");
    }
    if (new URL(request.url).pathname !== `/${secret}`) return text(404, "not found");
    if (request.method !== "POST") return text(405, "method not allowed");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return text(400, "invalid json");
    }

    const parsed = parseWebhook(body);
    if (!parsed.ok) {
      console.log(`skip (${parsed.status}): ${parsed.message}`);
      return text(parsed.status, parsed.message);
    }

    const e = parsed.event;
    const tag = `${e.eventType} ${e.eventId ?? "?"}`;
    try {
      let result: string;
      switch (e.eventType) {
        case "registration":
          result = await applyRegistration(env.DB, e);
          break;
        case "cancel":
          result = await applyCancel(env.DB, e);
          break;
        case "check_in":
          result = await applyCheckIn(env.DB, e);
          break;
        case "check_out":
          result = await applyCheckOut(env.DB, e);
          break;
      }
      console.log(`${tag}: ${result}`);
      return text(200, result);
    } catch (err) {
      console.error(`${tag} failed:`, err);
      return text(500, "internal error");
    }
  },
} satisfies ExportedHandler<Env>;

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { "content-type": "text/plain" } });
}
