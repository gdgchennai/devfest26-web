// OpenNext's fetch remains the application entrypoint; upgrades bypass Next's HTTP adapter.
// @ts-expect-error generated during hall:build
import app from "../../.open-next/worker.js";
// Preserve OpenNext's cache/queue Durable Object exports when wrapping fetch.
// @ts-expect-error generated during hall:build
export * from "../../.open-next/worker.js";
import {
  hallLiveEnabled,
  HALL_AVAILABILITY_PATH,
  HALL_FALLBACK_PATH,
} from "../../lib/hall-availability";
type Env = { HALL_PUBLIC: Fetcher; HALL_LIVE_ENABLED?: string };
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const enabled = hallLiveEnabled(env);
    if (url.pathname === HALL_AVAILABILITY_PATH) {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
      return new Response(
        request.method === "HEAD" ? null : JSON.stringify({ enabled }),
        { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
      );
    }
    if (!enabled) {
      if (/^\/live\/?$/.test(url.pathname))
        return new Response(null, {
          status: 307,
          headers: { Location: HALL_FALLBACK_PATH, "Cache-Control": "no-store" },
        });
      if (["/api/halls", "/api/halls/socket"].includes(url.pathname))
        return Response.json(
          { error: "Live halls are paused", enabled: false, redirectTo: HALL_FALLBACK_PATH },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
    }
    if (url.pathname === "/api/halls/socket") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return new Response(null, { status: 403 });
      url.pathname = "/socket";
      return env.HALL_PUBLIC.fetch(new Request(url, request));
    }
    const response = await app.fetch(request, env, ctx);
    if (!enabled && response.headers.get("content-type")?.includes("text/html")) {
      // Static HTML stays static; the emergency marker is applied at request time.
      // CSS hides Live before hydration, without changing React's DOM structure.
      const masked = new HTMLRewriter()
        .on("html", {
          element(element) {
            element.setAttribute("data-hall-live-enabled", "false");
          },
        })
        .transform(response);
      masked.headers.set("Cache-Control", "no-store");
      return masked;
    }
    return response;
  },
};
