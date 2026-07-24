import Link from "next/link";
import { siteConfig } from "@/site.config";
import { speakers } from "@/lib/content";

export function Header() {
  const nav = siteConfig.nav.filter((item) => {
    if (item.href === "/speakers") return speakers.length > 0;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between bg-ink px-4 sm:px-8">
      <Link href="/" className="font-semibold tracking-tight">
        {siteConfig.shortName}
      </Link>

      <nav className="hidden items-center gap-6 md:flex">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-paper/80 decoration-blue underline-offset-4 hover:text-paper hover:underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <a
          href={siteConfig.ticketing.url ?? "/agenda"}
          className="rounded-full bg-blue px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
        >
          Get Tickets
        </a>

        <details className="relative md:hidden">
          <summary className="list-none cursor-pointer rounded p-2 text-paper/80 hover:text-paper [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <nav className="absolute right-0 top-full mt-2 flex w-44 flex-col gap-1 rounded-lg bg-ink p-2 shadow-lg ring-1 ring-paper/10">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm text-paper/80 hover:bg-paper/10 hover:text-paper"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
