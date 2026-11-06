# Inventory phase 2 — Marketplace alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell the person who posted a car on Marketplace, inside the app, when that car leaves the VinCue feed ("Sold — take down your listing") or its price changes ("Price changed $X → $Y — update your listing").

**Architecture:** Alerts are rows in a new `inventory_alerts` table written only by `ingest_inventory` (same transaction as the vehicle change) and cleared only through `dismiss_inventory_alert()`. RLS limits reads to the alert's owner (admins see all). The Inventory page shows the viewer's own undismissed alerts in a strip; the app shell shows a count badge on the Inventory tab.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres (RLS + security-definer functions), Vitest, zod.

**Spec:** `docs/superpowers/specs/2026-11-06-inventory-marketplace-design.md` (Goals 4, Screens → Inventory → Alerts, Phases 2). Deferred review items: `dev/active/inventory-marketplace/context.md`.

## Global Constraints

- One database = production. Migration `0009_inventory_alerts.sql` is applied with `npm run db:migrate` only after Malcolm says yes. Never edit `0008`.
- New tables: RLS on in the same migration; functions `security definer set search_path = public`, `revoke … from public, anon`, `grant … to authenticated`.
- Alerts are in-app only (no email/SMS). Alerts go to the poster (`vehicle_posts.posted_by`), never to salespeople who didn't post.
- Copy (spec): `Sold — take down your listing: {title} · #{stock}` and `Price changed {old} → {new} — update your listing`.
- Mobile standards from `CLAUDE.md`: 360px, 44px tap targets, no text under 12px, no hover-only UI.
- Existing test files are locked by a hook — new tests go in new files.

## Decisions made while planning (builder's calls, flag to Malcolm)

- **Repeat price changes collapse into one alert.** If the poster still has an undismissed price alert for that car, it's updated to the newest price (keeping the original "from" price) instead of stacking a second alert. A price change back to the original price removes the alert.
- **Sold supersedes price.** When a car leaves the feed, its undismissed price alerts are dismissed automatically and one sold alert is created.
- **A sold alert survives the car returning.** The listing still had to come down; the returned car comes back Not posted (phase 1 behaviour).
- **Blank feed price = unchanged** (M-2): the stored price is kept and no event/alert is written.

## Review Focus

1. Feed price goes blank for one run and comes back — no events/alerts either way (Task 1 check: blank then same price → 0 price_change events).
2. Price drops twice before the Porter looks — one alert showing first → latest price (Task 1 check).
3. Porter dismisses a sold alert for a car that has since returned — no error, no duplicate `unposted` event (Task 1 check).
4. Someone tries to dismiss another person's alert — refused (Task 1 check: salesperson/porter B gets 42501).
5. Admin viewing as a salesperson taps Dismiss — blocked by `assertNotImpersonating` (Task 3 action).

---

### Task 1: Migration 0009 + rolled-back check

**Files:**
- Create: `supabase/migrations/0009_inventory_alerts.sql`
- Create: `scripts/.tmp-check-alerts.mts` (deleted after the migration is applied)
- Modify: `supabase/CLAUDE.md` (0009 line)

**Interfaces — produces (SQL):**
- `inventory_alerts (id uuid pk, vehicle_id uuid not null → vehicles, staff_id uuid not null → staff, kind text check in ('sold','price_change'), old_price numeric(12,2), new_price numeric(12,2), created_at timestamptz default now(), dismissed_at timestamptz)`; partial index `(staff_id) where dismissed_at is null`. RLS select: `staff_id = (select my_staff_id()) or (select is_admin())`.
- `ingest_inventory(jsonb, boolean, text, int)` replaced: `pg_advisory_xact_lock(hashtext('ingest_inventory'))` right after the auth check (M-3); blank price keeps `v.price` (M-2); price change on a posted car upserts a `price_change` alert for `posted_by` (collapse rule above); removal of a posted car dismisses its open price alerts and inserts a `sold` alert with `old_price = v.price`.
- `dismiss_inventory_alert(p_alert_id uuid) returns void` — owner or admin; sets `dismissed_at`; for `sold`, deletes the `vehicle_posts` row if present and records `unposted` (by the dismisser). Already-dismissed = no-op.
- `delete_deal(uuid)` replaced: identical to 0003 plus "only active salespeople and admins" guard matching `save_deal` (M-7).
- Backfill: one `sold` alert per gone vehicle with a `vehicle_posts` row and no open sold alert, `created_at = removed_at` (M-1).

