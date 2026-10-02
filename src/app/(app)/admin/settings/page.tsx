import { ActionForm } from "@/components/action-form";
import { getProducts, getSettingsFor, requireAdmin, type Product } from "@/lib/data";
import { currentMonth, monthLabel } from "@/lib/months";
import { saveProduct, saveSettings } from "../actions";

const EXTRA_TIER_ROWS = 2;

export default async function SettingsPage() {
  await requireAdmin();
  const month = currentMonth();
  const [s, products] = await Promise.all([getSettingsFor(month), getProducts()]);
  const mini = [...s.mini_tiers, ...Array.from({ length: EXTRA_TIER_ROWS }, () => null)];
  const store = [...s.store_volume_tiers, ...Array.from({ length: EXTRA_TIER_ROWS }, () => null)];

  const field = (name: string, label: string, value: number, hint?: string) => (
    <div key={name}>
      <label htmlFor={name} className="field-label">{label}</label>
      <input id={name} name={name} inputMode="decimal" required defaultValue={value} className="input" />
      {hint && <p className="mt-1 text-xs text-on-surface-subtle">{hint}</p>}
    </div>
  );

  return (
    <>
      <div>
        <p className="eyebrow text-primary">Admin</p>
        <h1 className="display text-4xl text-white lg:text-5xl">Commission Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-muted">
          Changes apply from <strong className="text-white">{monthLabel(month)}</strong> onward. Closed months keep the rates they were paid on.
          {s.effective_month !== month && ` Current rates have been in effect since ${monthLabel(s.effective_month)}.`}
        </p>
      </div>

      <ActionForm action={saveSettings} submitLabel="Save settings" className="space-y-6">
        <section className="card grid gap-6 p-6 lg:grid-cols-2">
          <div>
            <h2 className="display mb-1 text-xl text-white">Mini tiers</h2>
            <p className="mb-4 text-xs text-on-surface-subtle">The tier reached pays on every unit that month. Clear a row to remove it.</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2"><span className="field-label">Starts at units</span><span className="field-label">Per unit</span></div>
              {mini.map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input name="mini_start" inputMode="decimal" defaultValue={t?.startUnits ?? ""} aria-label={`Mini tier ${i + 1} start units`} className="input" />
                  <input name="mini_amount" inputMode="decimal" defaultValue={t?.amount ?? ""} aria-label={`Mini tier ${i + 1} amount`} className="input" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="display mb-1 text-xl text-white">Store volume tiers</h2>
            <p className="mb-4 text-xs text-on-surface-subtle">Paid to every salesperson at the highest tier reached — tiers don&apos;t stack.</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2"><span className="field-label">Store units</span><span className="field-label">Each salesperson</span></div>
              {store.map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input name="store_units" inputMode="decimal" defaultValue={t?.units ?? ""} aria-label={`Store tier ${i + 1} units`} className="input" />
                  <input name="store_amount" inputMode="decimal" defaultValue={t?.amount ?? ""} aria-label={`Store tier ${i + 1} amount`} className="input" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <h2 className="display text-xl text-white sm:col-span-2 lg:col-span-4">Gross &amp; spiffs</h2>
          {field("front_pct", "Front commission %", Number(s.front_pct) * 100, "e.g. 0 = off")}
          {field("back_pct", "Back commission %", Number(s.back_pct) * 100, "e.g. 1 = 1% of back gross")}
          {field("product_hat_trick_bonus", "Product hat trick bonus", Number(s.product_hat_trick_bonus), "3+ products — replaces product spiffs")}
          {field("two_car_day_spiff", "2-car day spiff", Number(s.two_car_day_spiff))}
          {field("hat_trick_day_spiff", "Hat trick day spiff", Number(s.hat_trick_day_spiff), "3+ cars in a day")}
          {field("multilingual_spiff", "Multi-lingual spiff", Number(s.multilingual_spiff))}
          {field("ninety_day_spiff", "90 Day+ unit spiff", Number(s.ninety_day_spiff))}
          {field("personal_best_spiff", "Personal best spiff", Number(s.personal_best_spiff))}
        </section>
      </ActionForm>

      <section className="space-y-4">
        <div>
          <h2 className="display text-2xl text-white">Products</h2>
          <p className="text-sm text-on-surface-muted">Spiff changes apply to products added to deals from now on. Deactivate a product to hide it from new deals.</p>
        </div>
        <div className="space-y-3">
          {products.map((p) => <ProductForm key={p.id} product={p} />)}
          <div className="card p-4">
            <p className="field-label">Add a product</p>
            <ProductForm />
          </div>
        </div>
      </section>
    </>
  );
}

function ProductForm({ product }: { product?: Product }) {
  const id = product?.id ?? "new";
  return (
    <ActionForm action={saveProduct} submitLabel={product ? "Save" : "Add"} className={`grid items-end gap-3 sm:grid-cols-[1fr_140px_100px_auto] ${product ? "card p-4" : ""}`}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div>
        <label htmlFor={`pname-${id}`} className="field-label">Product</label>
        <input id={`pname-${id}`} name="name" required defaultValue={product?.name} className="input" />
      </div>
      <div>
        <label htmlFor={`pspiff-${id}`} className="field-label">Spiff</label>
        <input id={`pspiff-${id}`} name="spiff_amount" inputMode="decimal" required defaultValue={product?.spiff_amount ?? ""} className="input" />
      </div>
      <div>
        <label htmlFor={`psort-${id}`} className="field-label">Order</label>
        <input id={`psort-${id}`} name="sort_order" inputMode="numeric" defaultValue={product?.sort_order ?? 0} className="input" />
      </div>
      <label className="flex items-center gap-2 pb-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-4 w-4 accent-primary" /> Active
      </label>
    </ActionForm>
  );
}
