import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllStaff, getPaidMonths, getSalespersonMonth, getUnitsByMonth, requireMe } from "@/lib/data";
import { money, units as fmtUnits } from "@/lib/format";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/months";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const staff = sp.staff && me.is_admin ? (await getAllStaff()).find((s) => s.id === sp.staff) : me;
  if (!staff) notFound();

  const [paid, unitsByMonth] = await Promise.all([getPaidMonths(staff.id), getUnitsByMonth(staff.id)]);
  const first = [...unitsByMonth.keys(), ...paid.map((p) => p.month)].sort()[0] ?? currentMonth();
  const months: string[] = [];
  for (let m = currentMonth(); m >= first; m = shiftMonth(m, -1)) months.push(m);

  // Paid months are stored; everything since is calculated live
  const rows = await Promise.all(
    months.map(async (m) => {
      const p = paid.find((x) => x.month === m);
      if (p) {
        return { month: m, units: p.units, twoCar: p.two_car_day_count, hatTrick: p.hat_trick_day_count, pb: p.personal_best_spiff > 0, vehicle: p.vehicle_commission, total: p.total, paid: true };
      }
      const { summary } = await getSalespersonMonth(staff, m);
      return { month: m, units: summary.units, twoCar: summary.twoCarDayCount, hatTrick: summary.hatTrickDayCount, pb: summary.personalBest, vehicle: summary.vehicleCommission, total: summary.total, paid: false };
    }),
  );
  const best = Math.max(staff.personal_best_units, ...rows.map((r) => r.units));
  const qs = sp.staff ? `&staff=${sp.staff}` : "";

  return (
    <>
      <div>
        <p className="eyebrow text-primary">{staff.id === me.id ? "Your history" : staff.name}</p>
        <h1 className="display text-4xl text-white lg:text-5xl">Sales History</h1>
        <p className="mt-2 text-sm text-on-surface-muted">Best month: <strong className="text-white">{fmtUnits(best)} units</strong></p>
      </div>
      <div className="card overflow-x-auto">
        {/* Phones show Month, Units, Best and Total; the per-month detail columns join from 640px up */}
        <table className="w-full text-sm sm:min-w-[640px]">
          <thead className="table-head">
            <tr>
              <th className="px-2.5 sm:px-4 py-3">Month</th>
              <th className="px-2.5 sm:px-4 py-3 text-right">Units</th>
              <th className="hidden px-2.5 sm:px-4 py-3 text-right sm:table-cell">2-Car</th>
              <th className="hidden px-2.5 sm:px-4 py-3 text-right sm:table-cell">Hat Trick</th>
              <th className="px-2.5 sm:px-4 py-3 text-center">Best?</th>
              <th className="hidden px-2.5 sm:px-4 py-3 text-right sm:table-cell">Deals only</th>
              <th className="px-2.5 sm:px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.month} className={`border-b border-[#27272a] ${i % 2 ? "bg-[#1c1c1e]" : "bg-[#141416]"} hover:bg-surface-card-hover`}>
                <td className="px-2.5 sm:px-4 py-0">
                  <Link href={`/dashboard?month=${r.month}${qs}`} className="inline-flex min-h-11 items-center font-bold text-white hover:text-primary">{monthLabel(r.month)}</Link>
                  {r.paid && <span className="chip ml-2 bg-surface-subtle text-on-surface-subtle">Paid</span>}
                </td>
                <td className="px-2.5 sm:px-4 py-3 text-right font-mono">{fmtUnits(r.units)}</td>
                <td className="hidden px-2.5 sm:px-4 py-3 text-right font-mono sm:table-cell">{r.twoCar}</td>
                <td className="hidden px-2.5 sm:px-4 py-3 text-right font-mono sm:table-cell">{r.hatTrick}</td>
                <td className="px-2.5 sm:px-4 py-3 text-center">{r.pb ? <span className="text-success">★</span> : <span className="text-on-surface-subtle">—</span>}</td>
                <td className="hidden px-2.5 sm:px-4 py-3 text-right font-mono sm:table-cell">{money(r.vehicle)}</td>
                <td className="px-2.5 sm:px-4 py-3 text-right font-mono font-bold text-white">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
