# Inventory tab, Marketplace posting kit, and sales log — design

**Date:** 2026-11-06 · **Owner:** Malcolm Heath · **Status:** Draft for approval

## Why

Shaver is having a team member (a new **Porter** role) post vehicles to Facebook Marketplace from their personal profile, because dealer auto-posting to Marketplace is limited. Posting by hand is slow and error-prone: photos have to get onto the phone, a description has to be written, and VIN/title/price typed into Facebook's form. Listings also go stale: a car sells or its price drops and the Facebook post stays up.

Pulling the store's live inventory feed into this app solves all of that, and it also gives the rest of the app what it never had: a record of each actual car. Deals can link to a real vehicle instead of a typed stock number, and every car that leaves inventory gets logged, so later we can report on what sells fastest and slowest (and eventually suggest what to buy).

**Success:** the Porter can open the app on their phone, pick the oldest car that isn't posted yet, and have it live on Marketplace in about two minutes, then hear from the app the same day that car sells or its price changes.

## Goals

1. Ingest the VinCue inventory feed daily (plus on demand) and show current inventory in a new **Inventory** tab.
2. A **Post on Marketplace** kit per vehicle: save all photos, copy a generated description, copy VIN / title / price.
3. A **Posted / Not posted** toggle per vehicle, with tabs to split them; Not posted sorted oldest on the lot first.
4. In-app **alerts** to the person who posted a car when it leaves the feed ("sold") or its price changes.
5. A **Porter** staff type that sees only Inventory.
6. **Deal linking:** the deal form's stock number field searches inventory; deals link to the vehicle.
7. **Vehicle history** that never deletes cars: price changes, leaving and returning, posted/unposted, all visible on the vehicle.
8. A **sales log** (admin) of every car that left inventory since go-live, capturing everything later reports need.

## Non-goals (this round)

- Posting to Facebook automatically, or any Facebook API integration.
- Text/email notifications (Resend or SMS later; alerts are in-app only).
- The "what sells fastest / slowest" analysis page. **Phase 4, after roughly a month of data.** The data for it is captured from day one.
- Inventory stocking suggestions (far future).
- Backfilling Jan–Oct 2026 sales into the log (the feed has no history).
- Claude/AI-written descriptions. Use a fixed template; AI may come later.
- Editing vehicle data in the app. The feed is the source of truth.

## Anti-goals (would make this a failure even if it "works")

- A broken or empty feed marking the whole lot sold and flooding the Porter with alerts.
- The dealer key in the feed URL leaking to salespeople, the browser, logs, or git.
- Porters seeing deals, commission, or anyone's pay.
- Making the deal form harder: a salesperson must still be able to type a stock number and save, even if the car isn't in inventory.
- Anything that breaks the mobile standards in `CLAUDE.md`. The Porter works entirely from a phone.

## The feed (decided)

- **Source:** VinCue's Facebook export, the original source behind the DSRPTV Meta feed. Example (the real URL lives only in the database):
  `https://alpha.vincue.com/export/facebookExport.aspx?dealerkey=…&iss=1`
- CSV, about 800 KB, 146 rows on 2026-11-06, served as `application/vnd.ms-excel`, no auth beyond the key in the URL.
- **Columns used:** `vehicle_id` (= VIN), `vin`, `stock_number` (filled in and unique on every row), `year`, `make`, `model`, `trim`, `body_style`, `drivetrain`, `transmission`, `fuel_type`, `mileage.value`, `exterior_color`, `interior_color`, `price` (`"47729.00 USD"`; `sale_price` currently always equals `price`), `url`, `image`, `description`, `date_first_on_lot` (`YYYY-MM-DD`), `days_on_lot`, `dealer_name`, `dealer_phone`, `address`.
- **Quirks:**
  - `title` has no trim. Build the display title from `year make model trim`.
  - `image` is one field holding a pseudo-JSON list: `[{url:'https://…jpg'},{url:'…'}]` (single quotes, unquoted keys). Parse it by pulling out each `url:'…'`. Up to 20 images; the photo CDN (`cdn-img.vincue.net`) sends `Access-Control-Allow-Origin: *`, so the browser can fetch the images directly.
  - `description` is HTML ad copy with `\n` escape sequences. It isn't used as-is for Marketplace.
  - `custom_label_1/2` hold internal VinCue tags (`BB`, `<10`, `Slow/Go/Boost/Stop`). **Not shown or stored this round** (my call; easy to add later).
  - `availability` is always `AVAILABLE`. **"Sold" means "left the feed."**
