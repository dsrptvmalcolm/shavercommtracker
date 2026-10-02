"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
        active ? "bg-primary-soft text-primary" : "text-on-surface-muted hover:text-on-surface"
      }`}
    >
      {children}
    </Link>
  );
}
