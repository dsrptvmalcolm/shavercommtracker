# Commission engine

Pure, framework-free functions that turn deals + settings into commission. No database, no Next.js imports.

## Key files
- `engine.ts` — all rules: mini tier (retroactive to every unit), front/back %, product spiffs vs product hat trick (3+ products → flat bonus instead), 2-car day / hat trick day (split deals don't count; 4+ cars = hat trick only), multi-lingual, 90 Day+, personal best (ties don't count, first month doesn't count), store volume (highest tier only, house deals count), 50/50 splits, adjustments.
- `types.ts` — `CommissionSettings`, `DealInput`, `SalespersonInput`, `MonthSummary`.
- `engine.test.ts` — rule tests plus Airtable parity for every 2026 deal and month.
- `__fixtures__/airtable-2026.json` — sanitized Airtable export (no customer names). Regenerate only from new exports; never hand-edit expected values.

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Every rule change ships with a test in `engine.test.ts`; parity tests must keep passing.
<!-- added 2026-10-02: initial setup -->
- `KNOWN_DIFFS` in the test lists months where Airtable paid wrong; it is evidence, not a fudge factor — don't add to it without a hand-verified reason.
<!-- added 2026-10-02: initial setup -->
- Round only for display/totals (`round2`); keep per-deal math unrounded like Airtable.

## Where things live
- Pace math: `paceFor` here; selling-day counts in `src/lib/months.ts`.
- Turning DB rows into `DealInput`/settings: `toDealInput`, `toEngineSettings` in `src/lib/data.ts`.
