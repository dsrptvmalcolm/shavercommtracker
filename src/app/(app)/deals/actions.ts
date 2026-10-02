"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMe } from "@/lib/data";
import { monthOf } from "@/lib/months";
import { createClient } from "@/lib/supabase/server";

export type DealFormState = { error?: string };

const optionalMoney = z
  .string()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a dollar amount")
  .transform((v) => (v === "" ? null : Number(v)));

const schema = z.object({
  id: z.string().optional(),
  sale_date: z.iso.date("Pick a sale date"),
  customer_name: z.string().trim().min(1, "Customer name is required"),
  stock_number: z.string().trim().min(1, "Stock number is required"),
  deal_number: z.string().trim().optional(),
  deal_notes: z.string().trim().optional(),
  salesperson_id: z.string().optional(),
  split_salesperson_id: z.string().optional(),
  is_house: z.literal("on").optional(),
  multilingual: z.literal("on").optional(),
  ninety_day: z.literal("on").optional(),
  back_gross: optionalMoney.optional(),
  front_gross: optionalMoney.optional(),
});

export async function saveDeal(_: DealFormState, formData: FormData): Promise<DealFormState> {
  const me = await requireMe();
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([k]) => k !== "product_ids")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const f = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_deal", {
    p: {
      id: f.id || null,
      sale_date: f.sale_date,
      customer_name: f.customer_name,
      stock_number: f.stock_number,
      deal_number: f.deal_number ?? "",
      deal_notes: f.deal_notes ?? "",
      salesperson_id: f.salesperson_id ?? "",
      split_salesperson_id: f.split_salesperson_id ?? "",
      is_house: f.is_house === "on",
      multilingual: f.multilingual === "on",
      ninety_day: f.ninety_day === "on",
      back_gross: f.back_gross ?? null,
      front_gross: f.front_gross ?? null,
      product_ids: formData.getAll("product_ids").map(String),
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  const month = monthOf(f.sale_date);
  redirect(me.is_admin ? `/admin/deals?month=${month}` : `/dashboard?month=${month}`);
}

export async function deleteDeal(id: string): Promise<DealFormState> {
  const me = await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_deal", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(me.is_admin ? "/admin/deals" : "/dashboard");
}
