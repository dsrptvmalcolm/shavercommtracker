"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Floating "Log Deal" button, always within thumb reach. Hidden on the deal form itself. */
export function DealFab({ label }: { label: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/deals")) return null;
  return (
    <Link
      href="/deals/new"
      className="fixed right-4 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-extrabold uppercase tracking-wider text-black shadow-[0_0_32px_rgba(250,204,21,0.45),0_8px_24px_rgba(0,0,0,0.6)] transition-all hover:bg-primary-hover hover:shadow-[0_0_44px_rgba(250,204,21,0.6)] active:scale-95 lg:right-10 lg:bottom-8"
    >
      <span aria-hidden className="text-2xl leading-none">+</span>
      {label}
    </Link>
  );
}
