import { siteConfig } from "@/site.config";
import { LiteToggle } from "@/components/motion/LiteToggle";
import { FooterLogo } from "@/components/FooterLogo";

// Annotated rather than inferred: `siteConfig` is `as const`, so each `href`
// is a string *literal* type, and the array would otherwise not match the
// `{ label: string; href: string }[]` FooterLogo asks for. This also replaced
// a `.filter(Boolean)` on `href` that could never drop anything — every URL
// here is a non-empty literal — and whose type predicate widened the literal
// back to `string`, which is what broke the build.
const socialLinks: { label: string; href: string }[] = [
  { label: "X", href: siteConfig.social.x },
  { label: "Instagram", href: siteConfig.social.instagram },
  { label: "LinkedIn", href: siteConfig.social.linkedin },
  { label: "YouTube", href: siteConfig.social.youtube },
  { label: "GitHub", href: siteConfig.social.github },
  { label: "Discord", href: siteConfig.social.discord },
];

export function Footer() {
  return (
    // relative z-10: lift the footer above the fixed BracketsField backdrop
    // (z-0), which lives inside <main> and would otherwise paint its opaque
    // layer over the footer's non-positioned card, wordmark and pill.
    <footer className="relative z-10 mt-auto px-4 py-16 sm:px-8">
      <FooterLogo social={socialLinks} />

      {/* Utility + legal strip. Kept below the brand lock-up so the Google
          disclaimer, Code of Conduct and lite toggle stay reachable without
          crowding the mark. */}
      <div className="mx-auto mt-10 flex w-full max-w-2xl flex-col items-center gap-4 text-center text-sm text-paper/70">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="/code-of-conduct" className="underline-offset-4 hover:text-paper hover:underline">
            Code of Conduct
          </a>
          <a href={`mailto:${siteConfig.contact.email}`} className="underline-offset-4 hover:text-paper hover:underline">
            {siteConfig.contact.email}
          </a>
          <LiteToggle />
        </div>
        {/* /50 is as muted as this may go: on the dark page it measures
            4.76:1, and 12px legal text needs 4.5:1. Anything fainter fails. */}
        <p className="max-w-2xl font-mono text-xs text-paper/50">{siteConfig.brandDisclaimer}</p>
      </div>
    </footer>
  );
}
