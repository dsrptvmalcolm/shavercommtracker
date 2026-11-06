"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/(app)/admin/actions";
import { assertNotImpersonating, canPost, requireMe } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const postedSchema = z.object({ vehicleId: z.uuid(), posted: z.boolean() });

/** Porters and admins mark a car posted / not posted on Marketplace. `set_vehicle_posted` re-checks the role. */
export async function setVehiclePosted(vehicleId: string, posted: boolean): Promise<ActionState> {
  const blocked = await assertNotImpersonating();
  if (blocked) return { error: blocked };
  if (!canPost(await requireMe())) return { error: "Only porters and admins can change posted status" };
  const parsed = postedSchema.safeParse({ vehicleId, posted });
  if (!parsed.success) return { error: "That car couldn't be found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_posted", { p_vehicle_id: parsed.data.vehicleId, p_posted: parsed.data.posted });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: posted ? "Marked posted" : "Marked not posted" };
}

/**
 * Dismiss one of your Marketplace alerts. Dismissing a "sold" alert also marks the car not posted.
 * `dismiss_inventory_alert` re-checks that the alert is yours (or that you're an admin).
 */
export async function dismissInventoryAlert(alertId: string): Promise<ActionState> {
  const blocked = await assertNotImpersonating();
  if (blocked) return { error: blocked };
  if (!canPost(await requireMe())) return { error: "Only porters and admins have alerts" };
  const parsed = z.uuid().safeParse(alertId);
  if (!parsed.success) return { error: "That alert couldn't be found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_inventory_alert", { p_alert_id: parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Dismissed" };
}