- The feed URL is an admin setting; admins can replace it. Nothing about the feed URL is hard-coded.

## How it works

### Ingestion

- One server-side ingest routine, used by both the daily schedule and the admin **Refresh now** button: fetch the CSV → parse with the existing `csv-parse` dependency (move it from devDependencies to dependencies) → validate rows with zod → hand the cleaned rows to one Postgres function that applies the changes in a single transaction.
- **Parsing is a pure, tested function** (`src/lib/inventory/…`): CSV text in, typed vehicle rows out, plus a list of rows it rejected and why. Price strings become numbers; image lists become string arrays.
- **Applying changes (in Postgres), per VIN:**
  - New VIN → insert vehicle (`in_stock`), event `added`.
  - Existing in-stock VIN → update details; if price differs, event `price_change` (old → new) and, if the car is currently posted, an alert to the poster.
  - VIN previously `gone` reappears → back to `in_stock`, event `returned`.
  - In-stock VIN missing from the feed → `gone`, `removed_at` set, final days on lot and last price frozen, event `removed`, and if posted an alert ("Sold — take down your listing") to the poster.
- **Safety stop (anti-goal 1):** if the feed fails to download, parses to zero rows, or would remove more than 30% of in-stock cars in one run, apply nothing, record the run as failed with the reason, and show it in Settings. An admin can force it from Settings with a "Apply anyway" option (my call on the 30% threshold).
- Every run is recorded (`started`, `finished`, ok/failed, counts added/updated/price changes/removed/returned, error text, who triggered it or "schedule"). Settings shows the last run and the last few.
- **Schedule:** a Vercel Cron hits an ingest route once a day, early morning Central (about 6:00 am CT = 11:00 or 12:00 UTC depending on DST; exact minute is the builder's call). The route checks Vercel's `CRON_SECRET` header.
- **Writing without a signed-in user (approved, see "Security call").** The cron run has no user session. The ingest route, after checking `CRON_SECRET`, uses the service-role client **only** to call the one ingest function, which is granted to `service_role` and to admins (for Refresh now). Record this as a new decision in `docs/decisions/` and narrow `.claude/rules/security.md` to name this single exception.

### Data (new migration(s), applied to production only with Malcolm's OK)

- `staff.is_porter boolean not null default false`.
- `inventory_feed` (single row): `url`, `updated_at`, `updated_by`. **Admin-only RLS** (read and write), so the dealer key never reaches non-admins.
- `vehicles`: VIN (unique), stock number, year/make/model/trim, body style, drivetrain, transmission, fuel type, mileage, exterior/interior color, `price` (current), `first_price`, vehicle page `url`, `images text[]`, `description_html` (raw, kept for later), dealer phone/address for the template, `date_first_on_lot`, `status` (`in_stock` | `gone`), `first_seen_at`, `last_seen_at`, `removed_at`. Never deleted.
- `vehicle_events`: vehicle, kind (`added`, `price_change`, `removed`, `returned`, `posted`, `unposted`), old/new price where relevant, `at`, `by` staff (null for feed events).
- `inventory_alerts`: vehicle, `staff_id` (who it's for), kind (`sold` | `price_change`), old/new price, `created_at`, `dismissed_at`.
- `inventory_runs`: the run log above.
- `deals.vehicle_id uuid null references vehicles`.
- **Posted status lives in its own table** so the database, not the UI, keeps it from salespeople: `vehicle_posts` (vehicle id as key, `posted_by`, `posted_at`; a row exists only while posted), readable by porters and admins only. (This replaces the `posted_by`/`posted_at` columns on `vehicles` listed above.)
- **RLS:** `vehicles` readable by any active staff member. `vehicle_events` readable by any active staff member, except `posted`/`unposted` rows, which are porter/admin only (row filter on kind). `inventory_alerts` readable by the staff member it's for, or admins. `inventory_runs` admin-only. No write policies; writes go through security-definer functions:
  - `ingest_inventory(rows jsonb, force boolean)` — admin or service role.
  - `set_vehicle_posted(vehicle_id, posted boolean)` — porter or admin; records the event.
  - `dismiss_inventory_alert(alert_id)` — the alert's owner or admin.
  - `save_deal` updated via a new migration: when the stock number matches a vehicle, set `vehicle_id` to it (latest vehicle with that stock number); otherwise leave it null. **The server decides the link from the stock number**; the form never sends a trusted vehicle id.
- **Posted status through leaving and returning (my call):** when a posted car leaves the feed its `vehicle_posts` row stays, so the Porter can still see it needs taking down; the Posted tab lists only in-stock cars, and the sold alert is the to-do. Dismissing a *sold* alert clears that car's posted status (event `unposted`). A car that returns to the feed comes back as **Not posted** (any leftover post row is cleared), since its listing was taken down.
- **Each departure is its own sales-log entry (my call):** a car can leave, return, and leave again. Each `removed` event stores the frozen last price and days on lot for that departure, and the sales log is built from `removed` events, not from columns on `vehicles` (`vehicles.removed_at` just mirrors the latest one). A linked deal is shown against the vehicle's most recent departure on or after the deal's sale date.
- **Stock number reuse guard (my call):** VinCue stock numbers look sequential (16714…17231), so reuse is unlikely, but linking a deal to a vehicle (in `save_deal` and in the backfill) also requires the deal's sale date to be on or after the vehicle's `date_first_on_lot`. That way an old deal can never link to a newer car that reuses its number.
- Days on lot is computed from `date_first_on_lot` (America/Chicago) while in stock, and frozen at `removed_at` when gone. The feed's `days_on_lot` is ignored (it's a snapshot).

### Who sees what

| | Porter | Salesperson | Admin |
|---|---|---|---|
| Inventory list + vehicle details + vehicle history | ✓ | ✓ (no posted info) | ✓ |
| Posted toggle, Posted/Not posted tabs, Marketplace kit | ✓ | — | ✓ |
| Alerts | their own | — | their own (when they posted) |
| Sales log | — | — | ✓ |
| Feed settings, Refresh now, run log | — | — | ✓ |
| Dashboard, deals, history, admin pages | — | as today | as today |

- Porter-only users land on `/inventory` after sign-in. The nav shows only Inventory. Visiting other pages redirects to `/inventory`. A staff member can be Porter + Salesperson; then they get both sets.
- Admins can toggle Porter in **Admin → Staff**, like the other switches. Malcolm sets the Porter's starting password with `npm run user:password`; the existing forced password change on first sign-in applies.
- Every server action re-checks the viewer (`requireMe`/`requireAdmin`/porter check + `assertNotImpersonating`), and the Postgres functions re-check again.

### Screens (mobile-first; check at 360px)

**Inventory (`/inventory`)** — new top-level nav tab for porters, salespeople and admins.
- Search box (stock #, year, make, model, VIN).
- Porter/admin tabs: **Not posted** (default; sorted by days on lot, oldest first) · **Posted** (sorted by posted date, newest first) · **All**. Salespeople see one list (sorted by days on lot, oldest first; my call).
- Each row/card: first photo, year make model trim, stock #, price, miles, days on lot, and (porter/admin) a **Posted / Not posted** toggle button. Tapping the row opens the vehicle details.
- **Alerts** (porter/admin): a strip at the top of Inventory listing undismissed alerts for the viewer: "Sold — take down your listing: 2023 Jeep Compass Altitude · #16945" / "Price changed $22,729 → $21,729 — update your listing". Each has Dismiss; tapping opens the vehicle. A count badge on the Inventory nav tab (my call).

**Vehicle details** — a sheet/modal on top of the list, or its own route `/inventory/[stock]`. The builder picks; it must be linkable and work with the back button on phones.
- Photo gallery, all details, link to the vehicle page on shavercars.com, the **Posted** toggle (porter/admin), a **Post on Marketplace** button (porter/admin), and **History**: added, price changes (old → new, date), left/returned, and posted/unposted (posted events porter/admin only).
- Gone vehicles stay viewable (from deal links, alerts, the sales log) with a clear "No longer in inventory since …" banner and no Marketplace button.

**Post on Marketplace** — phone-first view for one vehicle.
1. **Save photos** — fetches all images and opens the phone's share sheet with them as files (`navigator.share({ files })`), so the Porter can tap "Save N Images" to the camera roll. Where file sharing isn't supported (most desktops), fall back to downloading them. Show progress while fetching. iOS share-sheet behavior with ~20 images goes on `audit/DEVICE_TEST_CHECKLIST.md`.
2. **Copy description** — copies the generated template text (below), shown in a preview box first.
3. **Copy details** — three rows, each with its own Copy button: **VIN**, **Title** (`Year Make Model Trim`), **Price** (copied as plain digits like `22729`, because Facebook's price field wants a number; shown formatted). A brief "Copied" confirmation on each.
- Opening this view does **not** change posted status. The Posted toggle is also on this view, so the Porter can mark it posted when done.

**Admin → Settings → Inventory feed** (a new section on the existing Settings page)
- Feed URL field (shows the current URL to admins; Save validates it's an `https` URL). Replacing it takes effect on the next run.
- **Refresh now** button → runs ingest immediately and shows the result (counts, or the error/safety-stop reason, with an "Apply anyway" for a safety stop).
- Last run time + status, and the last ~10 runs.

**Sales log (admin)** — admin page, e.g. `/admin/sales-log` with an Admin nav entry, or a "Sold" tab on Inventory visible only to admins (builder picks whichever fits the nav better at 360px).
- Every vehicle that left inventory: date left, stock #, year make model trim, body style, first price, last price, days on lot, and linked deal (yes/no; linked deals open the deal). Filter by month left. Newest first.
- "Linked deal" = confirmed retail sale. No deal = possibly wholesale/moved; shown, not hidden.

### Deal form

- The stock number field becomes a search-as-you-type field: matches in-stock vehicles plus vehicles that left inventory in the last 30 days (a car often drops off the feed before the deal is logged). Each suggestion shows photo, year make model trim, stock #. Picking fills in the stock number.
- Typing a stock number by hand still works exactly as today. Whether it links is decided server-side by `save_deal` (exact stock number match).
- The deal view shows the linked vehicle (thumbnail + title, links to the vehicle) when there is one.
- Existing deals: run a one-time link of existing deals whose stock number matches a vehicle (only matters for cars still in the feed at go-live; my call, as part of the migration).

### Marketplace description template (fixed, plain text)

A pure function with tests. Rules:
- Plain text only: no HTML, no `\n` escapes left, renders cleanly in Facebook's description box.
- Uses only facts from the feed: no invented claims ("financing available," "one owner," "clean Carfax," warranty).
- Includes: title line; price and miles; exterior/interior color; drivetrain · transmission · fuel · body style; up to ~8 highlights pulled from the `<li>` items in the feed description, if any; stock # and VIN; dealer name (`dealer_name`), address and phone from the feed (stored on the vehicle at ingest); a call-or-message line.
- Under ~1,500 characters. Modest emoji use at most (builder's call). Malcolm reviews the wording before go-live.

## Phases (each phase: verify skill passes + flow exercised in the browser; DB changes applied only with Malcolm's OK)

1. **Feed + Inventory + Porter + Marketplace kit:** migrations (staff.is_porter, inventory_feed, vehicles, vehicle_events, inventory_runs, posted function), parser + tests, ingest (manual + cron), Settings section, Inventory list/details/history, Posted toggle + tabs, Marketplace kit, Porter role and routing.
2. **Alerts:** inventory_alerts, generation inside ingest, alert strip + badge, dismiss.
3. **Deal linking + sales log:** deals.vehicle_id, save_deal update + backfill, deal form search, linked vehicle on deals, sales log page.
4. **Later (separate request):** fastest/slowest analysis: average days on lot for confirmed sales grouped by make + model, by body style, and by price band; fastest-first and slowest-first views.

Each phase is merged to `main` only after Malcolm confirms (he commits/pushes; Vercel deploys).

## Constraints

- Stack and conventions in `CLAUDE.md` (Next.js 16, Supabase RLS + security-definer functions, data access only through `src/lib/data.ts`, named exports, kebab-case files, design tokens, mobile standards, zod on every action).
- One database, and it's production. Every migration is new and numbered (`0008…`), and is applied only after asking.
- Vercel Cron on this project's plan: once a day is enough.
- QA logins use `@shaver.test` and are deleted after testing; a QA Porter account will be needed.

## Left to the builder

- Exact table/column names, indexes, file layout within the conventions.
- Details sheet vs route; sales log location; exact cron minute; emoji in the template; placeholder when a car has no photos; pagination vs a single list (about 150 cars, so a single list is fine).
- Desktop photo fallback mechanics (individual downloads are fine; no zip dependency needed).

## Security call (decided by Malcolm, 2026-11-06)

The daily automatic refresh runs with no one signed in. **Approved:** one narrow service-role exception. The scheduled route, after verifying `CRON_SECRET`, may use the service-role client only to call `ingest_inventory`. Record it as `docs/decisions/0003-…` and narrow `.claude/rules/security.md` to name this single exception.
