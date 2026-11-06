import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Only for admin-verified server actions (login management) and the
 * daily inventory cron (`/api/cron/inventory`, after its CRON_SECRET check) — see docs/decisions/0003.
 */
export const createAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
