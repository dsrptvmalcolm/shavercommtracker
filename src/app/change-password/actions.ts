"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error?: string };

const schema = z
  .object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match", path: ["confirm"] });

export async function changePassword(_: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error: error.code === "same_password" ? "Pick a password different from the temporary one." : error.message,
    };
  }
  const { error: flagError } = await supabase.rpc("clear_my_password_flag");
  if (flagError) return { error: flagError.message };
  redirect("/");
}
