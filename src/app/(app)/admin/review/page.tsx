import Link from "next/link";
import type { DealRow, Staff } from "@/lib/data";
import { getAllStaff, getDealsMissingBackGross, getDealsNeedingAction, getPaidMonths, requireAdmin } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/months";
import { BackGrossInput } from "../deals/back-gross-input";
import { FlagNeedsAction, ResolveNeedsAction } from "./needs-action-controls";

function DealSummary({ deal, names }: { deal: DealRow; names: Map<string, string> }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-bold text-white">{deal.customer_name}</p>
      <p className="text-sm text-on-surface-muted">
        <span className="font-mono text-xs">{shortDate(deal.sale_date)} · #{deal.stock_number}</span>
        {" · "}
        {deal.is_house ? "House" : names.get(deal.salesperson_id!)}
        {deal.split_salesperson_id && ` + ${names.get(deal.split_salesperson_id)}`}
      </p>
    </div>
  );
}

const EditLink = ({ id }: { id: string }) => (
  <Link href={`/deals/${id}`} className="inline-flex min-h-11 items-center px-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline">
    Edit
  </Link>
);

export default async function DealReviewPage() {
  await requireAdmin();
  const [paid, staff, flagged] = await Promise.all([getPaidMonths(), getAllStaff(), getDealsNeedingAction()]);
  // Months imported from Airtable are already paid — review starts the month after the last one
  const lastPaid = paid.at(-1)?.month;
  const fromMonth = lastPaid ? shiftMonth(lastPaid, 1) : currentMonth();
  const missing = await getDealsMissingBackGross(fromMonth);
  const names = new Map(staff.map((s: Staff) => [s.id, s.name]));

  return (
    <>
      <div>
        <p className="eyebrow text-primary">Admin</p>
        <h1 className="display text-4xl text-white lg:text-5xl">Deal Review</h1>
      </div>

      <section aria-labelledby="needs-action" className="space-y-3">
        <h2 id="needs-action" className="eyebrow text-on-surface-muted">Needs action · {flagged.length}</h2>
        <div className="card divide-y divide-surface-border">
          {flagged.map((d) => (
            <div key={d.id} className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <DealSummary deal={d} names={names} />
                <EditLink id={d.id} />
              </div>
              {d.deal_notes && <p className="whitespace-pre-line text-sm text-on-surface">{d.deal_notes}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ResolveNeedsAction dealId={d.id} />
                {!d.is_house && (
                  <div className="flex items-center gap-2 text-sm text-on-surface-muted">
                    Back gross <BackGrossInput dealId={d.id} value={d.back_gross} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {flagged.length === 0 && <p className="p-6 text-center text-sm text-on-surface-muted">No deals need action.</p>}
        </div>
        {flagged.length > 0 && <p className="text-xs text-on-surface-subtle">Uncheck a deal once it&apos;s handled.</p>}
      </section>

      <section aria-labelledby="missing-gross" className="space-y-3">
        <h2 id="missing-gross" className="eyebrow text-on-surface-muted">
          No back gross · {missing.length}
          <span className="normal-case tracking-normal text-on-surface-subtle"> — since {monthLabel(fromMonth)}</span>
        </h2>
        <div className="card divide-y divide-surface-border">
          {missing.map((d) => (
            <div key={d.id} className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <DealSummary deal={d} names={names} />
                <EditLink id={d.id} />
              </div>
              {d.deal_notes && <p className="whitespace-pre-line text-sm text-on-surface-muted">{d.deal_notes}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {d.needs_action ? (
                  <span className="chip bg-danger/10 text-danger">Needs action</span>
                ) : (
                  <FlagNeedsAction dealId={d.id} />
                )}
                <div className="flex items-center gap-2 text-sm text-on-surface-muted">
                  Back gross <BackGrossInput dealId={d.id} value={d.back_gross} />
                </div>
              </div>
            </div>
          ))}
          {missing.length === 0 && <p className="p-6 text-center text-sm text-on-surface-muted">Every deal has back gross.</p>}
        </div>
        <p className="text-xs text-on-surface-subtle">Type back gross and press Enter or click away to save. Enter 0 when a deal has none — it leaves this list.</p>
      </section>
    </>
  );
}
