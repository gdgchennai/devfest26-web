"use client";

import posthog from "posthog-js";
import { siteConfig } from "@/site.config";

/**
 * Typed params for `track()`. GA4 event parameters want primitives; keep
 * nested ecommerce `items[]` out of here so every call site stays a flat
 * object that shows up in Realtime without extra Admin registration.
 */
export type AnalyticsParams = Record<string, string | number>;

/**
 * Fire a GA4 event through the gtag dataLayer. Queues onto `window.dataLayer`
 * in the same Arguments-tuple shape `gtag()` uses, so events fired before the
 * root-layout snippet hydrates are still flushed when gtag.js loads.
 *
 * Don't send emails, booking IDs, or other PII on the GA4 path — measurement
 * IDs are public and this stream is the production property. PostHog identify
 * (see PostHogIdentify) is the only place email/name are attached, as person
 * properties on the opaque `usr_…` distinct id.
 */
export function track(name: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js replays queued items as command tuples and expects the Arguments
  // object `gtag()` itself pushes — a plain array is treated as a GTM event
  // object and would never reach GA4.
  function pushCommand() {
    // eslint-disable-next-line prefer-rest-params -- Arguments, not a rest array
    w.dataLayer!.push(arguments);
  }
  (pushCommand as (...args: unknown[]) => void)("event", name, params);

  // Same conversion names as GA4, dual-written so PostHog dashboards see
  // the same conversion hotspots without a second call site.
  // `__loaded` is false until instrumentation-client.ts finishes init —
  // capture() would no-op / queue either way, but skip when the key was
  // omitted so we don't create a stub distinct id.
  if (posthog.__loaded) {
    posthog.capture(name, params);
  }
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href, siteConfig.url);
  } catch {
    return null;
  }
}

function samePath(url: URL, configured: string): boolean {
  const target = parseUrl(configured);
  if (!target) return false;
  return url.origin === target.origin && url.pathname === target.pathname;
}

/**
 * Map a clicked URL to a conversion event. Returns null for ordinary nav
 * (Home, Memories, Agenda, …) — those are already pageviews. The names lean
 * on GA4 recommended events (`generate_lead`, `select_content`) so they can
 * be marked as conversions in Admin without a custom-event detour.
 */
export function eventForUrl(href: string): { name: string; params: AnalyticsParams } | null {
  const url = parseUrl(href);
  if (!url) return null;

  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/tickets") {
    return { name: "select_content", params: { content_type: "tickets", content_id: "tickets" } };
  }
  if (path === "/tickets/select") {
    return { name: "select_content", params: { content_type: "tickets", content_id: "ticket_select" } };
  }
  if (path === "/partner") {
    return { name: "generate_lead", params: { lead_type: "partner" } };
  }
  if (samePath(url, siteConfig.cfp.formUrl) || path === "/cfp") {
    return { name: "generate_lead", params: { lead_type: "cfp" } };
  }
  if (samePath(url, siteConfig.volunteer.formUrl) || path === "/cfv") {
    return { name: "generate_lead", params: { lead_type: "volunteer" } };
  }
  if (
    samePath(url, siteConfig.venue.mapUrl) ||
    url.hostname === "maps.google.com" ||
    (url.hostname === "www.google.com" && path.startsWith("/maps"))
  ) {
    return { name: "select_content", params: { content_type: "directions" } };
  }
  if (url.protocol === "mailto:" && url.pathname.toLowerCase() === siteConfig.contact.email.toLowerCase()) {
    return { name: "generate_lead", params: { lead_type: "email" } };
  }
  if (url.hostname === "chat.whatsapp.com") {
    return { name: "join_community", params: { method: "whatsapp" } };
  }
  if (url.hostname.includes("konfhub.com")) {
    return { name: "view_ticket", params: { content_type: "konfhub" } };
  }

  for (const event of siteConfig.subEvents) {
    if (event.href && samePath(url, event.href)) {
      return { name: "select_content", params: { content_type: "community_event", content_id: event.slug } };
    }
  }

  for (const [network, hrefConfigured] of Object.entries(siteConfig.social)) {
    if (samePath(url, hrefConfigured) || url.href.startsWith(hrefConfigured)) {
      return { name: "social_click", params: { network } };
    }
  }

  return null;
}

/** Resolve a clicked `<a>` (Next `<Link>` included) to a conversion event. */
export function trackCtaFromAnchor(anchor: HTMLAnchorElement) {
  const event = eventForUrl(anchor.href);
  if (event) track(event.name, event.params);
}
