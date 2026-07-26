import Link from "next/link";
import { Button, inertButtonClasses } from "@/components/Button";
import { HeaderNav, HeaderMenu } from "@/components/HeaderNav";
import { siteConfig } from "@/site.config";
import { speakers } from "@/lib/content";
import { ticketCta } from "@/lib/cta";

export function Header() {
  const nav = siteConfig.nav.filter((item) => {
    if (item.href === "/speakers") return speakers.length > 0;
    return true;
  });

  const cta = ticketCta();

  return (
    // The hairline is what separates the bar from content scrolling beneath
    // it; bg-ink alone gave a sticky header with no edge, so rows appeared to
    // be sliced off mid-scroll.
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-paper/10 bg-ink px-4 sm:px-8">
      <Link href="/" className="font-semibold tracking-tight">
        {siteConfig.shortName}
      </Link>

      <HeaderNav nav={nav} />

      <div className="flex items-center gap-3">
        {cta.available ? (
          <Button href={cta.href} size="sm">
            {cta.label}
          </Button>
        ) : (
          // Not a link: there is nowhere to go yet. See lib/cta.ts.
          <span className={`hidden sm:inline-block ${inertButtonClasses("sm")}`}>{cta.label}</span>
        )}

        <HeaderMenu nav={nav} />
      </div>
    </header>
  );
}
