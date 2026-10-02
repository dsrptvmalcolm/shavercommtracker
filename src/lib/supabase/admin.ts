import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client — bypasses RLS. Only for admin-verified server actions (login management). */
export const createAdminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
