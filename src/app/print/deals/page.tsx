import type { Metadata } from "next";
import { getAllStaff, getDealsForMonth, getProducts, requireAdmin } from "@/lib/data";
import { money, shortDate } from "@/lib/format";
import { currentMonth, isMonth, monthLabel, todayIso } from "@/lib/months";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Deals — Shaver Team" };

/** Printable deal log for one month (admins). Lives outside the app shell so it prints clean on white. */
export default async function PrintDealsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const [deals, staff, products] = await Promise.all([getDealsForMonth(month), getAllStaff(), getProducts()]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  // Oldest first reads naturally on paper
  const rows = [...deals].sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  const totalBack = rows.reduce((sum, d) => sum + (d.back_gross ?? 0), 0);
  const missing = rows.filter((d) => d.back_gross == null && !d.is_house).length;

  return (
    <div className="min-h-dvh bg-white px-4 py-8 text-black sm:px-10 print:p-0">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Shaver Preferred Motors · Deal log</p>
            <h1 className="display text-4xl">{monthLabel(month)}</h1>
            <p className="mt-1 text-sm text-zinc-700">
              {rows.length} deals · {money(totalBack)} back gross
              {missing > 0 && ` · ${missing} without back gross`} · Printed {shortDate(todayIso())}
            </p>
          </div>
          <PrintButton />
        </header>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[720px] border-collapse text-sm print:min-w-0 print:text-xs">
            <thead>
              <tr className="border-b border-black text-left text-xs font-bold uppercase tracking-wider">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Salesperson</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Stock # / Deal #</th>
                <th className="py-2 pr-3">Products</th>
                <th className="py-2 text-right">Back gross</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="break-inside-avoid border-b border-zinc-300 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{shortDate(d.sale_date)}</td>
                  <td className="py-2 pr-3">
                    {d.is_house ? "House" : names.get(d.salesperson_id!)}
                    {d.split_salesperson_id && ` + ${names.get(d.split_salesperson_id)}`}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{d.customer_name}</td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    {d.stock_number}
                    {d.deal_number && <span className="text-zinc-600"> / {d.deal_number}</span>}
                  </td>
                  <td className="py-2 pr-3">{d.deal_products.map((p) => productNames.get(p.product_id)).filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-2 text-right font-mono whitespace-nowrap">{d.is_house ? "—" : money(d.back_gross)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600">No deals this month.</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={5} className="py-2">Total · {rows.length} deals</td>
                  <td className="py-2 text-right font-mono">{money(totalBack)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
