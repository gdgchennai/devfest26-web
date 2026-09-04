import posthog from "posthog-js";
import { siteConfig } from "@/site.config";

/**
 * Client instrumentation runs after the document loads and before React
 * hydrates — the Next 16 slot for analytics SDKs (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md).
 *
 * PostHog, not @posthog/next: that package pulls middleware / server
 * bootstrapping, which OpenNext inlines into the Worker (~1.2 MiB gz) and
 * would blow the free-plan cap. Autocapture + pageviews are enough here.
 *
 * Env vars win so a preview/staging project can override the committed
 * production token without a code change.
 */
const key =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  siteConfig.analytics.posthogKey;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || siteConfig.analytics.posthogHost;

if (key) {
  posthog.init(key, {
    api_host: host,
    // Pinned config snapshot — autocapture, SPA pageviews, exception
    // capture. See https://posthog.com/docs/libraries/js#config
    defaults: "2026-05-30",
  });
}
