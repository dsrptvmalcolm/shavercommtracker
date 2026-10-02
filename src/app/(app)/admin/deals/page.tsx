import Link from "next/link";
import { MonthNav } from "@/components/month-nav";
import { getAllStaff, getDealsForMonth, getProducts, requireAdmin } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";
import { BackGrossInput } from "./back-gross-input";

export default async function AdminDealsPage({ searchParams }: { searchParams: Promise<{ month?: string; filter?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const [deals, staff, products] = await Promise.all([getDealsForMonth(month), getAllStaff(), getProducts()]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const missingOnly = sp.filter === "missing";
  const shown = missingOnly ? deals.filter((d) => d.back_gross == null && !d.is_house) : deals;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">All deals · {deals.length}</p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav month={month} basePath="/admin/deals" params={missingOnly ? { filter: "missing" } : {}} />
          <Link href="/deals/new" className="btn-primary px-4 py-2">+ Add deal</Link>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href={`/admin/deals?month=${month}`} className={`chip px-3 py-1 ${!missingOnly ? "bg-primary-soft text-primary" : "bg-surface-subtle text-on-surface-muted"}`}>All</Link>
        <Link href={`/admin/deals?month=${month}&filter=missing`} className={`chip px-3 py-1 ${missingOnly ? "bg-primary-soft text-primary" : "bg-surface-subtle text-on-surface-muted"}`}>No back gross</Link>
      </div>

      <p className="text-xs text-on-surface-subtle">Type back gross and press Enter or click away to save. Leave blank when there&apos;s none.</p>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Salesperson</th>
              <th className="px-4 py-3">Products / flags</th>
              <th className="px-4 py-3 text-right">Back gross</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={d.id} className={`border-b border-[#27272a] ${i % 2 ? "bg-[#1c1c1e]" : "bg-[#141416]"}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{shortDate(d.sale_date)}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{d.stock_number}</td>
                <td className="px-4 py-2.5 font-bold text-white">{d.customer_name}</td>
                <td className="px-4 py-2.5">
                  {d.is_house ? (
                    <span className="chip bg-surface-subtle text-on-surface-muted">House</span>
                  ) : (
                    <>
                      {names.get(d.salesperson_id!)}
                      {d.split_salesperson_id && <span className="text-on-surface-muted"> + {names.get(d.split_salesperson_id)}</span>}
                    </>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-on-surface-muted">
                  {[
                    ...d.deal_products.map((p) => productNames.get(p.product_id)),
                    d.ninety_day && "90 Day+",
                    d.multilingual && "Multi-lingual",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-4 py-2.5">
                  {d.is_house ? <span className="block text-right text-on-surface-subtle">—</span> : <BackGrossInput dealId={d.id} value={d.back_gross} />}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/deals/${d.id}`} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-on-surface-muted">Nothing here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
