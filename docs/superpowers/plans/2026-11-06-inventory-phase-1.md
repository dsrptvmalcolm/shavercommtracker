# Inventory Phase 1 (feed, Inventory tab, Porter, Marketplace kit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest the VinCue inventory feed daily and on demand, show it in a new Inventory tab, add the Porter staff type, a Posted/Not posted toggle, and the Post on Marketplace kit.

**Architecture:** A pure parser turns the CSV into typed rows. One security-definer Postgres function (`ingest_inventory`) applies them in a single transaction (insert/update/price-change/remove/return events plus a safety stop) and logs the run. The same TypeScript `runIngest` is called by an admin server action (user session) and a Vercel Cron route (service role, the one approved exception). Pages are server components reading through `src/lib/data.ts`; writes are server actions that call security-definer functions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Supabase Postgres + RLS, `csv-parse`, zod, Vitest, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-11-06-inventory-marketplace-design.md` (phase 1 only; alerts = phase 2, deal linking + sales log = phase 3).

## Global Constraints

- Follow `CLAUDE.md` + `.claude/rules/*`: named exports (default only for page/layout/loading/route handlers' required exports), kebab-case files, PascalCase components, 2-space indent, design tokens from `src/app/globals.css` (`card`, `btn-primary`, `btn-*`, `input`, `field-label`, `chip`, `display`, `eyebrow`), no new hex colors.
- Mobile standards: unprefixed classes = phone; every tap target ≥ 44×44 (`min-h-11`); form fields use `input`; no text under `text-xs`; no horizontal page scroll at 360px; nothing hover-only; right keyboards (`inputMode`, `autoCapitalize="none"`, `enterKeyHint`).
- Every server action: zod-validate input, call `assertNotImpersonating()`, re-check the role (`requireAdmin()` or `requirePoster()`), and return `ActionState` (`{ error } | { ok }`), then `revalidatePath("/", "layout")`.
- Data reads go in `src/lib/data.ts` only (wrapped in `cache()`); Postgres numerics arrive as strings, so use `num`/`numOrNull`.
- Migration file: `supabase/migrations/0008_inventory.sql`. **Never run `npm run db:migrate` without asking Malcolm first** (production DB). New tables enable RLS in the same migration; functions are `security definer set search_path = public`, `revoke … from public, anon`, `grant … to authenticated` (plus `service_role` only where stated).
- The feed URL contains a dealer key: it never appears in code, tests, logs, client components, or non-admin queries.
- **Commits:** every "Commit" step means *stage the files and commit only after Malcolm confirms*. The hook blocks commits when `scripts/verify.sh` fails. Conventional commit messages, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit existing test files (a hook blocks it). Add new test files only.
- QA logins use `@shaver.test` emails and are deleted after testing (`npm run qa:accounts`; ask first).

## Review Focus

1. **Feed row with blank/odd fields** (blank `exterior_color` on 1 row today, `drivetrain`/`fuel_type` = `Other`/`OTHER`, missing images): the row must still ingest, and the template must leave out the blank/"Other" parts instead of printing `Exterior: ` or `Other`. Tests in Task 2 and Task 3.
2. **Feed download fails or returns HTML/empty** (VinCue outage, key revoked): nothing changes in the DB, the run is logged as failed with a readable reason, and Settings shows it. Tests in Task 2 (`parseFeed` on HTML → zero rows + rejection) and SQL check in Task 1.
3. **Feed would remove >30% of in-stock cars:** safety stop: nothing applied, run logged as `stopped`. Only `force = true` applies it. SQL check in Task 1.
4. **Porter hitting deal/dashboard URLs or POSTing `saveDeal` directly:** redirected to `/inventory`; `save_deal` raises for non-salesperson non-admins. Checked in Task 1 (SQL) and Task 5 (browser).
5. **Salesperson calling `setVehiclePosted` or reading `vehicle_posts`:** the function raises and the RLS query returns zero rows. SQL check in Task 1.

---

### Task 1: Database migration `0008_inventory.sql`

**Files:**
- Create: `supabase/migrations/0008_inventory.sql`
- Create: `scripts/.tmp-check-inventory-rls.mts` (deleted after running)
- Modify: `supabase/CLAUDE.md` (add a `0008` line under Key files)

**Interfaces:**
- Produces (SQL):
  - `staff.is_porter boolean not null default false`
  - `public.is_porter_or_admin() returns boolean` (same style as `is_admin()`: active staff by JWT email, `is_porter or is_admin`)
  - `inventory_feed (id int primary key default 1 check (id = 1), url text, listing_phone text not null default '219-235-8687', updated_at timestamptz, updated_by uuid references staff)`; seed one row with `url` null. RLS: admin-only `for all`.
  - `vehicles (id uuid pk, vin text unique not null, stock_number text not null, year int, make text, model text, trim text, body_style text, drivetrain text, transmission text, fuel_type text, mileage int, price numeric(12,2), first_price numeric(12,2), exterior_color text, interior_color text, url text, images text[] not null default '{}', description_html text, dealer_name text, dealer_address text, date_first_on_lot date, status text not null check (status in ('in_stock','gone')), first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), removed_at timestamptz)`; index on `stock_number`, index on `(status, date_first_on_lot)`. RLS select: `(select my_staff_id()) is not null`.
  - `vehicle_events (id uuid pk, vehicle_id uuid not null references vehicles, kind text not null check (kind in ('added','price_change','removed','returned','posted','unposted')), old_price numeric(12,2), new_price numeric(12,2), days_on_lot int, at timestamptz not null default now(), by_staff uuid references staff)`; index `(vehicle_id, at)`. RLS select: active staff, and `kind not in ('posted','unposted') or (select is_porter_or_admin())`.
  - `vehicle_posts (vehicle_id uuid primary key references vehicles, posted_by uuid not null references staff, posted_at timestamptz not null default now())`. RLS select: `(select is_porter_or_admin())`.
  - `inventory_runs (id uuid pk, started_at timestamptz not null default now(), finished_at timestamptz, status text not null check (status in ('ok','failed','stopped')), trigger text not null, triggered_by uuid references staff, added int default 0, updated int default 0, price_changes int default 0, removed int default 0, returned int default 0, rejected int default 0, message text)`. RLS select: admin only.
  - `ingest_inventory(p_rows jsonb, p_force boolean default false, p_error text default null, p_rejected int default 0) returns jsonb`, which returns `{status, added, updated, price_changes, removed, returned, message}`.
  - `set_vehicle_posted(p_vehicle_id uuid, p_posted boolean) returns void`.
  - `get_listing_phone() returns text`: returns `inventory_feed.listing_phone`; raises 42501 unless `(select is_porter_or_admin())`. This lets porters read the phone without reading the admin-only feed row (which holds the dealer key).
  - `save_deal(p jsonb)` re-created from `0003`, identical except it raises `'Only salespeople and admins can log deals'` (errcode 42501) when the caller is neither admin nor an active salesperson.
- `p_rows` element keys (produced by Task 2's `toIngestPayload`): `vin, stock_number, year, make, model, trim, body_style, drivetrain, transmission, fuel_type, mileage, price, exterior_color, interior_color, url, images (string array), description_html, dealer_name, dealer_address, date_first_on_lot ('YYYY-MM-DD' or null)`.

- [ ] **Step 1: Write the migration**

`ingest_inventory` authorization: allow when `(select public.is_admin())` or `coalesce(auth.jwt() ->> 'role', '') = 'service_role'`; else raise 42501. `trigger` = `'manual'` with `triggered_by = my_staff_id()` when a staff member is calling, else `'schedule'`. Algorithm (the one part the tests don't pin):

```
if p_error is not null → insert run(status 'failed', message p_error); return.
n_feed := jsonb_array_length(p_rows)
if n_feed = 0 → run 'failed', message 'Feed had no vehicles'; return.
n_in_stock := count(vehicles where status='in_stock')
n_remove := count(in-stock vehicles whose vin is not in p_rows)
if not p_force and n_in_stock > 0 and n_remove > 0.3 * n_in_stock →
   run 'stopped', message format('Would remove %s of %s cars — not applied', n_remove, n_in_stock); return.
for each row:
  new vin → insert (status in_stock, first_price = price), event 'added' (new_price)
  existing gone → status in_stock, removed_at null, delete from vehicle_posts, event 'returned'
  price differs (is distinct from) → event 'price_change' (old, new)
  update all detail columns + last_seen_at = now()
for each in-stock vin not in feed → status 'gone', removed_at now(),
  event 'removed' with old_price = price, days_on_lot = (now() at time zone 'America/Chicago')::date - date_first_on_lot
  (vehicle_posts row is KEPT; phase 2 alerts rely on it)
insert run 'ok' with counts (rejected = p_rejected); return counts.
```

`set_vehicle_posted`: require `(select is_porter_or_admin())` (raise 42501 otherwise); require the vehicle is `in_stock` when posting (raise `'This car is no longer in inventory'`); posting = upsert `vehicle_posts` (posted_by = my_staff_id, posted_at = now()) + event `posted` with `by_staff`; un-posting = delete + event `unposted`; no-op (no event) if already in the requested state.

Grants: `ingest_inventory` → `authenticated, service_role`; `set_vehicle_posted` and `save_deal` → `authenticated`.

- [ ] **Step 2: Write the RLS/function check script** `scripts/.tmp-check-inventory-rls.mts` using `createDbClient` from `scripts/db.ts`. It runs everything inside `begin … rollback` and prints PASS/FAIL per check:
  - Apply the migration SQL text inside the transaction (so it can be checked **before** it's applied to production).
  - Create temp staff rows: an admin, a salesperson, a porter (`@shaver.test` emails) and switch identity with `set local role authenticated; select set_config('request.jwt.claims', '{"email":"…","role":"authenticated"}', true);`.
  - As admin: `ingest_inventory` with 10 rows → `status ok, added 10`; again with row 1's price changed → `price_changes 1` and one `price_change` event; again with 9 rows → `removed 1`, the vehicle `gone`, event `removed` has `days_on_lot`; again with all 10 → `returned 1`.
  - As admin: ingest 6 of the 10 → `status stopped`, nothing changed; same with `p_force true` → `ok, removed 4`.
  - As admin: `p_error 'boom'` → `failed`, run logged.
  - As porter: `set_vehicle_posted(v, true)` succeeds; `select count(*) from vehicle_posts` = 1; `save_deal('{"sale_date":…,"customer_name":"QA","stock_number":"X"}')` raises 42501; `select * from inventory_feed` returns 0 rows; `ingest_inventory` raises.
  - As salesperson: `set_vehicle_posted` raises; `vehicle_posts` count = 0; `vehicle_events where kind = 'posted'` count = 0; `vehicles` count > 0; `inventory_runs` count = 0.

- [ ] **Step 3: Run the check**

Run: `npx tsx --env-file=.env.local scripts/.tmp-check-inventory-rls.mts`
Expected: every line `PASS`, ending in `rolled back`. Fix the migration until it does.

- [ ] **Step 4: Ask Malcolm, then apply**

Ask: "Ready to apply migration 0008 (inventory tables, Porter flag, save_deal guard) to production?" Only on yes, run `npm run db:migrate` → expected `applied 0008_inventory.sql`. Then delete `scripts/.tmp-check-inventory-rls.mts`.

- [ ] **Step 5: Commit** `feat: inventory schema, Porter flag and save_deal role guard`

---

### Task 2: Feed parser

**Files:**
- Create: `src/lib/inventory/types.ts`, `src/lib/inventory/parse-feed.ts`, `src/lib/inventory/parse-feed.test.ts`, `src/lib/inventory/fixtures/vincue-sample.csv`
- Modify: `package.json` (move `csv-parse` from devDependencies to dependencies)

**Interfaces:**
- Produces:
  - `type FeedVehicle = { vin: string; stockNumber: string; year: number | null; make: string; model: string; trim: string; bodyStyle: string; drivetrain: string; transmission: string; fuelType: string; mileage: number | null; price: number | null; exteriorColor: string; interiorColor: string; url: string; images: string[]; descriptionHtml: string; dealerName: string; dealerAddress: string; dateFirstOnLot: string | null }` (in `types.ts`)
  - `parseFeed(csv: string): { vehicles: FeedVehicle[]; rejected: { line: number; reason: string }[] }`
  - `parseImages(field: string): string[]`, `parsePrice(field: string): number | null`, `parseAddress(field: string): string`
  - `toIngestPayload(vehicles: FeedVehicle[]): Record<string, unknown>[]` (snake_case keys exactly as listed in Task 1)

- [ ] **Step 1: Build the fixture** from 3 real rows of the VinCue export (download with `curl` into the scratchpad, never commit the URL): stock `16945` (Jeep Compass), the row with blank `exterior_color`, and one row with `drivetrain` `Other`. Keep all 35 columns and the header. Trim `image` to the first 3 URLs and `description` to the first `<ul>` block. No customer data exists in this feed.

- [ ] **Step 2: Write failing tests** in `parse-feed.test.ts`:
  - `parses the sample feed`: `vehicles.length === 3`, `rejected.length === 0`; the 16945 row has `vin '3C4NJDBN0PT528489'`, `stockNumber '16945'`, `year 2023`, `make 'Jeep'`, `model 'Compass'`, `trim 'Altitude'`, `mileage 40403`, `exteriorColor 'Billet Silver Metallic Clearcoat'`, `dateFirstOnLot '2026-06-19'`, `images.length === 3`, all starting `https://cdn-img.vincue.net/`, `dealerAddress '5701 Broadway, Merrillville, IN 46410'`.
  - `parsePrice('21729.00 USD') === 21729`; `parsePrice('') === null`; `parsePrice('abc') === null`.
  - `parseImages("[{url:'https://a/1.jpg'},{url:'https://a/2.jpg'}]")` deep-equals `['https://a/1.jpg','https://a/2.jpg']`; `parseImages('')` → `[]`.
  - `rejects rows without a VIN or stock number`: the fixture with one row's `vin` blanked → `vehicles.length 2`, `rejected[0].reason` contains `'VIN'`.
  - `returns zero vehicles for non-CSV input`: `parseFeed('<html>Error</html>').vehicles.length === 0` (and does not throw).
  - `keeps a row with blank color`: the blank-color row parses with `exteriorColor ''`.
  - `toIngestPayload` maps `stockNumber` → `stock_number` and `dateFirstOnLot` → `date_first_on_lot`.

- [ ] **Step 3: Run:** `npx vitest run src/lib/inventory/parse-feed.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** with `csv-parse/sync` (`columns: true, bom: true, skip_empty_lines: true, relax_column_count: true`), validating each row with a zod schema (VIN 11–17 chars, non-empty stock number), uppercasing VIN and stock number. Upper-case `stock_number` matches `save_deal`'s `upper(trim(...))`. Wrap the whole parse in try/catch so malformed input returns zero vehicles + one rejection.

- [ ] **Step 5: Run:** same command → PASS. Then `npm run typecheck`.

- [ ] **Step 6: Commit** `feat: parse VinCue inventory feed`

---

### Task 3: Marketplace text + vehicle helpers

**Files:**
- Create: `src/lib/inventory/vehicle.ts`, `src/lib/inventory/vehicle.test.ts`, `src/lib/inventory/marketplace.ts`, `src/lib/inventory/marketplace.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (works on a plain `Vehicle` shape).
- Produces (in `vehicle.ts`):
  - `type Vehicle = { id: string; vin: string; stockNumber: string; year: number | null; make: string; model: string; trim: string; bodyStyle: string; drivetrain: string; transmission: string; fuelType: string; mileage: number | null; price: number | null; firstPrice: number | null; exteriorColor: string; interiorColor: string; url: string; images: string[]; descriptionHtml: string; dealerName: string; dealerAddress: string; dateFirstOnLot: string | null; status: 'in_stock' | 'gone'; removedAt: string | null; postedAt: string | null; postedBy: string | null }`
  - `vehicleTitle(v: Pick<Vehicle,'year'|'make'|'model'|'trim'>): string`: `"2023 Jeep Compass Altitude"`, skipping blanks.
  - `daysOnLot(dateFirstOnLot: string | null, asOf: string): number | null`: whole days, `asOf` is a `YYYY-MM-DD` (callers pass `todayIso()` from `src/lib/months.ts`, or the removal date).
  - `type InventoryTab = 'not-posted' | 'posted' | 'all'`
  - `listVehicles(vehicles: Vehicle[], opts: { tab: InventoryTab; q: string; today: string }): Vehicle[]`: filters in-stock only; tab filter on `postedAt`; `q` matches case-insensitively on stock #, VIN, year, make, model, trim (every whitespace-separated term must match); sort `not-posted` and `all` by days on lot desc (nulls last), `posted` by `postedAt` desc.
- Produces (in `marketplace.ts`):
  - `marketplaceDescription(v: Vehicle, listingPhone: string): string`
  - `marketplaceDetails(v: Vehicle): { vin: string; title: string; price: string }`, where `price` is plain digits (`'21729'`), or `''` when null.
  - `highlights(descriptionHtml: string): string[]`: `<li>` texts, tags stripped, `&amp; &quot; &#39; &lt; &gt;` decoded, trimmed, ≤ 60 chars, deduped, max 8.

- [ ] **Step 1: Write failing tests.**
  - `vehicle.test.ts`: `vehicleTitle` with blank trim → `"2023 Jeep Compass"`; `daysOnLot('2026-06-19','2026-11-06') === 140`; `daysOnLot(null, …) === null`; `listVehicles` cases: gone vehicles excluded; `not-posted` excludes posted and sorts oldest first; `posted` sorts newest `postedAt` first; `q: 'jeep 169'` matches stock `16945` Jeep and not a Jeep with stock `17001`.
  - `marketplace.test.ts`: for the 16945 Jeep (price 21729, mileage 40403, colors as in the feed, drivetrain `4X4`, transmission `AUTOMATIC`, fuel `GASOLINE`, body `SUV`, the fixture's description HTML) and phone `219-235-8687`, `marketplaceDescription` equals exactly:

```
2023 Jeep Compass Altitude
$21,729 · 40,403 miles

Exterior: Billet Silver Metallic Clearcoat
Interior: Black
4X4 · Automatic · Gasoline · SUV

Highlights:
• Altitude Special Edition
• Light Tungsten Interior Accent Stitching
• Gloss Black Grille and Crosshairs
• Gloss Black Badges
• Black Day Light Opening Moldings
• Black Roof
• 225/55R18 BSW AS Tires
• 18" X 7" Gloss Black Painted Aluminum Wheels

Stock #16945 · VIN 3C4NJDBN0PT528489

Shaver Preferred Motors
5701 Broadway, Merrillville, IN 46410
Call 219-235-8687 or send us a message here.
```

  - Blank exterior color → no `Exterior:` line; drivetrain `Other` and fuel `OTHER` are left out of the spec line; no `<li>` → no `Highlights:` block (and no blank-line pile-up); null price → no price segment (`40,403 miles` alone); result never contains `<` or `\n` literal escapes; length ≤ 1500.
  - `marketplaceDetails` → `{ vin: '3C4NJDBN0PT528489', title: '2023 Jeep Compass Altitude', price: '21729' }`.
  - Token casing rule for the spec line: an all-caps alphabetic token of 4+ letters becomes Title case (`AUTOMATIC` → `Automatic`); anything else stays as-is (`4X4`, `AWD`, `SUV`).

- [ ] **Step 2: Run:** `npx vitest run src/lib/inventory` → new tests FAIL.
- [ ] **Step 3: Implement** both files (pure; money formatting via `money0` from `src/lib/format.ts` if it produces `$21,729`, otherwise `Intl.NumberFormat`).
- [ ] **Step 4: Run:** same → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat: Marketplace description template and inventory list helpers`

---

### Task 4: Ingest runner, cron route, Settings section

**Files:**
- Create: `src/lib/inventory/ingest.ts`, `src/app/api/cron/inventory/route.ts`, `src/app/(app)/admin/settings/inventory-feed-section.tsx`, `vercel.json`, `docs/decisions/0003-cron-service-role-ingest.md`
- Modify: `src/proxy.ts` (`PUBLIC_PATHS` add `"/api/cron/"`), `src/lib/data.ts` (feed reads), `src/app/(app)/admin/actions.ts` (two actions), `src/app/(app)/admin/settings/page.tsx` (section + nav link `#inventory`), `src/lib/supabase/admin.ts` (doc comment), `.claude/rules/security.md`, `src/lib/CLAUDE.md`, `src/app/CLAUDE.md`

**Interfaces:**
- Consumes: `parseFeed`, `toIngestPayload` (Task 2); `ingest_inventory` (Task 1).
- Produces:
  - `type IngestResult = { status: 'ok' | 'failed' | 'stopped'; added: number; updated: number; price_changes: number; removed: number; returned: number; message: string | null }`
  - `runIngest(client: SupabaseClient, opts: { force: boolean }): Promise<IngestResult>`: reads `inventory_feed.url` via `client`; no URL → calls the RPC with `p_error 'No feed URL set'`; fetches with a 30 s `AbortSignal.timeout`, `cache: 'no-store'`; non-2xx or network error → RPC with `p_error` = `Feed download failed (HTTP 503)` / `Feed download failed (timeout)` (never include the URL); else `parseFeed` → RPC `ingest_inventory({ p_rows: toIngestPayload(vehicles), p_force: force, p_rejected: rejected.length })`.
  - data.ts: `type FeedSettings = { url: string | null; listingPhone: string; updatedAt: string | null }`; `getFeedSettings(): Promise<FeedSettings>` (admin only, call after `requireAdmin`); `type InventoryRun = { id; startedAt; status; trigger; added; updated; priceChanges; removed; returned; rejected; message }`; `getInventoryRuns(limit = 10): Promise<InventoryRun[]>`; `getListingPhone(): Promise<string>` (RPC `get_listing_phone`, Task 1).
  - admin actions: `saveFeedSettings(_: ActionState, fd: FormData): Promise<ActionState>` (zod: `url` is `""` or an `https://` URL; `listing_phone` is non-empty, ≤ 20 chars); `refreshInventory(_: ActionState, fd: FormData): Promise<ActionState>` (`force` checkbox) → runs `runIngest(await createClient(), { force })` and returns `ok: "Updated — 3 added, 1 removed, 2 price changes"` or `error: <message>` for failed/stopped (stopped message ends with `Tick "Apply anyway" to force it.`).

- [ ] **Step 1: Write `route.ts`**: `export async function GET(request: Request)`. Respond 401 unless `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\`` and `CRON_SECRET` is set; then `runIngest(createAdminClient(), { force: false })`; respond `Response.json({ status, added, removed, price_changes, returned })` (no URL, no message text that could hold it). `export const dynamic = 'force-dynamic'`.
- [ ] **Step 2: `vercel.json`**: `{ "crons": [{ "path": "/api/cron/inventory", "schedule": "0 11 * * *" }] }` (6 am CDT / 5 am CST). Tell Malcolm `CRON_SECRET` must exist in Vercel project env (Production); check with `vercel env ls` and, if it's missing, ask him before adding it.
- [ ] **Step 3: Docs**: decision `0003` (context: no session at cron time; decision: service role used only by `/api/cron/inventory` after `CRON_SECRET` check, only to read `inventory_feed` and call `ingest_inventory`; alternatives rejected: manual-only refresh, pg_cron + pg_net parsing CSV in SQL). Update `security.md`'s service-role line to name this one exception, and `admin.ts`'s comment and `src/lib/CLAUDE.md` to match.
- [ ] **Step 4: Settings section** (`inventory-feed-section.tsx`, server component using `ActionForm`): feed URL `input type="url" inputMode="url" autoCapitalize="none"`, listing phone `type="tel"`, Save; a second `ActionForm` "Refresh now" with an "Apply anyway" checkbox (`name="force"`); last 10 runs as a list: date/time (Central), trigger, status chip (`ok` success / `stopped` and `failed` danger), counts, message. Add `["#inventory", "Inventory feed"]` to the page's section nav.
- [ ] **Step 5: Verify:** `npm run typecheck && npm run lint`. Then, with `npm run dev`, sign in as an admin: paste the VinCue URL, Save, Refresh now → expect `Updated — 146 added…` (roughly), the run listed `ok`. Refresh again → `0 added`. Run `curl -i localhost:3000/api/cron/inventory` → `401`; with `-H "Authorization: Bearer $CRON_SECRET"` (from `.env.local`, not printed) → `200` JSON.
- [ ] **Step 6: Commit** `feat: inventory feed ingest, daily cron and Settings section`

---

### Task 5: Porter role + routing + data reads

**Files:**
- Modify: `src/lib/data.ts`, `src/components/app-shell.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/history/page.tsx`, `src/app/(app)/needs-action/page.tsx`, `src/app/(app)/deals/new/page.tsx`, `src/app/(app)/deals/[id]/page.tsx`, `src/app/(app)/deals/actions.ts`, `src/app/(app)/admin/actions.ts` (`staffSchema`), `src/app/(app)/admin/staff/page.tsx`

**Interfaces:**
- Consumes: `Vehicle` (Task 3); tables (Task 1).
- Produces (data.ts):
  - `Staff.is_porter: boolean`
  - `canPost(me: Staff): boolean` → `me.is_porter || me.is_admin`
  - `isPorterOnly(me: Staff): boolean` → `me.is_porter && !me.is_salesperson && !me.is_admin`
  - `homePath(me: Staff): string` → porter-only `/inventory`, salesperson `/dashboard`, else `/admin`
  - `requirePoster(): Promise<Staff>` → `requireMe()`, redirect `/inventory` unless `canPost`
  - `getInventory(): Promise<Vehicle[]>`: in-stock vehicles plus `vehicle_posts` merged into `postedAt/postedBy` (for salespeople, RLS returns no posts, so they're all null)
  - `getVehicleByStock(stock: string): Promise<Vehicle | null>`: latest by `first_seen_at` (any status)
  - `type VehicleEvent = { id; kind; oldPrice: number | null; newPrice: number | null; daysOnLot: number | null; at: string; byName: string | null }`; `getVehicleEvents(vehicleId: string): Promise<VehicleEvent[]>` (newest first)

- [ ] **Step 1:** Add the above to `data.ts` (map snake_case → `Vehicle`, numerics via `num`/`numOrNull`).
- [ ] **Step 2:** Routing: `(app)/page.tsx` redirects to `homePath(me)`. Dashboard, history, needs-action, deals/new, deals/[id] call `redirect('/inventory')` when `isPorterOnly(viewer.me)` (put it right after the existing `!viewer` check). `deals/actions.ts` save/delete return `{ error: "Only salespeople and admins can log deals" }` for porter-only (the DB guard from Task 1 is the real gate).
- [ ] **Step 3:** `AppShell`: `home = homePath(me)`; add `<NavLink href="/inventory">Inventory</NavLink>` for everyone, placed after History for salespeople and before Store for admins (porter-only sees just Inventory); hide "Log/Add Deal" button and `DealFab` when `isPorterOnly(me)`; role label shows `Admin`, `Sales` or `Porter`.
- [ ] **Step 4:** Staff page: add `["is_porter", "Porter", staff?.is_porter ?? false]` to the checkbox list and a `Porter` chip; add `is_porter: checkbox` to `staffSchema`. Update the page's intro copy: "Porters see only Inventory and post cars to Marketplace."
- [ ] **Step 5: Verify:** `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 6: Commit** `feat: Porter staff type and Inventory nav`

---

### Task 6: Inventory list, vehicle page, Posted toggle

**Files:**
- Create: `src/app/(app)/inventory/page.tsx`, `src/app/(app)/inventory/actions.ts`, `src/app/(app)/inventory/posted-toggle.tsx`, `src/app/(app)/inventory/vehicle-card.tsx`, `src/app/(app)/inventory/[stock]/page.tsx`
- Modify: `src/app/CLAUDE.md` (add the inventory routes to Key files)

**Interfaces:**
- Consumes: `getInventory`, `getVehicleByStock`, `getVehicleEvents`, `canPost`, `requireMe`, `requirePoster` (Task 5); `listVehicles`, `vehicleTitle`, `daysOnLot`, `InventoryTab` (Task 3); `set_vehicle_posted` (Task 1).
- Produces:
  - `setVehiclePosted(vehicleId: string, posted: boolean): Promise<ActionState>` in `inventory/actions.ts` (`"use server"`; zod uuid + boolean; `assertNotImpersonating`; `requirePoster`; RPC; `revalidatePath('/', 'layout')`).
  - `<PostedToggle vehicleId posted />`: client component using `useTransition` + optimistic state. Label `Posted ✓` (filled, `btn-primary`) / `Mark posted` (outline `btn-secondary` or the existing outline utility); `aria-pressed`; ≥ 44px; shows inline error text on failure.

- [ ] **Step 1: List page** (`/inventory?tab=not-posted|posted|all&q=`): `requireMe()`; posters default `tab=not-posted`, salespeople ignore `tab` (use `'all'`). Header (`eyebrow` "Inventory", `display` title, count "146 cars · updated 6:02 am"), a GET search form (`input type="search" enterKeyHint="search"`, keeps `tab`), tab links (posters only) as ≥ 44px pills with counts. Cards (`vehicle-card.tsx`): a plain `<img loading="lazy">` of `images[0]` at 4:3 (not `next/image`, so no remote-image config or optimizer cost; add an eslint disable comment for `@next/next/no-img-element` if lint flags it), title, `Stock #…`, price, miles, `N days`; whole card links to `/inventory/[stock]`; posters also see `<PostedToggle>` outside the link. Grid: 1 column on phones, `sm:grid-cols-2 lg:grid-cols-3`. Empty states: "No cars match" / "Everything's posted 🎉" (no emoji if lint/design objects).
- [ ] **Step 2: Vehicle page** (`/inventory/[stock]`): `requireMe()`; `notFound()` if none. Swipeable photo strip (`overflow-x-auto snap-x`, each `snap-center`, images `loading="lazy"`; the strip scrolls, the page doesn't). Gone → banner "No longer in inventory since {date}". Details list (VIN, stock, miles, colors, drivetrain, transmission, fuel, body, days on lot, first vs current price), "View on shavercars.com" link (`target="_blank" rel="noopener"`). Posters: `<PostedToggle>` and a `btn-primary` link "Post on Marketplace" → `/inventory/[stock]/marketplace` (hidden when gone). History list from `getVehicleEvents` with plain-English lines: `Added to inventory`, `Price $22,729 → $21,729`, `Left inventory (140 days on lot)`, `Back in inventory`, `Posted by Dana`, `Marked not posted by Dana`. A "← Inventory" back link.
- [ ] **Step 3: Verify:** typecheck/lint/test; in the browser (dev server, admin): list shows ~146 cars, Not posted sorted oldest first, search `compass` filters, toggle Posted → moves to Posted tab and history shows "Posted by …"; toggle again → back. At 360px wide: no horizontal page scroll, all buttons ≥ 44px.
- [ ] **Step 4: Commit** `feat: Inventory tab, vehicle page and Posted toggle`

---

### Task 7: Post on Marketplace kit

**Files:**
- Create: `src/app/(app)/inventory/[stock]/marketplace/page.tsx`, `src/app/(app)/inventory/[stock]/marketplace/save-photos-button.tsx`, `src/components/copy-button.tsx`
- Modify: `audit/DEVICE_TEST_CHECKLIST.md`, `src/components/CLAUDE.md` (mention `copy-button.tsx`)

**Interfaces:**
- Consumes: `requirePoster`, `getVehicleByStock` (Task 5); `marketplaceDescription`, `marketplaceDetails`, `vehicleTitle` (Task 3); `get_listing_phone()` via a `getListingPhone()` read in data.ts (Task 4); `<PostedToggle>` (Task 6).
- Produces:
  - `<CopyButton text: string; label: string />`: client; `navigator.clipboard.writeText`, falling back to a hidden-textarea + `document.execCommand('copy')`; shows `Copied ✓` for 2 s (`aria-live="polite"`); ≥ 44px.
  - `<SavePhotosButton urls: string[]; baseName: string />`: client.

- [ ] **Step 1: Page:** `requirePoster()`; gone → redirect to `/inventory/[stock]`. Layout, top to bottom, single column, phone-first: title + stock; **1 · Photos**: `SavePhotosButton` (label `Save 20 photos`) + a row of thumbnails; **2 · Description**: read-only preview (`whitespace-pre-wrap` in a `card`, max height with internal scroll) + `CopyButton label="Copy description"`; **3 · Details**: three rows `VIN`, `Title`, `Price` (price shown formatted, copies plain digits), each with its own `CopyButton label="Copy"`; then `<PostedToggle>` with helper text "Tap when it's live on Marketplace."
- [ ] **Step 2: `SavePhotosButton` behavior:** on click, fetch every URL (`mode: 'cors'`, sequential with progress text `Getting photos 3/20…`) into `File`s named `${baseName}-01.jpg`…; if `navigator.canShare?.({ files })` → `navigator.share({ files, title: baseName })` (catch `AbortError` silently: user closed the sheet); else download each via an object URL + `<a download>` click, 300 ms apart, then revoke. Disable while working; any fetch failure → "Couldn't get photo N, try again".
- [ ] **Step 3: Device checklist:** add an "Inventory / Marketplace kit" section to `audit/DEVICE_TEST_CHECKLIST.md`: iPhone Safari share sheet shows "Save 20 Images" and saves to Photos; Android Chrome share → Photos/Files; Copy buttons paste correctly into the Facebook Marketplace form fields (VIN, title, price as a number); the description keeps its line breaks when pasted into Facebook.
- [ ] **Step 4: Verify:** typecheck/lint/test; browser (desktop) as admin: Copy description → paste into a textarea matches the preview; each detail copy works; Save photos falls back to downloads on desktop Chrome. At 360px: no horizontal scroll; run `npm run audit:mobile` against a running build and confirm no new failures (see `audit/MOBILE_AUDIT.md` → Handoff).
- [ ] **Step 5: Commit** `feat: Post on Marketplace kit`

---

### Task 8: End-to-end check as a Porter and a salesperson

**Files:** none new (QA accounts are temporary).

- [ ] **Step 1:** Ask Malcolm, then `npm run qa:accounts -- create <env-file>` for a salesperson. Create a QA Porter (`porter@shaver.test`) through Admin → Staff with Porter ticked and a temporary password.
- [ ] **Step 2: As the Porter** (360px viewport): forced password change → lands on `/inventory`; nav shows only Inventory; no Log Deal button/FAB; `/dashboard`, `/history`, `/deals/new` redirect to `/inventory`; toggle posted; open the Marketplace kit and copy everything.
- [ ] **Step 3: As the salesperson:** Inventory tab visible, no tabs/toggle/Marketplace button, vehicle history shows price/added events but no posted events; `/inventory/[stock]/marketplace` redirects; dashboard and deals work as before.
- [ ] **Step 4:** Run the `verify` skill (`scripts/verify.sh`) and show its output. Delete both QA accounts (`npm run qa:accounts -- delete`; remove the porter staff row) after asking.
- [ ] **Step 5:** Update `dev/active/inventory-marketplace/` (`save-progress`), the `CLAUDE.md` "Where things live" table (inventory → `src/lib/inventory/`), and hand Malcolm a summary: what's live after his "commit and push", that `CRON_SECRET` must be in Vercel, the listing phone default `219-235-8687` (the feed's `dealer_phone` is a different toll-free number, `+1 877-226-3143`, so it's a setting he can change), and the description wording for his review.
