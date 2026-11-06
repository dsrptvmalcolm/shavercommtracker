"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, badge = 0, children }: { href: string; badge?: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
  return (
    // The link is the 44px tap area; the inner pill stays slim so the tab row doesn't look heavy
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
        active ? "text-primary" : "text-on-surface-muted hover:text-on-surface"
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 ${active ? "bg-primary-soft" : "group-hover:bg-white/5"}`}>
        {children}
        {badge > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs leading-5 tracking-normal text-black">
            {badge}
            <span className="sr-only"> {badge === 1 ? "alert" : "alerts"}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
