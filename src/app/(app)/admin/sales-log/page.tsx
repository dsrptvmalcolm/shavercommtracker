import Link from "next/link";
import { MonthNav } from "@/components/month-nav";
import { getSalesLogData, requireAdmin } from "@/lib/data";
import { money0, shortDate } from "@/lib/format";
import { buildSalesLog, type SalesLogRow } from "@/lib/inventory/sales-log";
import { vehicleHref } from "@/lib/inventory/vehicle";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";

const days = (n: number | null) => (n === null ? "—" : `${n} ${n === 1 ? "day" : "days"}`);

function DealCell({ row }: { row: SalesLogRow }) {
  return row.dealId ? (
    <Link href={`/deals/${row.dealId}`} className="inline-flex min-h-11 items-center font-bold text-primary hover:underline">
      Deal →
    </Link>
  ) : (
    <span className="inline-flex min-h-11 items-center text-on-surface-subtle">No deal</span>
  );
}

export default async function SalesLogPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const rows = buildSalesLog({ ...(await getSalesLogData(month)), month });
  const linked = rows.filter((r) => r.dealId).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">
            Sales log · {rows.length} left · {linked} with a deal
          </p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} basePath="/admin/sales-log" />
      </div>

      <p className="text-xs text-on-surface-muted">
        Every car that left inventory, by the day it dropped off the feed. A linked deal means a retail sale logged here; no deal can mean wholesale or moved.
      </p>

      {rows.length === 0 ? (
        <p className="card p-6 text-sm text-on-surface-muted">No cars left inventory in {monthLabel(month)}.</p>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <li key={r.eventId} className="card p-4">
                <Link href={vehicleHref(r.stockNumber, r.vehicleId)} className="flex min-h-11 items-center font-bold leading-snug text-white hover:underline">{r.title}</Link>
                <p className="text-xs text-on-surface-muted">
                  #{r.stockNumber}
                  {r.bodyStyle && <> · {r.bodyStyle}</>} · left {shortDate(r.leftOn)}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 text-sm">
                  <span>
                    <span className="text-on-surface-muted">{money0(r.firstPrice)} → </span>
                    <span className="font-bold text-white">{money0(r.lastPrice)}</span>
                  </span>
                  <span className="text-on-surface-muted">{days(r.daysOnLot)}</span>
                  <DealCell row={r} />
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="card hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Left</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Body</th>
                  <th className="px-4 py-3 text-right">First price</th>
                  <th className="px-4 py-3 text-right">Last price</th>
                  <th className="px-4 py-3 text-right">Days on lot</th>
                  <th className="px-4 py-3">Deal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.eventId} className={`border-b border-surface-border/60 ${i % 2 ? "bg-surface-subtle" : ""}`}>
                    <td className="px-4 py-1 font-mono text-xs">{shortDate(r.leftOn)}</td>
                    <td className="px-4 py-1 font-mono text-xs">{r.stockNumber}</td>
                    <td className="px-4 py-1">
                      <Link href={vehicleHref(r.stockNumber, r.vehicleId)} className="inline-flex min-h-11 items-center font-bold text-white hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-4 py-1 text-on-surface-muted">{r.bodyStyle || "—"}</td>
                    <td className="px-4 py-1 text-right">{money0(r.firstPrice)}</td>
                    <td className="px-4 py-1 text-right font-bold text-white">{money0(r.lastPrice)}</td>
                    <td className="px-4 py-1 text-right">{r.daysOnLot ?? "—"}</td>
                    <td className="px-4 py-1">
                      <DealCell row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
