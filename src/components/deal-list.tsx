import Link from "next/link";
import type { DealCommission } from "@/lib/commission/types";
import type { DealRow } from "@/lib/data";
import { money, shortDate } from "@/lib/format";

type Props = {
  deals: DealRow[];
  commissions?: Map<string, DealCommission>;
  productNames: Map<string, string>;
  staffNames: Map<string, string>;
  /** Which salesperson's perspective (for split labels) */
  viewerId?: string;
  canEdit: (deal: DealRow) => boolean;
  emptyText?: string;
};

export function DealList({ deals, commissions, productNames, staffNames, viewerId, canEdit, emptyText = "No deals yet this month." }: Props) {
  if (deals.length === 0) {
    return <p className="card p-8 text-center text-sm text-on-surface-muted">{emptyText}</p>;
  }
  return (
    <ul className="card divide-y divide-surface-border/70 overflow-hidden">
      {deals.map((d) => {
        const c = commissions?.get(d.id);
        const partnerId = d.salesperson_id === viewerId ? d.split_salesperson_id : d.salesperson_id;
        const body = (
          <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-bold text-white">{d.customer_name}</span>
                <span className="font-mono text-xs text-on-surface-subtle">
                  {shortDate(d.sale_date)} · #{d.stock_number}
                  {d.deal_number && ` · Deal ${d.deal_number}`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.is_house && <span className="chip bg-surface-subtle text-on-surface-muted">House</span>}
                {!viewerId && d.salesperson_id && (
                  <span className="chip bg-surface-subtle text-on-surface">
                    {staffNames.get(d.salesperson_id)}
                    {d.split_salesperson_id && ` + ${staffNames.get(d.split_salesperson_id)}`}
                  </span>
                )}
                {viewerId && d.split_salesperson_id && partnerId && (
                  <span className="chip bg-primary-soft text-primary">Split w/ {staffNames.get(partnerId) ?? "—"}</span>
                )}
                {d.deal_products.map((p) => (
                  <span key={p.product_id} className="chip bg-surface-subtle text-on-surface-muted">
                    {productNames.get(p.product_id) ?? "Product"}
                  </span>
                ))}
                {c?.productHatTrick && <span className="chip bg-primary-soft text-primary">Product Hat Trick</span>}
                {d.ninety_day && <span className="chip bg-amber-500/10 text-amber-300">90 Day+</span>}
                {d.multilingual && <span className="chip bg-success/10 text-success">Multi-Lingual</span>}
                {d.back_gross == null && !d.is_house && (
                  <span className="chip border border-dashed border-surface-border text-on-surface-subtle">No back gross</span>
                )}
              </div>
              {d.deal_notes && <p className="mt-2 truncate text-xs text-on-surface-subtle">{d.deal_notes}</p>}
            </div>
            <div className="shrink-0 text-right">
              {c ? (
                <>
                  <div className="display text-xl text-white">{money(c.total)}</div>
                  <div className="text-[11px] text-on-surface-subtle">
                    Back {money(d.back_gross)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-on-surface-subtle">Back {money(d.back_gross)}</div>
              )}
            </div>
          </div>
        );
        return (
          <li key={d.id} className="transition-colors hover:bg-surface-card-hover">
            {canEdit(d) ? (
              <Link href={`/deals/${d.id}`} className="block">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
