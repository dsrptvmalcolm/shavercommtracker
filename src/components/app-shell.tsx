import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { stopViewAs } from "@/app/(app)/view-as-actions";
import type { Viewer } from "@/lib/data";
import { DealFab } from "./deal-fab";
import { NavLink } from "./nav-link";

export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const { me, real, impersonating } = viewer;
  const home = me.is_salesperson ? "/dashboard" : "/admin";
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-surface-border/60 bg-surface/85 backdrop-blur-xl">
        {impersonating && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-primary px-4 py-2 text-center text-sm font-bold text-black">
            <span>
              Viewing as {me.name} — read only. You&apos;re signed in as {real.name}.
            </span>
            <form action={stopViewAs}>
              <button type="submit" className="rounded-full bg-black px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-primary hover:bg-black/80">
                Exit view
              </button>
            </form>
          </div>
        )}
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-10">
          <Link href={home} className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Shaver Preferred Motors" width={36} height={36} priority className="h-9 w-9 object-contain" />
            <span className="display hidden text-lg text-white sm:inline">Shaver Team</span>
          </Link>
          <div className="flex items-center gap-3">
            {!impersonating && (
              <Link href="/deals/new" className="btn-primary hidden px-5 py-2.5 sm:inline-flex">
                <span aria-hidden className="text-lg leading-none">+</span> {me.is_salesperson ? "Log Deal" : "Add Deal"}
              </Link>
            )}
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold leading-tight">{me.name}</p>
              <p className="text-xs font-medium text-primary">{me.is_admin ? "Admin" : "Sales"}</p>
            </div>
            {!impersonating && (
              <form action={signOut}>
                <button type="submit" className="text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-on-surface">
                  Sign out
                </button>
              </form>
            )}
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
      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 pb-28 lg:px-10 lg:pt-10">{children}</main>
      {!impersonating && <DealFab label={me.is_salesperson ? "Log Deal" : "Add Deal"} />}
    </>
  );
}
