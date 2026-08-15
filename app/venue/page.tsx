import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = { title: "Venue" };

export default function VenuePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Venue</h1>
      {!siteConfig.venue.confirmed && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-yellow">
          Venue pending final confirmation
        </p>
      )}

      <p className="mt-6 text-lg">{siteConfig.venue.name}</p>
      <p className="text-paper/70">{siteConfig.venue.line1}</p>
      <p className="text-paper/70">{siteConfig.venue.line2}</p>

      <a
        href={siteConfig.venue.mapUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm text-blue underline underline-offset-4 hover:decoration-2"
      >
        Open in Google Maps →
      </a>

      <div className="mt-10">
        <h2 className="text-xl font-semibold">Getting there</h2>
        <p className="mt-2 text-paper/70">
          Travel and parking details for the venue will be added closer to the event, including
          the nearest metro station and shuttle information if arranged.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold">Amenities</h2>
        <ul className="mt-2 list-inside list-disc text-paper/70">
          <li>Wi-fi across all halls</li>
          <li>Charging points near seating areas</li>
          <li>On-site food and beverage counters</li>
          <li>Accessible entrances and restrooms</li>
        </ul>
      </div>
    </div>
  );
}
