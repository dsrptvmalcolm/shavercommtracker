# 0003 — Daily inventory refresh uses the service role

**Date:** 2026-11-06
**Status:** Accepted (approved by Malcolm)

## Context
The Inventory tab ingests the VinCue feed once a day so Marketplace sold/price alerts reach the Porter the same day. The refresh runs from Vercel Cron, with no signed-in user, so RLS and the security-definer functions have no staff identity to authorize. Until now the service-role client was only allowed for login management.

## Decision
- `/api/cron/inventory` (scheduled in `vercel.json`) checks `Authorization: Bearer $CRON_SECRET` and, only then, uses the service-role client.
- It may do exactly two things: read `inventory_feed.url` and call `ingest_inventory()`. `ingest_inventory` accepts admins or the `service_role` JWT role and is granted to `authenticated` and `service_role` only.
- The route's response and error messages never include the feed URL (it carries the dealer key).
- Admins run the same code path from Settings → Refresh now with their own session.

## Alternatives rejected
- Manual-only refresh (an admin taps Refresh now daily) — same-day sold alerts would depend on someone remembering.
- `pg_cron` + `pg_net` fetching and parsing the CSV inside Postgres — CSV parsing in SQL is fragile and untestable compared with the tested TypeScript parser.

## Consequences
- `.claude/rules/security.md` names this as the single exception to "service role only for login management".
- `CRON_SECRET` must be set in the Vercel project (Production). Without it the route always returns 401 and only manual refreshes happen.
- Any new use of the service-role client still needs its own decision.
