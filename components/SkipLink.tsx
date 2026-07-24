"use client";

import { usePathname } from "next/navigation";

export function SkipLink() {
  const pathname = usePathname();
  const target = pathname === "/" ? "#after-hero" : "#main";

  return (
    <a href={target} className="skip-link">
      Skip to content
    </a>
  );
}
