// OpenNext's fetch remains the application entrypoint; upgrades bypass Next's HTTP adapter.
// @ts-expect-error generated during hall:build
import app from "../../.open-next/worker.js";
// Preserve OpenNext's cache/queue Durable Object exports when wrapping fetch.
// @ts-expect-error generated during hall:build
export * from "../../.open-next/worker.js";
type Env = { HALL_PUBLIC: Fetcher };
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/halls/socket") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return new Response(null, { status: 403 });
      url.pathname = "/socket";
      return env.HALL_PUBLIC.fetch(new Request(url, request));
    }
    return app.fetch(request, env, ctx);
  },
};
