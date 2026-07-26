import Link from "next/link";
import { Frame } from "@/components/Frame";
import { SectionDivider } from "@/components/SectionDivider";
import { NotFoundRecovery } from "@/components/NotFoundRecovery";
import { NotFoundHighlights } from "@/components/NotFoundHighlights";
import { siteRoutes } from "@/lib/routes";
import { archivePhotos } from "@/lib/content";
import { siteConfig, formatEventDate } from "@/site.config";

/*
 * Branded 404. Reached by notFound() (e.g. an unknown speaker slug) and by
 * every unmatched URL. Renders inside the root layout, so the header and
 * footer nav are still there — never a dead end.
 *
 * Design rule for this page: whoever is reading it is already annoyed, so
 * every flourish here has to shorten the way out rather than decorate the
 * dead end. Nothing animates on a delay, nothing blocks, and the headline,
 * the highlights and the full route list are all in the static HTML —
 * readable before hydration and with JavaScript off. The one piece that waits
 * for the browser is the piece that needs the URL, and it reserves its own
 * height so nothing jumps.
 *
 * Order matters: the three things people actually came for go first, and the
 * complete index second. A visitor who mistyped wants a destination, not an
 * inventory.
 */

// A stable pick, not a random one: a random photo would differ between the
// prerender and hydration. The group shot is the warmest thing in the archive,
// which is the right note to end an error page on.
const CONSOLATION =
  archivePhotos.find((p) => p.src.includes("group-photo")) ?? archivePhotos[0];

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
      {/*
        Four brand dots with one burnt out. The site's whole identity is these
        four colours, so "one of them is missing" says page-not-found in the
        site's own language before a word is read — and unlike a giant "404"
        it doesn't shout at someone who already knows.
      */}
      <div className="signal-dots" aria-hidden>
        <span className="signal-dots__dot bg-blue" />
        <span className="signal-dots__dot bg-red" />
        <span className="signal-dots__dot signal-dots__dot--out" />
        <span className="signal-dots__dot bg-green" />
      </div>

      <p className="mt-6 font-mono text-xs uppercase tracking-wider text-paper/50">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Page not found.</h1>

      <div className="mt-4">
        <NotFoundRecovery />
      </div>

      <div className="mt-10">
        <SectionDivider />
      </div>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">
        What most people are looking for
      </h2>
      <div className="mt-4">
        <NotFoundHighlights />
      </div>

      {/*
        The complete index, deliberately lighter than the highlights above —
        it's the fallback for someone whose destination isn't one of the three,
        not the main event.
      */}
      <h2 className="mt-12 font-mono text-xs uppercase tracking-wider text-paper/50">
        Everywhere else on the site
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {siteRoutes.map((route) => (
          <li key={route.href}>
            <Link
              href={route.href}
              className="flex items-baseline gap-2 rounded-full border border-paper/10 bg-paper/[0.03] px-4 py-2 text-sm transition-colors hover:border-paper/25 hover:bg-paper/[0.06]"
            >
              {route.label}
              <span className="font-mono text-xs text-paper/55">{route.href}</span>
            </Link>
          </li>
        ))}
      </ul>

      {CONSOLATION && (
        <>
          <div className="mt-12">
            <SectionDivider />
          </div>

          <Link href="/memories" className="group mt-8 block sm:flex sm:items-center sm:gap-6">
            <div className="w-full opacity-60 transition-opacity group-hover:opacity-100 sm:w-56 sm:shrink-0">
              <Frame
                src={CONSOLATION.src}
                alt={CONSOLATION.description}
                title={CONSOLATION.title}
                aspectRatio="3 / 2"
                sizes="(max-width: 640px) 100vw, 14rem"
              />
            </div>
            <div className="mt-4 sm:mt-0">
              <p className="font-semibold">While you&rsquo;re here</p>
              <p className="mt-1 max-w-md text-sm text-paper/70">
                The 2024 and 2025 archive is the one part of this site that was never going to
                404. {CONSOLATION.title} &rarr;
              </p>
            </div>
          </Link>
        </>
      )}

      {/*
        Ends on the event, not on the error. Reads from the config, so it can
        never contradict the date on the hero or the ticket stub.
      */}
      <p className="mt-16 text-xl font-semibold tracking-tight">
        Hope to see you at DevFest.
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-paper/60">
        {formatEventDate(siteConfig.date)} &middot; {siteConfig.venue.name}
      </p>
    </div>
  );
}
