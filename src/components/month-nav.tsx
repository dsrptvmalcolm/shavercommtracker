import Link from "next/link";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/months";

/** Prev / next month links that keep the other query params. */
export function MonthNav({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string> }) {
  const href = (m: string) => `${basePath}?${new URLSearchParams({ ...params, month: m })}`;
  const isCurrent = month >= currentMonth();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-surface-border/80 bg-surface-subtle text-sm">
      <Link href={href(shiftMonth(month, -1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-muted hover:text-white" aria-label="Previous month">
        ←
      </Link>
      <span className="flex items-center gap-2 px-1 font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? "bg-primary" : "bg-on-surface-subtle"}`} />
        {monthLabel(month)}
      </span>
      {isCurrent ? (
        <span className="inline-flex h-11 w-11 items-center justify-center text-on-surface-subtle/40">→</span>
      ) : (
        <Link href={href(shiftMonth(month, 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-muted hover:text-white" aria-label="Next month">
          →
        </Link>
      )}
    </div>
  );
}
