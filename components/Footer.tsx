import { siteConfig } from "@/site.config";
import { LiteToggle } from "@/components/motion/LiteToggle";

const socialLinks = [
  { label: "X", href: siteConfig.social.x },
  { label: "LinkedIn", href: siteConfig.social.linkedin },
  { label: "Instagram", href: siteConfig.social.instagram },
  { label: "YouTube", href: siteConfig.social.youtube },
  { label: "GitHub", href: siteConfig.social.github },
  { label: "Discord", href: siteConfig.social.discord },
].filter((link): link is { label: string; href: string } => Boolean(link.href));

export function Footer() {
  return (
    <footer className="mt-auto border-t border-paper/10 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-4">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-2 text-sm text-paper/70 sm:items-end sm:text-right">
          <a href="/code-of-conduct" className="underline-offset-4 hover:text-paper hover:underline">
            Code of Conduct
          </a>
          <a href={`mailto:${siteConfig.contact.email}`} className="underline-offset-4 hover:text-paper hover:underline">
            {siteConfig.contact.email}
          </a>
          <LiteToggle />
        </div>
      </div>

      <p className="mt-8 max-w-2xl font-mono text-xs text-paper/50">{siteConfig.brandDisclaimer}</p>
    </footer>
  );
}
