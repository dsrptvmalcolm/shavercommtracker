# Database (Supabase Postgres)

There is one database and it is production. `npm run db:migrate` applies pending files in `migrations/` in order and records them in `public._migrations`.

## Key files
- `migrations/0001_init.sql` — tables (staff, commission_settings, products, deals, deal_products, adjustments, paid_months), helpers (`my_staff_id`, `is_admin`, `month_start`, `store_units`), deal write functions, RLS.
- `0003` — NULL-safe ownership checks in `save_deal`/`delete_deal`.
- `0004` — RLS helpers wrapped in `(select …)` + `units_by_month()`.
- `0005` — `store_units_by_month()`. `0006` — holidays, `must_change_password`, `clear_my_password_flag()`.

## Local conventions
<!-- added 2026-10-02: initial setup -->
- Never edit an applied migration; add the next number. Migrations run inside a transaction.
<!-- added 2026-10-02: initial setup -->
- Deal writes only via `save_deal` / `delete_deal` / `set_deal_gross` (security definer). Tables expose SELECT policies to non-admins, never write policies.
<!-- added 2026-10-02: initial setup -->
- Wrap auth helpers in policies as `(select public.is_admin())` so they run once per query.
<!-- added 2026-10-02: initial setup -->
- Compare nullable ownership with `IS DISTINCT FROM` (house deals have no salesperson).
<!-- added 2026-10-02: initial setup -->
- After a migration, verify RLS as a salesperson: `set local role authenticated; select set_config('request.jwt.claims', '{"email":"…"}', true);` inside a rolled-back transaction.
