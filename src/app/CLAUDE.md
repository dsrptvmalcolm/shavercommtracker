# App routes

## Key files
- `(app)/layout.tsx` — auth gate: resolves the viewer, forces `/change-password` when `must_change_password`, renders `AppShell`.
- `(app)/dashboard` — salesperson month view (admins can pass `?staff=`). `(app)/history` — month table.
- `(app)/deals/{new,[id]}` + `deals/deal-form.tsx` + `deals/actions.ts` — the one deal form for salespeople and admins. `deals/stock-field.tsx` suggests cars (in stock + left in the last 30 days) but only fills the text; `save_deal` decides the vehicle link. `deals/linked-vehicle.tsx` shows the linked car on the deal page.
- `(app)/admin/*` — Store, Deals (inline back gross), Review (Needs action flags + deals with no back gross since the last paid month), Spiffs, Staff, Settings (tiers, holidays, products). `admin/sales-log` — every car that left inventory, by month (reached from the admin-only **Sold** chip on Inventory, not the nav). All admin mutations are in `admin/actions.ts`.
- `(app)/view-as-actions.ts` — start/stop impersonation (read only).
- `login/`, `change-password/` — outside the app shell.
- `print/deals` — printable month deal log for admins (outside the app shell so it prints on white); linked from Admin → Deals.
- `(app)/inventory` — list (Not posted / Posted / All tabs for porters+admins), `[stock]` vehicle page with history, `[stock]/marketplace` Post on Marketplace kit (porters+admins). `inventory/actions.ts` — `setVehiclePosted`, `dismissInventoryAlert`. `inventory/alert-strip.tsx` — the poster's own alerts (Sold / Price changed) above the list; the layout passes `getMyAlertCount()` to the Inventory nav badge.
- `api/cron/inventory` — daily feed refresh (Vercel Cron, `CRON_SECRET`, service role — decision 0003). Admin → Settings → Inventory feed has the URL, listing phone and Refresh now.
- `../proxy.ts` — session refresh + redirect signed-out users to `/login` (`/api/cron/` is exempt; those routes check `CRON_SECRET`).

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Server actions validate input with zod and return `{ error }` / `{ ok }` for `ActionForm`/`useActionState`; call `revalidatePath("/", "layout")` after writes.
<!-- added 2026-10-02: initial setup -->
- Every write path calls `assertNotImpersonating()` (deal actions) or `requireAdmin()` (admin actions).
<!-- added 2026-10-02: initial setup -->
- `params`, `searchParams` and `cookies()` are async in Next.js 16 — await them.

## Where things live
- Generic admin form with inline feedback: `src/components/action-form.tsx`.
- Month switching: `src/components/month-nav.tsx` (keeps other query params).
