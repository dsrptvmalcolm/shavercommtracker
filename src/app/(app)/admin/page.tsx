import Link from "next/link";
import { MonthNav } from "@/components/month-nav";
import { StatTile } from "@/components/stat-tile";
import { paceFor, storeVolumeSpiffFor } from "@/lib/commission/engine";
import { getStoreMonth, requireAdmin } from "@/lib/data";
import { money, money0, units as fmtUnits } from "@/lib/format";
import { currentMonth, daysElapsed, daysInMonth, isClosed, isMonth, monthLabel } from "@/lib/months";

export default async function StorePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const view = await getStoreMonth(month);

  const closed = isClosed(month);
  const pace = closed ? view.storeUnits : paceFor(view.storeUnits, daysElapsed(month), daysInMonth(month));
  const tiers = [...view.settings.store_volume_tiers].sort((a, b) => a.units - b.units);
  const earned = storeVolumeSpiffFor(view.storeUnits, tiers);
  const next = tiers.find((t) => t.units > view.storeUnits);
  const missingBack = view.deals.filter((d) => d.back_gross == null && !d.is_house).length;

  const rows = view.rows.map((r) => ({ ...r, shown: r.paid?.total ?? r.summary.total }));
  const payroll = rows.reduce((a, r) => a + r.shown, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Store overview</p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} basePath="/admin" />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatTile label="Store units" value={view.storeUnits} badge={closed ? undefined : `pace ${Math.round(pace)}`} detail={`${view.houseUnits} house deals`} />
        <StatTile
          label="Store volume spiff"
          value={money0(earned)}
          tone={earned > 0 ? "primary" : "default"}
          detail={next ? `${next.units - view.storeUnits} units to ${money0(next.amount)} each` : "Top tier reached"}
        />
        <StatTile label="Commission" value={money0(payroll)} detail={`${rows.length} salespeople`} />
        <StatTile
          label="No back gross"
          value={missingBack}
          tone={missingBack > 0 ? "primary" : "success"}
          detail={<Link href={`/admin/deals?month=${month}&filter=missing`} className="underline hover:text-white">Review →</Link>}
        />
      </section>

      <section className="space-y-4">
        <h2 className="display text-2xl text-white">Salespeople</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Salesperson</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Mini</th>
                <th className="px-4 py-3 text-right">Deals only</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Spiffs</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ staff, summary, paid, shown }, i) => {
                const vehicle = paid?.vehicle_commission ?? summary.vehicleCommission;
                const products = paid?.product_spiffs ?? summary.productSpiffs;
                const diff = paid ? summary.total - paid.total : 0;
                return (
                  <tr key={staff.id} className={`border-b border-[#27272a] ${i % 2 ? "bg-[#1c1c1e]" : "bg-[#141416]"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard?staff=${staff.id}&month=${month}`} className="font-bold text-white hover:text-primary">{staff.name}</Link>
                      <Link href={`/history?staff=${staff.id}`} className="ml-2 text-xs text-on-surface-subtle hover:text-primary">history</Link>
                      {summary.personalBest && <span className="chip ml-2 bg-success/10 text-success">Personal best</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmtUnits(paid?.units ?? summary.units)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money0(paid?.mini_rate ?? summary.miniRate)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(vehicle)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(products)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(shown - vehicle - products)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      {money(shown)}
                      {paid && (
                        <span className={`block text-[10px] font-normal ${Math.abs(diff) > 0.01 ? "text-amber-300" : "text-on-surface-subtle"}`}>
                          {Math.abs(diff) > 0.01 ? `as paid · recalc ${diff > 0 ? "+" : ""}${money(diff)}` : "as paid"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
