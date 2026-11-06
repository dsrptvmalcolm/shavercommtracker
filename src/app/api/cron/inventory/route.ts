import { timingSafeEqual } from "node:crypto";
import { runIngest } from "@/lib/inventory/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily inventory refresh, called by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
// The one approved use of the service-role client outside login management — see docs/decisions/0003.
const authorized = (header: string | null, secret: string | undefined): boolean => {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const r = await runIngest(createAdminClient(), { force: false });
    return Response.json({
      status: r.status,
      added: r.added,
      updated: r.updated,
      price_changes: r.price_changes,
      removed: r.removed,
      returned: r.returned,
    });
  } catch (err) {
    // runIngest's messages are built from fixed text and Postgres errors — never the feed URL
    console.error("inventory cron failed:", (err as Error).message);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
