import Link from "next/link";

// Branded 404. Reached by notFound() (e.g. an unknown speaker slug) and any
// unmatched URL. Renders inside the root layout, so the header/footer nav is
// still there — never a dead end.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-20 sm:px-8">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-paper/60">
        <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
        404
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Page not found.</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        That link may be out of date. Try the agenda, or head back home.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full bg-blue px-6 py-3 text-sm font-medium text-paper hover:opacity-90"
        >
          Back home
        </Link>
        <Link
          href="/agenda"
          className="rounded-full border border-paper/30 px-6 py-3 text-sm font-medium text-paper hover:bg-paper/10"
        >
          View agenda
        </Link>
      </div>
    </div>
  );
}
