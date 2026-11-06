import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFeed, toIngestPayload } from "./parse-feed";

export type IngestResult = {
  status: "ok" | "failed" | "stopped";
  added: number;
  updated: number;
  price_changes: number;
  removed: number;
  returned: number;
  message: string | null;
};

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Downloads the feed, parses it and applies it through `ingest_inventory` (one transaction, logged in
 * `inventory_runs`). `client` is the admin's session client (Refresh now) or the service-role client
 * (daily cron — see docs/decisions/0003). Error messages never include the feed URL: it holds the dealer key.
 */
export const runIngest = async (client: SupabaseClient, { force }: { force: boolean }): Promise<IngestResult> => {
  const record = async (args: { p_rows: unknown; p_force?: boolean; p_error?: string; p_rejected?: number }) => {
    const { data, error } = await client.rpc("ingest_inventory", { p_force: false, p_rejected: 0, ...args });
    if (error) throw new Error(`Inventory update failed: ${error.message}`);
    return data as IngestResult;
  };

  const { data: feed, error } = await client.from("inventory_feed").select("url").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Couldn't read the feed settings: ${error.message}`);
  if (!feed?.url) return record({ p_rows: null, p_error: "No feed URL set" });

  let csv: string;
  try {
    const res = await fetch(feed.url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return record({ p_rows: null, p_error: `Feed download failed (HTTP ${res.status})` });
    csv = await res.text();
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network error";
    return record({ p_rows: null, p_error: `Feed download failed (${reason})` });
  }

  const { vehicles, rejected } = parseFeed(csv);
  if (vehicles.length === 0) {
    const why = rejected[0]?.reason ? ` — ${rejected[0].reason.slice(0, 120)}` : "";
    return record({ p_rows: null, p_error: `Feed had no readable vehicles${why}`, p_rejected: rejected.length });
  }
  try {
    return await record({ p_rows: toIngestPayload(vehicles), p_force: force, p_rejected: rejected.length });
  } catch (err) {
    // A database error rolls back the whole call, including its run-log row — log the failure separately
    // so Settings shows why the inventory stopped updating. Postgres messages never contain the feed URL.
    const reason = (err as Error).message.replace(/^Inventory update failed: /, "").slice(0, 200);
    return record({ p_rows: null, p_error: `Couldn't apply the feed: ${reason}`, p_rejected: rejected.length });
  }
};
