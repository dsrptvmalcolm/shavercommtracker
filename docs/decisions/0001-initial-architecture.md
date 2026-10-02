# 0001 — Initial architecture

**Date:** 2026-10-02
**Status:** Accepted

## Context
Shaver Preferred Motors tracked commission in Airtable with formula fields that had drifted (multi-lingual spiffs never reached monthly totals; mislinked "Sales Day" records skipped 2-car day spiffs). The goal was a simple, reliable V1 where salespeople log deals and see their commission, admins control settings, and Jan–Sep 2026 history is preserved exactly as paid. It must live at team.shavercars.com.

## Decision
- **Next.js 16 App Router on Vercel**, deployed on every push to `main`. No PR flow, no CI — local checks (`scripts/verify.sh` + commit hook) are the gate.
- **Supabase Postgres + Auth** provisioned through the Vercel Marketplace. One database (production).
- **Commission math as pure TypeScript** (`src/lib/commission/engine.ts`) computed on read, not stored. Parity-tested against every 2026 Airtable deal and month.
- **Authorization in Postgres:** RLS for reads; deal writes only through security-definer functions (`save_deal`, `delete_deal`, `set_deal_gross`) that enforce ownership and the closed-month lock.
- **History stored as paid:** Airtable monthly totals live in `paid_months` and are shown as-is; recalculations are admin-only notes.
- **Settings versioned by month** (`commission_settings.effective_month`); product spiffs snapshotted per deal.
- **Email + password login**, set by admins, with a forced change on first sign-in (Supabase's default email only reaches project members, so magic links would need SMTP).
- **Months in America/Chicago; pacing on selling days** (Mon–Sat minus an admin-managed `holidays` table).
- **Admin impersonation** ("View as") is render-only via a cookie; all writes blocked while active.

## Alternatives rejected
- Store computed commission in the database — risks drift like Airtable's rollups; recompute is cheap at ~90 deals/month.
- Prisma/ORM — the access rules live in SQL functions and RLS; supabase-js + plain SQL migrations keep one source of truth.
- Magic-link auth — needs a custom SMTP provider first.
- Enforce permissions only in server actions — direct API access would bypass it.

## Consequences
- Rule changes are code changes with tests, not admin settings (only amounts/tiers are settings).
- Every schema change is a hand-written migration applied to production; RLS must be checked after each one.
- Pages run several queries per load; performance relies on RLS initplans, rollup functions and the client router cache.
