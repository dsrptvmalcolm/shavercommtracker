# UI components

Styling follows the Stitch "High-Octane Automotive" design (`stitch_auto_commission_tracker/DESIGN.md`): dark surfaces, #FACC15 yellow, Anton display + Inter body. Tokens and utilities (`card`, `btn-primary`, `btn-secondary`, `btn-danger`, `input`, `field-label`, `eyebrow`, `display`, `chip`, `table-head`) are in `src/app/globals.css`.

## Key files
- `app-shell.tsx` — header, nav, impersonation banner; `deal-fab.tsx` — floating Log/Add Deal button.
- `stat-tile.tsx`, `breakdown.tsx`, `units-gauge.tsx`, `tier-ladder.tsx` (generic: mini tiers and store volume) — dashboard pieces.
- `charts/bar-chart.tsx` (server, CSS hover tooltips, reference lines in a legend) and `charts/pace-chart.tsx` (client, selling-day projection).
- `deal-list.tsx`, `month-nav.tsx`, `action-form.tsx`, `nav-link.tsx`, `view-as-button.tsx`.

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Charts are single-series brand yellow; muted bars + one highlighted bar. Read the `dataviz` skill before adding a multi-series chart.
<!-- added 2026-10-02: initial setup -->
- Button labels use Inter (no `font-display` on buttons — Anton squishes at small sizes).
<!-- added 2026-10-02: initial setup -->
- Server components by default; add `"use client"` only for interaction (hover state, transitions, pathname).

## Where things live
- Hero card layout is duplicated intentionally in `dashboard/page.tsx` and `admin/page.tsx`; extract only if a third copy appears.
