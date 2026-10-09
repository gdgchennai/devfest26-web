import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Sessions" },
  { href: "/admin/users", label: "People" },
] as const;

export function AdminNav({ active }: { active: "/admin" | "/admin/users" }) {
  return (
    <nav className="flex gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            active === tab.href
              ? "border-paper bg-paper text-ink"
              : "border-paper/20 text-paper/70 hover:border-paper/40"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
