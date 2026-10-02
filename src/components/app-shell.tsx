import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Staff } from "@/lib/data";
import { NavLink } from "./nav-link";

export function AppShell({ me, children }: { me: Staff; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-surface-border/60 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg text-black">S</span>
            <span className="display hidden text-lg text-white sm:inline">Shaver Team</span>
          </Link>
          <div className="flex items-center gap-3">
            {me.is_salesperson && (
              <Link href="/deals/new" className="btn-primary px-4 py-2 font-display tracking-wider">
                <span aria-hidden className="text-lg leading-none">+</span> Log Deal
              </Link>
            )}
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold leading-tight">{me.name}</p>
              <p className="text-xs font-medium text-primary">{me.is_admin ? "Admin" : "Sales"}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-on-surface">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 lg:px-10">
          {me.is_salesperson && (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/history">History</NavLink>
            </>
          )}
          {me.is_admin && (
            <>
              <NavLink href="/admin">Store</NavLink>
              <NavLink href="/admin/deals">Deals</NavLink>
              <NavLink href="/admin/spiffs">Spiffs</NavLink>
              <NavLink href="/admin/staff">Staff</NavLink>
              <NavLink href="/admin/settings">Settings</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 pb-20 lg:px-10 lg:pt-10">{children}</main>
    </>
  );
}
