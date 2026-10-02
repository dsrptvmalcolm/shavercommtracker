---
paths:
  - "src/**"
  - "supabase/**"
  - "scripts/**"
---

PROTECTED — never prune based on model capability; change only when the business rule changes.

# Domain rules — Shaver Preferred Motors

<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Salespeople never see other salespeople's deals or pay. Only admins see the whole store. (Store unit totals are shared.)
<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Jan–Sep 2026 amounts in `paid_months` are what was paid. Never recalculate, overwrite or "fix" them; show recalculations to admins only, as a note.
<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Customer names stay inside the app: never in logs, tests, fixtures, commit messages or chat output.
<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Commission rules live only in the commission engine, and every rule change needs a test.
<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Closed months (before the current month, Central time) are admin-only for edits and deletes.
<!-- added 2026-10-02: initial setup, confirmed by Malcolm -->
- Settings changes never rewrite past months: settings are versioned by `effective_month`, and product spiffs are snapshotted on each deal.
<!-- added 2026-10-02: initial setup -->
- Confirmed commission rules: mini tier pays on every unit; 3+ products = product hat trick bonus instead of product spiffs; 2 cars same day = 2-car day, 3+ = hat trick only; split deals are 50/50 and don't count toward day spiffs; personal best is best ever, ties don't count; store volume pays the highest tier only, to every salesperson, including at zero units; house deals count only toward store volume; multi-lingual pays only to eligible salespeople.
<!-- added 2026-10-02: initial setup -->
- Pacing uses selling days: Monday–Saturday, minus holidays in the `holidays` table.
