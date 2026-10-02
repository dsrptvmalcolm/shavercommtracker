@AGENTS.md

# Shaver Team — Commission Tracker

Deal log and commission tracker for Shaver Preferred Motors (independent used-car dealer, Merrillville IN), live at team.shavercars.com. Salespeople log deals and see their commission; admins enter back gross, manage spiffs, staff, settings and holidays. Replaced an Airtable base; Jan–Sep 2026 history was imported as paid. Owner: Malcolm Heath (non-technical PM — explain decisions in plain terms).

**Stack:** Next.js 16 App Router (Turbopack) · React 19 · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth, via Vercel Marketplace) · Vercel (deploys on push to `main`) · Vitest · zod.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Env vars | `vercel env pull .env.local` |
| Run | `npm run dev` |
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Test | `npm test` |
| All checks | `scripts/verify.sh` (typecheck → lint → test, stops on first failure) |
| DB migrate | `npm run db:migrate` — applies new `supabase/migrations/*.sql` **to production**; ask first |
| Set a login password | `npm run user:password -- <email>` (prompts, hidden input) |
| QA test logins | `npm run qa:accounts -- create <env-file>` / `-- delete` (production DB — ask first, always delete) |
| Mobile audit | `npm run audit:mobile` against a running build — see `audit/MOBILE_AUDIT.md` → Handoff |

There is no CI and no PR flow: work is committed to `main` and Vercel deploys it. Local checks are the only gate.

## Architecture

All commission math is pure functions in `src/lib/commission/engine.ts`, tested against every 2026 Airtable deal. `src/lib/data.ts` is the only server data layer: it loads rows through Supabase (RLS enforced) and feeds the engine. Pages in `src/app/(app)/` are server components; mutations are server actions that call Postgres functions (`save_deal`, `delete_deal`, `set_deal_gross`) where access rules are enforced. Months are `YYYY-MM` in America/Chicago; pacing uses selling days (Mon–Sat minus admin-managed holidays). Decisions: `docs/decisions/`. Module details: the CLAUDE.md in each folder below.

## Non-negotiable conventions

<!-- added 2026-10-02: initial setup -->
- Commission rules live only in `src/lib/commission/engine.ts`. Pages and SQL never re-implement them.
<!-- added 2026-10-02: initial setup -->
- Authorization lives in Postgres (RLS + security-definer functions). UI hiding is never the only guard.
<!-- added 2026-10-02: initial setup -->
- Every server action re-checks the viewer (`requireMe` / `requireAdmin` / `assertNotImpersonating`) — actions are reachable by direct POST.
<!-- added 2026-10-02: initial setup -->
- Schema changes are new numbered files in `supabase/migrations/`; never edit an applied migration.
<!-- added 2026-10-02: initial setup -->
- Named exports only (default exports only where Next.js requires them: page, layout, loading). kebab-case files, PascalCase components.
<!-- added 2026-10-02: initial setup -->
- Use the design tokens/utilities in `src/app/globals.css` (`card`, `btn-primary`, `display`, `eyebrow`, …); no new hex colors in components except chart strokes.
<!-- added 2026-10-02: initial setup -->
- Next.js 16 differs from training data (`proxy.ts` not middleware, async `params`/`searchParams`/`cookies`). Check `node_modules/next/dist/docs/` before using an API you're unsure of.

## Definition of done

<!-- added 2026-10-02: initial setup -->
A task is done only when the `verify` skill passes **and** the affected flow has been exercised (browser for UI, SQL/RLS check for database changes). Show the verification output; never report work as done without it. A hook blocks `git commit` when `scripts/verify.sh` fails.

## Working rules

<!-- added 2026-10-02: initial setup -->
- **Reuse:** before creating any function, component, file or helper, search for an existing one (see "Where things live") and reuse or extend it. Justify every new file.
<!-- added 2026-10-02: initial setup -->
- **Scope:** change only what the task requires; don't refactor unrelated code.
<!-- added 2026-10-02: initial setup -->
- **Test integrity:** never change an existing test's expected results to make it pass. If a test seems wrong, stop and explain why. (A hook blocks edits to existing test files; Malcolm unlocks by creating `.claude/allow-test-edits`.)
<!-- added 2026-10-02: initial setup -->
- **Decisions:** check `docs/decisions/` before changing architecture; don't reverse a recorded decision without asking.
<!-- added 2026-10-02: initial setup -->
- **Commits:** never commit or push without Malcolm's confirmation. "Commit and push" = commit to `main` + push (deploys). Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `perf:`).
<!-- added 2026-10-02: initial setup -->
- **Test data:** QA logins use `@shaver.test` emails and are deleted after testing. Never put real customer data in tests, fixtures or commits.
<!-- added 2026-10-02: initial setup -->
- **Tasks:** multi-step work gets `dev/active/<task>/` via the `new-task` skill; run `save-progress` before ending a session and read those files first when resuming.

<!-- added 2026-10-02: initial setup -->
When compacting, always preserve the full list of modified files, the current task's `dev/active/` path, and the test commands.

## Where things live

| Need | Look in |
|---|---|
| Commission math, types, parity fixtures | `src/lib/commission/` → its CLAUDE.md |
| Data loading, viewer/auth, months & working days, formatting | `src/lib/` → its CLAUDE.md |
| Pages, server actions, impersonation | `src/app/` → its CLAUDE.md |
| UI building blocks, charts | `src/components/` → its CLAUDE.md |
| Schema, RLS, deal write functions | `supabase/` → its CLAUDE.md |
| One-off scripts (migrate, Airtable import, passwords) | `scripts/` |
| Topic rules (testing, data, security, domain) | `.claude/rules/` |
| Architecture decisions | `docs/decisions/` |
| Maintaining this config | `docs/claude-maintenance.md` |
| Mobile audit report, fix status, how to re-run | `audit/MOBILE_AUDIT.md` |
| Design reference (Stitch export) | `stitch_auto_commission_tracker/` |
