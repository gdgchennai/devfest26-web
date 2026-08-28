import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Content negotiation for AI agents: a request for one of these pages with
 * `Accept: text/markdown` gets rewritten to its markdown twin under /md/*
 * (see app/md/**\/route.ts, built from lib/markdown.ts) instead of the
 * rendered HTML — same URL, per acceptmarkdown.com. `Vary: Accept` goes on
 * every matched response (markdown or HTML) so a CDN never serves the wrong
 * cached variant to the next requester asking with a different Accept header.
 */
const MARKDOWN_ROUTES = new Set([
  "/",
  "/agenda",
  "/speakers",
  "/tickets",
  "/tickets/select",
  "/contact",
  "/memories",
]);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isSpeakerDetail = pathname.startsWith("/speakers/") && pathname !== "/speakers/";

  if (!MARKDOWN_ROUTES.has(pathname) && !isSpeakerDetail) {
    return NextResponse.next();
  }

  const wantsMarkdown = (request.headers.get("accept") ?? "").includes("text/markdown");

  if (wantsMarkdown) {
    const url = request.nextUrl.clone();
    url.pathname = `/md${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("Vary", "Accept");
    return response;
  }

  // Next's own App Router rendering sets its own Vary header for RSC caching
  // on the HTML path and overwrites whatever proxy sets here — there's no
  // supported hook to append to it. Only the markdown branch above (a plain
  // Response from a route handler, which Next doesn't touch afterward) can
  // carry a reliable Vary: Accept. That's also the response the
  // acceptmarkdown.com check actually inspects.
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/agenda", "/speakers", "/speakers/:slug*", "/tickets", "/tickets/select", "/contact", "/memories"],
};
