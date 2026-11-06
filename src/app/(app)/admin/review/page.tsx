import Link from "next/link";
import type { DealRow, Staff } from "@/lib/data";
import { getAllStaff, getDealsMissingBackGross, getDealsNeedingAction, getPaidMonths, requireAdmin } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/months";
import { BackGrossInput } from "../deals/back-gross-input";
import { FlagNeedsAction, ResolveNeedsAction } from "./needs-action-controls";
import { SubNav } from "@/components/sub-nav";

const BACK_GROSS_TIP = "Input back end gross or input “0” to confirm no back end gross";

/** Back gross field with a tooltip above it — shown on hover and whenever the field (or info button) has focus, so taps work too. */
function BackGrossField({ deal }: { deal: DealRow }) {
  const tipId = `bg-tip-${deal.id}`;
  return (
    <div className="group relative flex items-center gap-2 text-sm text-on-surface-muted">
      <span>Back gross</span>
      <button type="button" aria-describedby={tipId} aria-label="About back gross" className="-mx-3 inline-flex min-h-11 min-w-11 items-center justify-center text-on-surface-subtle hover:text-primary focus:text-primary">
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-bold">i</span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full z-10 mb-2 hidden w-60 rounded-md border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-on-surface shadow-lg group-hover:block group-focus-within:block"
      >
        {BACK_GROSS_TIP}
      </span>
      <BackGrossInput dealId={deal.id} value={deal.back_gross} />
    </div>
  );
}

/** One deal: summary | notes | actions on wider screens, stacked on phones. */
function ReviewRow({ deal, names, action }: { deal: DealRow; names: Map<string, string>; action: React.ReactNode }) {
  return (
    <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-white">{deal.customer_name}</p>
          <p className="text-sm text-on-surface-muted">
            <span className="font-mono text-xs">{shortDate(deal.sale_date)} · #{deal.stock_number}</span>
            {" · "}
            {deal.is_house ? "House" : names.get(deal.salesperson_id!)}
            {deal.split_salesperson_id && ` + ${names.get(deal.split_salesperson_id)}`}
          </p>
        </div>
        <Link href={`/deals/${deal.id}`} className="-mr-2 inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline lg:hidden">
          Edit
        </Link>
      </div>
      <div className="min-w-0 rounded-md bg-surface-subtle px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-subtle">Notes</p>
        <p className={`whitespace-pre-line text-sm ${deal.deal_notes ? "text-on-surface" : "text-on-surface-subtle"}`}>{deal.deal_notes || "No notes"}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
        {action}
        {!deal.is_house && <BackGrossField deal={deal} />}
        <Link href={`/deals/${deal.id}`} className="-mr-2 hidden min-h-11 items-center px-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline lg:inline-flex">
          Edit
        </Link>
      </div>
    </div>
  );
}

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
      <SubNav section="deals" />
      <div>
        <p className="eyebrow text-primary">Admin</p>
        <h1 className="display text-4xl text-white lg:text-5xl">Deal Review</h1>
      </div>

      <section aria-labelledby="needs-action" className="space-y-3">
        <h2 id="needs-action" className="eyebrow text-on-surface-muted">Needs action · {flagged.length}</h2>
        <div className="card divide-y divide-surface-border">
          {flagged.map((d) => (
            <ReviewRow key={d.id} deal={d} names={names} action={<ResolveNeedsAction dealId={d.id} />} />
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
            <ReviewRow
              key={d.id}
              deal={d}
              names={names}
              action={d.needs_action ? <span className="chip bg-danger/10 text-danger">Needs action</span> : <FlagNeedsAction dealId={d.id} />}
            />
          ))}
          {missing.length === 0 && <p className="p-6 text-center text-sm text-on-surface-muted">Every deal has back gross.</p>}
        </div>
        <p className="text-xs text-on-surface-subtle">Type back gross and press Enter or click away to save.</p>
      </section>
    </>
  );
}