- [ ] **Step 1: Write the check script** (fails first: functions/table don't exist). Inside `begin … rollback`, apply the 0009 text, create QA staff (admin, porter A, porter B, salesperson; `@shaver.test`), switch identity via `request.jwt.claims`, and assert:
  - admin ingests 10 rows; porter A posts car 1 and car 2.
  - car 1 price 20000 → 19000: one `price_change` alert for A (20000 → 19000); → 18500: still one open alert, 20000 → 18500.
  - car 3 (not posted) price change: no alert.
  - car 1 price blank: price stays 18500, no new event; back to 18500: no event.
  - ingest without car 2: one `sold` alert for A, A's price alerts on car 2 dismissed.
  - porter B: sees 0 alerts, `dismiss_inventory_alert(A's alert)` raises 42501; salesperson sees 0 alerts.
  - porter A dismisses sold alert: `dismissed_at` set, `vehicle_posts` row gone, one `unposted` event; dismissing again is a no-op.
  - car returns then A dismisses a fresh sold alert: no error, no extra `unposted` event.
  - porter `delete_deal` on a deal raises 42501.
  - backfill: insert a gone vehicle with a post and no alert before applying → one sold alert after.
- [ ] **Step 2: Run** `npx tsx --env-file=.env.local scripts/.tmp-check-alerts.mts` → FAIL (no migration yet).
- [ ] **Step 3: Write `0009_inventory_alerts.sql`.**
- [ ] **Step 4: Run again** → every line PASS, ends `rolled back`.
- [ ] **Step 5: Ask Malcolm, then `npm run db:migrate`** → `applied 0009_inventory_alerts.sql`. Delete the check script.

### Task 2: Alert wording + data reads

**Files:**
- Create: `src/lib/inventory/alerts.ts`, `src/lib/inventory/alerts.test.ts`
- Modify: `src/lib/data.ts` (Inventory section)

**Interfaces — produces:**
- `type InventoryAlert = { id: string; kind: "sold" | "price_change"; oldPrice: number | null; newPrice: number | null; createdAt: string; vehicle: Pick<Vehicle, "stockNumber" | "year" | "make" | "model" | "trim"> }` (in `alerts.ts`)
- `alertMessage(a: InventoryAlert): { headline: string; detail: string }` — sold: `Sold — take down your listing` / `{title} · #{stock}`; price: `Price changed {money0(old)} → {money0(new)} — update your listing` / `{title} · #{stock}`.
- `getMyAlerts(): Promise<InventoryAlert[]>` (viewer's own undismissed, newest first, joined to vehicles; filters `staff_id = me.id` so admins don't see everyone's) and `getMyAlertCount(): Promise<number>` in `data.ts`, both `cache()`d, returning `[]`/`0` for non-posters.

- [ ] **Step 1: Write `alerts.test.ts`** — sold alert → headline `"Sold — take down your listing"`, detail `"2023 Jeep Compass Altitude · #16945"`; price alert 22729 → 21729 → headline `"Price changed $22,729 → $21,729 — update your listing"`.
- [ ] **Step 2: `npm test -- alerts`** → FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** add the two reads to `data.ts`; `npm run typecheck`.

### Task 3: Alert strip, Dismiss, nav badge

**Files:**
- Create: `src/app/(app)/inventory/alert-strip.tsx` (server list) + `dismiss-alert-button.tsx` (client)
- Modify: `src/app/(app)/inventory/actions.ts` (`dismissInventoryAlert(alertId: string): Promise<ActionState>`; zod uuid; `assertNotImpersonating`; `requireMe` + `canPost`, else `{ error }`; rpc `dismiss_inventory_alert`; `revalidatePath("/", "layout")`)
- Modify: `src/app/(app)/inventory/page.tsx` (strip above search, posters only)
- Modify: `src/components/nav-link.tsx` (optional `badge?: number`, rendered as a pill with `aria-label="N alerts"`), `src/components/app-shell.tsx` (takes `alertCount`), `src/app/(app)/layout.tsx` (passes `getMyAlertCount()` for posters)

- [ ] Each alert row: whole text area is a link to `/inventory/{stock}` (min-h-11), Dismiss button (btn-secondary, 44px). Sold alerts use danger tint, price alerts primary tint.
- [ ] `npm run typecheck && npm run lint`.

### Task 4: Optional deferred fixes (cheap ones)

- M-4: `runIngest` — if the response body starts with `<`, record "Feed returned a web page, not the VinCue export".
- M-5: cron route compares `CRON_SECRET` with `crypto.timingSafeEqual`.
- M-6: Settings copy → "every morning around 5–6 am Central".
- M-8: `setVehiclePosted` returns `{ error }` for non-posters instead of redirecting.
- M-10: `ActionForm` gets optional `pendingLabel` (Refresh now → "Refreshing…"); `CopyButton` gets optional `ariaLabel` ("Copy VIN"/"Copy title"/"Copy price"); `vehicleTitle` drops a trim of `Other` (new test file `vehicle-title.test.ts`).

### Task 5: Verify end to end

- [ ] `scripts/verify.sh` green.
- [ ] Ask Malcolm before `npm run qa:accounts -- create`; in the browser at 360px as QA porter: post a car, trigger alerts (via rolled-forward QA data or a real Refresh), see strip + badge, tap → vehicle, Dismiss sold → car leaves Posted. As QA salesperson: no strip, no badge. Delete QA logins.
- [ ] Update `supabase/CLAUDE.md`, `src/app/CLAUDE.md`, `dev/active/inventory-marketplace/*`; ask Malcolm before commit + push.
