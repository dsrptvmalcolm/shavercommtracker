"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] sm:px-3 font-extrabold uppercase tracking-[0.08em] transition-colors ${
        active ? "bg-primary-soft text-primary" : "text-on-surface-muted hover:text-on-surface"
      }`}
    >
      {children}
    </Link>
  );
}
