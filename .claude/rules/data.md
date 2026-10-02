---
paths:
  - "supabase/**"
  - "scripts/**"
  - "src/lib/data.ts"
---

# Data and migrations

<!-- added 2026-10-02: initial setup -->
- The only database is production. Ask Malcolm before `npm run db:migrate`, `npm run db:import`, or any write script.
<!-- added 2026-10-02: initial setup -->
- New schema = new numbered migration; never edit an applied one. Keep each migration self-contained and safe to run inside a transaction.
<!-- added 2026-10-02: initial setup -->
- New tables get RLS enabled in the same migration, with read policies scoped via `(select public.my_staff_id())` / `(select public.is_admin())`.
<!-- added 2026-10-02: initial setup -->
- New functions: `security definer set search_path = public`, `revoke … from public, anon`, `grant … to authenticated`.
<!-- added 2026-10-02: initial setup -->
- Temporary scripts that touch data go in `scripts/.tmp-*.mts` and are deleted after running.
