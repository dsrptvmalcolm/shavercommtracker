import Link from "next/link";
import { canPost, getInventory, getInventoryUpdatedAt, requireMe } from "@/lib/data";
import { listVehicles, type InventoryTab } from "@/lib/inventory/vehicle";
import { APP_TIMEZONE, todayIso } from "@/lib/months";
import { VehicleCard } from "./vehicle-card";

const TABS: { id: InventoryTab; label: string }[] = [
  { id: "not-posted", label: "Not posted" },
  { id: "posted", label: "Posted" },
  { id: "all", label: "All" },
];

const isTab = (t: string | undefined): t is InventoryTab => TABS.some((x) => x.id === t);

const updatedLabel = (iso: string | null) => {
  if (!iso) return "not updated yet";
  const d = new Date(iso);
  const sameDay = todayIso(d) === todayIso();
  const time = d.toLocaleTimeString("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" });
  return sameDay ? `updated ${time}` : `updated ${d.toLocaleDateString("en-US", { timeZone: APP_TIMEZONE, month: "short", day: "numeric" })}, ${time}`;
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const [me, sp] = await Promise.all([requireMe(), searchParams]);
  const poster = canPost(me);
  const [vehicles, updatedAt] = await Promise.all([getInventory(), getInventoryUpdatedAt()]);
  const today = todayIso();
  const q = (sp.q ?? "").trim();
  const tab: InventoryTab = poster ? (isTab(sp.tab) ? sp.tab : "not-posted") : "all";
  const shown = listVehicles(vehicles, { tab, q, today });
  const counts = Object.fromEntries(TABS.map((t) => [t.id, listVehicles(vehicles, { tab: t.id, q, today }).length]));
  const href = (t: InventoryTab) => `/inventory?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div>
        <p className="eyebrow text-primary">
          {vehicles.length} cars · {updatedLabel(updatedAt)}
        </p>
        <h1 className="display text-4xl text-white lg:text-5xl">Inventory</h1>
      </div>

      <form action="/inventory" className="flex gap-2" role="search">
        {poster && <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="inventory-q" className="sr-only">Search inventory</label>
        <input
          id="inventory-q"
          name="q"
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          defaultValue={q}
          placeholder="Stock #, make, model, VIN"
          className="input"
        />
        <button type="submit" className="btn-secondary shrink-0 px-4">Search</button>
      </form>

      {poster && (
        <nav aria-label="Posted filter" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={t.id === tab ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ${
                t.id === tab ? "bg-primary-soft text-primary" : "bg-surface-subtle text-on-surface-muted hover:text-on-surface"
              }`}
            >
              {t.label}
              <span className="text-xs opacity-80">{counts[t.id]}</span>
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-on-surface-muted">
          {q ? "No cars match that search." : tab === "not-posted" ? "Everything in stock is posted." : tab === "posted" ? "Nothing is marked posted yet." : "No cars in inventory yet."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <VehicleCard key={v.id} vehicle={v} today={today} canPost={poster} />
          ))}
        </ul>
      )}
    </>
  );
}
