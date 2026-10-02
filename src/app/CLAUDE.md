# App routes

## Key files
- `(app)/layout.tsx` — auth gate: resolves the viewer, forces `/change-password` when `must_change_password`, renders `AppShell`.
- `(app)/dashboard` — salesperson month view (admins can pass `?staff=`). `(app)/history` — month table.
- `(app)/deals/{new,[id]}` + `deals/deal-form.tsx` + `deals/actions.ts` — the one deal form for salespeople and admins.
- `(app)/admin/*` — Store, Deals (inline back gross), Spiffs, Staff, Settings (tiers, holidays, products). All admin mutations are in `admin/actions.ts`.
- `(app)/view-as-actions.ts` — start/stop impersonation (read only).
- `login/`, `change-password/` — outside the app shell.
- `../proxy.ts` — session refresh + redirect signed-out users to `/login`.

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Server actions validate input with zod and return `{ error }` / `{ ok }` for `ActionForm`/`useActionState`; call `revalidatePath("/", "layout")` after writes.
<!-- added 2026-10-02: initial setup -->
- Every write path calls `assertNotImpersonating()` (deal actions) or `requireAdmin()` (admin actions).
<!-- added 2026-10-02: initial setup -->
- `params`, `searchParams` and `cookies()` are async in Next.js 16 — await them.

## Where things live
- Generic admin form with inline feedback: `src/components/action-form.tsx`.
- Month switching: `src/components/month-nav.tsx` (keeps other query params).
