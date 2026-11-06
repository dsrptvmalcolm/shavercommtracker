import { ActionForm } from "@/components/action-form";
import { getFeedSettings, getInventoryRuns, type InventoryRun } from "@/lib/data";
import { APP_TIMEZONE } from "@/lib/months";
import { refreshInventory, saveFeedSettings } from "../actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: APP_TIMEZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_CHIP: Record<InventoryRun["status"], string> = {
  ok: "bg-success/10 text-success",
  stopped: "bg-danger/10 text-danger",
  failed: "bg-danger/10 text-danger",
};

const summary = (r: InventoryRun) =>
  r.status === "ok"
    ? [`${r.added} added`, `${r.removed} removed`, `${r.priceChanges} price changes`, r.returned ? `${r.returned} back` : "", r.rejected ? `${r.rejected} skipped` : ""]
        .filter(Boolean)
        .join(" · ")
    : (r.message ?? "");

/** Admin → Settings → Inventory feed. Call only after requireAdmin(). */
export async function InventoryFeedSection() {
  const [feed, runs] = await Promise.all([getFeedSettings(), getInventoryRuns(10)]);
  return (
    <section id="inventory" className="scroll-mt-32 space-y-4">
      <div>
        <h2 className="display text-2xl text-white">Inventory feed</h2>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-muted">
          The VinCue inventory export. It updates automatically every morning around 6 am; use Refresh now to update it right away.
        </p>
      </div>

      <ActionForm action={saveFeedSettings} submitLabel="Save feed settings" className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="feed-url" className="field-label">Feed URL</label>
          <input
            id="feed-url"
            name="url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={feed.url ?? ""}
            placeholder="https://alpha.vincue.com/export/facebookExport.aspx?dealerkey=…"
            className="input"
          />
          <p className="mt-1 text-xs text-on-surface-subtle">Only admins can see this — it contains the dealer key.</p>
        </div>
        <div>
          <label htmlFor="listing-phone" className="field-label">Phone number for listings</label>
          <input id="listing-phone" name="listing_phone" type="tel" required defaultValue={feed.listingPhone} className="input" />
          <p className="mt-1 text-xs text-on-surface-subtle">Shown in every Marketplace description.</p>
        </div>
      </ActionForm>

      <ActionForm action={refreshInventory} submitLabel="Refresh now" className="card flex flex-wrap items-center gap-4 p-6">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="force" className="h-4 w-4 accent-primary" />
          Apply anyway (only if a refresh was stopped for removing too many cars)
        </label>
      </ActionForm>

      <div className="card p-6">
        <h3 className="field-label mb-3">Recent updates</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-on-surface-muted">No updates yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border/70">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm">
                <span className="font-bold text-white">{when(r.startedAt)}</span>
                <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
                <span className="text-xs text-on-surface-subtle">{r.trigger === "schedule" ? "Automatic" : "Refresh now"}</span>
                <span className="w-full text-on-surface-muted sm:w-auto">{summary(r)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
