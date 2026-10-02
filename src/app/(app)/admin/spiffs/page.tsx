import { ActionForm } from "@/components/action-form";
import { MonthNav } from "@/components/month-nav";
import { getAdjustments, getAllStaff, requireAdmin } from "@/lib/data";
import { money } from "@/lib/format";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";
import { addAdjustment } from "../actions";
import { RemoveButton } from "./remove-button";

export default async function SpiffsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const [adjustments, staff] = await Promise.all([getAdjustments(month), getAllStaff()]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const salespeople = staff.filter((s) => s.is_salesperson && s.active);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">One-off &amp; team spiffs</p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} basePath="/admin/spiffs" />
      </div>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="card p-6 lg:col-span-5">
          <h2 className="display mb-4 text-xl text-white">Add a spiff</h2>
          <ActionForm action={addAdjustment} submitLabel="Add spiff" className="space-y-4">
            <input type="hidden" name="month" value={month} />
            <div>
              <label htmlFor="staff_id" className="field-label">Who</label>
              <select id="staff_id" name="staff_id" required className="input">
                <option value="team">Whole team (each active salesperson)</option>
                {salespeople.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="amount" className="field-label">Amount</label>
              <input id="amount" name="amount" inputMode="decimal" required placeholder="250" className="input" />
              <p className="mt-1 text-xs text-on-surface-subtle">Use a negative number for a chargeback.</p>
            </div>
            <div>
              <label htmlFor="note" className="field-label">What it&apos;s for</label>
              <input id="note" name="note" required placeholder="Weekend sales contest winner" className="input" />
            </div>
          </ActionForm>
        </div>

        <div className="card overflow-hidden lg:col-span-7">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Salesperson</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a, i) => (
                <tr key={a.id} className={`border-b border-[#27272a] ${i % 2 ? "bg-[#1c1c1e]" : "bg-[#141416]"}`}>
                  <td className="px-4 py-3 font-bold text-white">{names.get(a.staff_id)}</td>
                  <td className="px-4 py-3 text-on-surface-muted">{a.note}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(a.amount)}</td>
                  <td className="px-4 py-3 text-right"><RemoveButton id={a.id} /></td>
                </tr>
              ))}
              {adjustments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-muted">No spiffs this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
