"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/(app)/admin/actions";
import { assertNotImpersonating, requirePoster } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ vehicleId: z.uuid(), posted: z.boolean() });

/** Porters and admins mark a car posted / not posted on Marketplace. `set_vehicle_posted` re-checks the role. */
export async function setVehiclePosted(vehicleId: string, posted: boolean): Promise<ActionState> {
  const blocked = await assertNotImpersonating();
  if (blocked) return { error: blocked };
  await requirePoster();
  const parsed = schema.safeParse({ vehicleId, posted });
  if (!parsed.success) return { error: "That car couldn't be found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_posted", { p_vehicle_id: parsed.data.vehicleId, p_posted: parsed.data.posted });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: posted ? "Marked posted" : "Marked not posted" };
}
