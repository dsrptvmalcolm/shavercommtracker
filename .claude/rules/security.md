---
paths:
  - "src/app/**/actions.ts"
  - "src/app/**/*-actions.ts"
  - "src/lib/supabase/**"
  - "src/lib/data.ts"
  - "src/proxy.ts"
  - "supabase/**"
  - "scripts/**"
---

# Security

<!-- added 2026-10-02: initial setup -->
- Never read, print or commit `.env*` values or service-role keys; scripts load them with `--env-file=.env.local`.
<!-- added 2026-10-02: initial setup -->
- The service-role client (`src/lib/supabase/admin.ts`) is only for auth admin calls after `requireAdmin()`; never use it to read business data.
<!-- added 2026-10-02: initial setup -->
- Validate every server action input with zod; never trust hidden form fields (e.g. salesperson id) — the Postgres functions re-derive ownership.
<!-- added 2026-10-02: initial setup -->
- Impersonation is read only: writes must call `assertNotImpersonating()`; the view-as cookie is honored only for real admins.
<!-- added 2026-10-02: initial setup -->
- Passwords: never type real user passwords into tools or chat; prompts for passwords must hide input.
