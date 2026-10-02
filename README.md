# Shaver Team — Commission Tracker

Deal log and commission tracking for Shaver Preferred Motors. Replaces the Airtable base.

**Stack:** Next.js 16 (App Router) on Vercel · Supabase (Postgres + Auth, provisioned via Vercel Marketplace) · Tailwind v4

## How commission is calculated

All math lives in `src/lib/commission/engine.ts` — pure functions, tested against every 2026 Airtable deal.

| Piece | Rule |
|---|---|
| Mini | Tier reached for the month pays on **every** unit (1+ = $200, 15+ = $225, 23+ = $250) |
| Front / back | % of front / back gross (front currently 0%, back 1%) |
| Products | Sum of product spiffs, or a flat product hat trick bonus for 3+ products on one deal |
| 2-car day / hat trick | 2 cars on a day = 2-car day; 3+ = hat trick only. Split deals don't count |
| Multi-lingual | Per-deal checkbox, paid only to multi-lingual-eligible salespeople |
| 90 Day+ | Per-deal flag |
| Personal best | Beat your best month on record (or manual baseline). Ties don't count; a first month doesn't count |
| Store volume | Highest tier reached by store units (incl. house deals), paid to every salesperson on the team |
| Splits | 50/50 — half a unit and half of every per-deal amount each |
| One-off / team spiffs | Admin-entered adjustments per month |

Settings are versioned by month (`commission_settings.effective_month`), so changing rates never rewrites a closed month. Jan–Sep 2026 are stored in `paid_months` exactly as Airtable paid them.

## Access

- **Salespeople** see and log their own deals; they can edit or delete them only in the current month (Central time). They can't touch gross.
- **Admins** see everything, enter back gross, edit any month, add house deals and spiffs, and manage staff, products and settings.

These rules are enforced in Postgres (RLS + `save_deal` / `delete_deal` / `set_deal_gross`), not just the UI.

## Local development

```bash
vercel env pull .env.local   # Supabase keys
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm test` | Commission engine tests (includes Airtable parity) |
| `npm run db:migrate` | Applies `supabase/migrations/*.sql` not yet applied |
| `npm run db:import -- <csv dir> [--reset]` | One-time Airtable backfill from the CSV exports |
| `npm run user:password -- <email>` | Create or reset a login (prompts for the password) |

Logins are email + password, created by an admin on the Staff page.
