# Server library

## Key files
- `data.ts` — the only server data layer (`server-only`). Viewer resolution (`getViewer`, `requireMe`, `requireAdmin`, `assertNotImpersonating`), reads (deals, staff, settings, products, holidays, paid months, units rollups) and month views (`getSalespersonMonth`, `getStoreMonth`, `getMonthCalendar`). Reads are wrapped in React `cache()`.
- `months.ts` — month math in America/Chicago (`currentMonth`, `shiftMonth`, `monthRange`, `isClosed`) and selling days (`isWorkingDay`, `workingDaysIn`, `workingDaysElapsed`). `months.test.ts` covers working days.
- `format.ts` — `money`, `money0`, `units`, `shortDate`.
- `supabase/server.ts` — per-request client with the user's session (RLS applies). Use this by default.
- `supabase/admin.ts` — service-role client (bypasses RLS). Only for login management after `requireAdmin`, and the inventory cron route (decision 0003).
- `inventory/` — VinCue feed parser (`parse-feed.ts`), `runIngest` (`ingest.ts`), `Vehicle` + list/search/days-on-lot helpers (`vehicle.ts`), Marketplace description template (`marketplace.ts`), alert wording (`alerts.ts`; reads are `getMyAlerts`/`getMyAlertCount` in `data.ts`). Pure modules have colocated tests; `fixtures/vincue-sample.csv` is 3 real feed rows (no customer data).
- `commission/` — the engine (own CLAUDE.md).

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Postgres numerics arrive as strings — convert with the `num`/`numOrNull` helpers in `data.ts`.
<!-- added 2026-10-02: initial setup -->
- Paid months (`paid_months`) are the record for their month; show them as-is and only show recalculations to admins.
<!-- added 2026-10-02: initial setup -->
- Add new reads to `data.ts` next to similar ones; don't query Supabase directly from pages.

## Where things live
- Who is viewing / impersonating: `getViewer` in `data.ts`; cookie name `VIEW_AS_COOKIE`.
- Prior personal best: `priorBestUnits`; team membership for store volume: `onTeamFor`.
