"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = {
  deals: {
    label: "Deals sections",
    tabs: [
      { href: "/admin/deals", label: "Deals" },
      { href: "/admin/review", label: "Review" },
    ],
  },
  settings: {
    label: "Settings sections",
    tabs: [
      { href: "/admin/settings", label: "Commission" },
      { href: "/admin/staff", label: "Staff" },
      { href: "/admin/spiffs", label: "Spiffs" },
    ],
  },
} as const;

/** Second-level tabs for a top nav section (Deals → Review, Settings → Staff / Spiffs). */
export function SubNav({ section }: { section: keyof typeof SECTIONS }) {
  const pathname = usePathname();
  const { label, tabs } = SECTIONS[section];
  return (
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
              active ? "bg-primary-soft text-primary" : "bg-surface-subtle text-on-surface-muted hover:text-on-surface"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

