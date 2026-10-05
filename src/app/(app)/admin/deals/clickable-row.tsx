"use client";

import { useRouter } from "next/navigation";

/**
 * Table row that opens `href` when clicked anywhere — except on its own inputs, buttons and links,
 * so inline back gross entry still works. Keyboard users use the row's Edit link.
 */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("input, button, a, select, textarea, label")) return;
        if (window.getSelection()?.toString()) return; // don't navigate when selecting text to copy
        router.push(href);
      }}
      className={`cursor-pointer transition-colors hover:bg-surface-card-hover! ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}
