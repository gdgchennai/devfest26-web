import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";

// Branded 404. Reached by notFound() (e.g. an unknown speaker slug) and any
// unmatched URL. Renders inside the root layout, so the header/footer nav is
// still there — never a dead end.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-20 sm:px-8">
      <Eyebrow dotColor="yellow" className="mb-3">
        404
      </Eyebrow>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Page not found.</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        That link may be out of date. Try the agenda, or head back home.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/">Back home</Button>
        <Button href="/agenda" variant="secondary">
          View agenda
        </Button>
      </div>
    </div>
  );
}
