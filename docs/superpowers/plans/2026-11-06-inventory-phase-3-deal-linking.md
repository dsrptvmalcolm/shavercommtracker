# Inventory phase 3 — deal linking + sales log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deals link to the real vehicle (server-decided, with the reuse guard), the deal form searches inventory, the deal page shows the linked car, and admins get a sales log of every departure.

**Architecture:** Migration 0011 adds `deals.vehicle_id`, a private SQL helper `vehicle_for_deal(stock, sale_date)` used by a re-created `save_deal` and by a one-time backfill. The deal form gets its vehicle options as a server prop (in stock + left in the last 30 days, ~170 rows) and filters client-side with a pure tested function. The sales log is built in a pure tested function from `removed` events + vehicles + linked deals, read through `data.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres (RLS + security definer), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-06-inventory-marketplace-design.md` (Data, Deal form, Sales log, Phase 3)

## Global Constraints

- Commission math untouched; `src/lib/commission/engine.ts` not modified.
- One database = production. Migration applied only after Malcolm's OK. QA logins `@shaver.test`, ask first, always delete.
- "The server decides the link from the stock number; the form never sends a trusted vehicle id."
- Reuse guard: link only when the deal's sale date is on or after the vehicle's `date_first_on_lot`.
- "Typing a stock number by hand still works exactly as today."
- Suggestions: in-stock vehicles plus vehicles that left inventory in the last 30 days; each shows photo, year make model trim, stock #.
- Sales log columns: date left, stock #, year make model trim, body style, first price, last price, days on lot, linked deal (yes/no; opens the deal). Filter by month left. Newest first. Admin only.
- Mobile standards (CLAUDE.md): 360px, 44px targets, `input` utility, no hover-only, no horizontal page scroll (table in `overflow-x-auto`).
- Existing test files are not edited; new behaviour gets new test files.

## Builder calls (tell Malcolm)

1. **Sales log location:** `/admin/sales-log`, reached from a **Sold** chip on Inventory (admins only) — the admin nav already has 7 tabs that scroll on phones; an 8th would hide more. (`/inventory/sold` was rejected: it collides with a stock number "SOLD".)
2. **Which car a deal links to when a stock number was reused:** the most recent vehicle (by lot date) whose lot date is on or before the sale date. A vehicle with no lot date is not blocked by the guard.
3. **Which departure a linked deal shows against:** the first departure on or after the sale date; if the car left *before* the sale date (feed drops it while the deal is pending), the latest departure before it. The spec said "most recent on or after"; "first on or after" is what was meant when a car leaves twice, and the fallback stops a real sale showing as "no deal".
4. Links are set when a deal is saved (and by the one-time backfill). A deal logged before its car ever appears in the feed stays unlinked until it's re-saved.

## Review Focus

- Stock typed in lowercase / with spaces → still links (`upper(trim())` both sides). Pinned in SQL check.
- Editing a deal's stock number to one with no vehicle → link cleared, not kept. Pinned in SQL check.
- Car left before the deal's sale date → still shows "yes" on the sales log. Pinned in `sales-log.test.ts`.
- Picking a suggestion then editing the text by hand → whatever text is in the box is saved. Pinned by the form using one controlled `stock_number` input (browser check).
- Departure near midnight → month is Chicago month, not UTC. Pinned in `sales-log.test.ts`.

---

### Task 1: Migration 0011 + rolled-back check

**Files:** Create `supabase/migrations/0011_deal_vehicle_link.sql`, `scripts/.tmp-check-deal-link.mts` (deleted after apply). Modify `supabase/CLAUDE.md` (0011 line).

**Produces (SQL):**
- `deals.vehicle_id uuid null references vehicles(id)` + index.
- `vehicle_for_deal(p_stock text, p_sale_date date) returns uuid` — `language sql stable`; execute revoked from public/anon/authenticated (only called inside `save_deal` and the backfill). Match `upper(trim(v.stock_number)) = upper(trim(p_stock))`, `p_sale_date >= v.date_first_on_lot or v.date_first_on_lot is null`, order `date_first_on_lot desc nulls last, first_seen_at desc`, limit 1; null when `p_sale_date` is null.
- `save_deal(jsonb)` — 0008 text verbatim plus `vehicle_id = vehicle_for_deal(<saved stock>, v_sale_date)` on insert and update.
- Backfill: `update deals set vehicle_id = vehicle_for_deal(stock_number, sale_date)` where the result is not null.

- [ ] Step 1: write the check script (begin … rollback, apply 0011 text, QA staff admin + salesperson `@shaver.test`, identity via `request.jwt.claims`). Asserts: salesperson saves deal with stock `' 9xq1 '` dated after the lot date of a QA vehicle `9XQ1` → linked; same stock dated before lot date → null; reuse: two vehicles `9XQ2` (lot 2026-01-05, gone) and (lot 2026-10-01, in stock) → deal 2026-03-01 links the older, deal 2026-10-15 links the newer; edit linked deal to stock `NOPE` → null; payload `vehicle_id` of another car is ignored; porter-only `save_deal` → 42501; authenticated `vehicle_for_deal` → 42501; backfill links a pre-inserted deal; count of prod deals linked by backfill printed.
- [ ] Step 2: run `npx tsx --env-file=.env.local scripts/.tmp-check-deal-link.mts` → FAIL (no migration).
- [ ] Step 3: write the migration.
- [ ] Step 4: run again → all PASS, ends `rolled back`.
- [ ] Step 5: ask Malcolm → `npm run db:migrate` → `applied 0011_deal_vehicle_link.sql`; delete the script.

