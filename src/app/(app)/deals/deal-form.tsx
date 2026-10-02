"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { DealRow, Product, Staff } from "@/lib/data";
import { type DealFormState, deleteDeal, saveDeal } from "./actions";

type Props = {
  deal?: DealRow;
  me: Staff;
  products: Product[];
  salespeople: Staff[];
  today: string;
  /** Earliest date a non-admin may use (first of the open month) */
  minDate: string;
};

export function DealForm({ deal, me, products, salespeople, today, minDate }: Props) {
  const [state, action, pending] = useActionState<DealFormState, FormData>(saveDeal, {});
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();
  const [isHouse, setIsHouse] = useState(deal?.is_house ?? false);
  const [ownerId, setOwnerId] = useState(deal?.salesperson_id ?? (me.is_salesperson ? me.id : ""));

  const owner = salespeople.find((s) => s.id === ownerId) ?? (ownerId === me.id ? me : undefined);
  const onDeal = new Set(deal?.deal_products.map((p) => p.product_id));
  const visibleProducts = products.filter((p) => p.active || onDeal.has(p.id));
  const partners = salespeople.filter((s) => s.id !== ownerId && (s.active || s.id === deal?.split_salesperson_id));

  const onDelete = () => {
    if (!deal || !confirm(`Delete the deal for ${deal.customer_name}? This can't be undone.`)) return;
    startDelete(async () => {
      const res = await deleteDeal(deal.id);
      if (res?.error) setDeleteError(res.error);
    });
  };

  return (
    <form action={action} className="space-y-6">
      {deal && <input type="hidden" name="id" value={deal.id} />}

      {me.is_admin && (
        <fieldset className="card space-y-4 p-6">
          <legend className="sr-only">Assignment</legend>
          <label className="flex items-center gap-3 text-sm font-bold">
            <input type="checkbox" name="is_house" checked={isHouse} onChange={(e) => setIsHouse(e.target.checked)} className="h-4 w-4 accent-primary" />
            House deal <span className="font-normal text-on-surface-muted">— counts toward store volume only</span>
          </label>
          {!isHouse && (
            <div>
              <label htmlFor="salesperson_id" className="field-label">Salesperson</label>
              <select id="salesperson_id" name="salesperson_id" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required className="input">
                <option value="">Select…</option>
                {salespeople.filter((s) => s.active || s.id === deal?.salesperson_id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="sr-only">Deal</legend>
        <div>
          <label htmlFor="sale_date" className="field-label">Sale date</label>
          <input id="sale_date" name="sale_date" type="date" required defaultValue={deal?.sale_date ?? today} min={me.is_admin ? undefined : minDate} max={me.is_admin ? undefined : today} className="input" />
        </div>
        <div>
          <label htmlFor="customer_name" className="field-label">Customer name</label>
          <input id="customer_name" name="customer_name" required defaultValue={deal?.customer_name} autoComplete="off" className="input" />
        </div>
        <div>
          <label htmlFor="stock_number" className="field-label">Stock #</label>
          <input id="stock_number" name="stock_number" required defaultValue={deal?.stock_number} autoComplete="off" className="input uppercase" />
        </div>
        <div>
          <label htmlFor="deal_number" className="field-label">Deal #</label>
          <input id="deal_number" name="deal_number" defaultValue={deal?.deal_number ?? ""} autoComplete="off" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="deal_notes" className="field-label">Deal notes</label>
          <textarea id="deal_notes" name="deal_notes" rows={2} defaultValue={deal?.deal_notes ?? ""} className="input" />
        </div>
      </fieldset>

      {!isHouse && (
        <fieldset className="card space-y-5 p-6">
          <legend className="sr-only">Products and spiffs</legend>
          <div>
            <span className="field-label">Products sold</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleProducts.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-md border border-surface-border bg-surface-subtle px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="checkbox" name="product_ids" value={p.id} defaultChecked={onDeal.has(p.id)} className="h-4 w-4 accent-primary" />
                  {p.name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-on-surface-subtle">Any 3 products on one deal pays the product hat trick bonus.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-surface-border bg-surface-subtle px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input type="checkbox" name="ninety_day" defaultChecked={deal?.ninety_day} className="h-4 w-4 accent-primary" />
              90 Day+ unit
            </label>
            {(owner?.multilingual_eligible || deal?.multilingual) && (
              <label className="flex items-center gap-3 rounded-md border border-surface-border bg-surface-subtle px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="checkbox" name="multilingual" defaultChecked={deal?.multilingual} className="h-4 w-4 accent-primary" />
                Multi-lingual sale
              </label>
            )}
          </div>
          <div>
            <label htmlFor="split_salesperson_id" className="field-label">Split deal with</label>
            <select id="split_salesperson_id" name="split_salesperson_id" defaultValue={deal?.split_salesperson_id ?? ""} className="input">
              <option value="">No split</option>
              {partners.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-on-surface-subtle">Splits are 50/50 — half a unit and half the commission each.</p>
          </div>
        </fieldset>
      )}

      {me.is_admin && (
        <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
          <legend className="sr-only">Gross</legend>
          <div>
            <label htmlFor="back_gross" className="field-label">Back gross</label>
            <input id="back_gross" name="back_gross" inputMode="decimal" defaultValue={deal?.back_gross ?? ""} placeholder="Leave blank if none" className="input" />
          </div>
          <div>
            <label htmlFor="front_gross" className="field-label">Front gross</label>
            <input id="front_gross" name="front_gross" inputMode="decimal" defaultValue={deal?.front_gross ?? ""} placeholder="Not currently paid" className="input" />
          </div>
        </fieldset>
      )}

      {(state.error || deleteError) && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.error ?? deleteError}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : deal ? "Save deal" : "Log deal"}
          </button>
          <Link href={me.is_admin ? "/admin/deals" : "/dashboard"} className="btn-secondary">Cancel</Link>
        </div>
        {deal && (
          <button type="button" onClick={onDelete} disabled={deleting} className="btn-danger">
            {deleting ? "Deleting…" : "Delete deal"}
          </button>
        )}
      </div>
    </form>
  );
}