### Task 2: Pure helpers + tests

**Files:** Create `src/lib/inventory/vehicle-options.ts` + `vehicle-options.test.ts`, `src/lib/inventory/sales-log.ts` + `sales-log.test.ts`.

**Produces:**
- `type VehicleOption = { id; stockNumber; title; image: string | null; gone: boolean }`
- `searchVehicleOptions(options: VehicleOption[], q: string, limit = 8): VehicleOption[]` — empty q → `[]`; every whitespace term must appear in `stockNumber + title` (case-insensitive); stock-number prefix matches first, then in-stock before gone.
- `type Departure = { eventId; vehicleId; leftAt: string /*ISO*/; daysOnLot: number | null; lastPrice: number | null }`, `type SalesLogVehicle = { id; stockNumber; title; bodyStyle; firstPrice: number | null }`, `type LinkedDeal = { id; vehicleId; saleDate: string }`
- `type SalesLogRow = { eventId; leftOn: string /*YYYY-MM-DD Chicago*/; vehicleId; stockNumber; title; bodyStyle; firstPrice; lastPrice; daysOnLot; dealId: string | null }`
- `buildSalesLog({ departures, vehicles, deals, month }: {...; month: string | null}): SalesLogRow[]` — Chicago date via `todayIso(new Date(leftAt))`; filter to month when given; newest first; deal attached per builder call 3 (one deal per departure; first match wins).

Tests (values): title search `"jeep comp"` finds `2023 Jeep Compass Altitude`; `"169"` ranks `16945` before a title containing 169; empty → `[]`; limit honoured. Sales log: departure `2026-11-01T04:30:00Z` → `leftOn 2026-10-31`, month `2026-10`; deal 2026-10-20 + departures 10-25 and 11-03 → attaches to 10-25 only; deal 10-28 + departure 10-25 only → attaches (fallback); deal on other vehicle never attaches; sorted newest first; missing vehicle row → skipped.

- [ ] Write tests → run `npx vitest run src/lib/inventory/vehicle-options.test.ts src/lib/inventory/sales-log.test.ts` → FAIL → implement → PASS.

### Task 3: Data reads

**Files:** Modify `src/lib/data.ts`.

**Produces:** `DealRow.vehicle_id: string | null` (+ in `DEAL_SELECT`); `getDealVehicleOptions(): Promise<VehicleOption[]>` (in stock or `removed_at` ≥ now − 30 days); `getVehicleById(id): Promise<Vehicle | null>`; `getSalesLogData(month): Promise<{ departures; vehicles; deals }>` (the month's `removed` events ± 1 day with their cars, *every* departure of those cars so deals attach correctly, and their linked deals — per month so the 1,000-row API cap never bites). Typecheck passes.

### Task 4: Deal form search + linked car on the deal page

**Files:** Create `src/app/(app)/deals/stock-field.tsx`. Modify `deal-form.tsx` (replace the stock input; new prop `vehicles: VehicleOption[]`), `deals/new/page.tsx`, `deals/[id]/page.tsx` (load options; show linked car above the form and in the locked state).

- `StockField({ defaultValue, vehicles })` — controlled `input` named `stock_number` (same attributes as today), ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`), listbox of up to 8 `searchVehicleOptions` results, each ≥ 44px with 48px thumbnail / "No photo" box, title, `#stock`, "Left inventory" tag when gone. Arrow keys move, Enter picks (prevents submit only when a row is active), Escape closes, tap picks (`onPointerDown` preventDefault so blur doesn't close first). Picking sets the text to the stock number and closes.
- Linked car: card link to `/inventory/[stock]`, 64px thumbnail + title + `Stock #…`, eyebrow "Vehicle".

### Task 5: Sales log page

**Files:** Create `src/app/(app)/admin/sales-log/page.tsx`. Modify `inventory/page.tsx` (admin-only "Sold" chip → `/admin/sales-log`), `src/app/CLAUDE.md`, `src/lib/CLAUDE.md`.

- `requireAdmin()`; `?month=YYYY-MM` (default current month) switched with the existing `MonthNav`.
- Phones: card list (title, stock, left date, days, first → last price, body style, Deal link or "No deal"). `sm:` and up: table in `overflow-x-auto` with all columns. Deal opens `/deals/[id]`. Empty state copy: "No cars left inventory in this month."
- Note under heading: "Linked deal = retail sale logged here. No deal can mean wholesale or moved."

### Task 6: Verify + browser QA

- [ ] `scripts/verify.sh` green.
- [ ] Ask Malcolm before `npm run qa:accounts -- create`; at 360px: salesperson logs a deal by picking a suggestion → deal page shows the car; types a stock by hand → saves; admin opens Sold chip → sales log, month filter, deal link. Delete QA logins.
- [ ] Update `dev/active/inventory-marketplace/` (main checkout), ask Malcolm before commit + push.
