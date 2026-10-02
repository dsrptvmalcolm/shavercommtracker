"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAllStaff, requireAdmin } from "@/lib/data";
import { currentMonth } from "@/lib/months";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: string };

const moneyStr = z
  .string()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => v !== "" && !Number.isNaN(Number(v)), "Enter a number")
  .transform(Number);
const optionalMoneyStr = z
  .string()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a number")
  .transform((v) => (v === "" ? null : Number(v)));
const checkbox = z.literal("on").optional().transform((v) => v === "on");
const month = z.string().regex(/^\d{4}-\d{2}$/);

const done = (msg: string): ActionState => {
  revalidatePath("/", "layout");
  return { ok: msg };
};

// Deals ---------------------------------------------------------------------

export async function setBackGross(dealId: string, value: string): Promise<ActionState> {
  await requireAdmin();
  const parsed = optionalMoneyStr.safeParse(value);
  if (!parsed.success) return { error: "Enter a dollar amount" };
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("front_gross").eq("id", dealId).single();
  const { error } = await supabase.rpc("set_deal_gross", {
    p_id: dealId,
    p_back: parsed.data,
    p_front: deal?.front_gross ?? null,
  });
  if (error) return { error: error.message };
  return done("Saved");
}

// Spiffs --------------------------------------------------------------------

const adjustmentSchema = z.object({
  staff_id: z.string().min(1, "Pick who gets it"),
  month,
  amount: moneyStr,
  note: z.string().trim().min(1, "Add a note so the team knows what it's for"),
});

export async function addAdjustment(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { staff_id, ...rest } = parsed.data;

  // "team" = every active salesperson gets the same spiff
  const staff = await getAllStaff();
  const recipients = staff_id === "team" ? staff.filter((s) => s.is_salesperson && s.active).map((s) => s.id) : [staff_id];
  const supabase = await createClient();
  const { error } = await supabase
    .from("adjustments")
    .insert(recipients.map((id) => ({ ...rest, staff_id: id, created_by: me.id })));
  if (error) return { error: error.message };
  return done(recipients.length > 1 ? `Added for ${recipients.length} salespeople` : "Spiff added");
}

export async function deleteAdjustment(id: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("adjustments").delete().eq("id", id);
  if (error) return { error: error.message };
  return done("Removed");
}

// Staff ---------------------------------------------------------------------

const staffSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  is_salesperson: checkbox,
  is_admin: checkbox,
  multilingual_eligible: checkbox,
  active: checkbox,
  personal_best_units: moneyStr,
  password: z.string().optional(),
});

/** Creates or updates the Supabase login for a staff email. */
const syncLogin = async (email: string, password: string | undefined): Promise<string | undefined> => {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return error.message;
  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (!password) return;
    const res = await admin.auth.admin.updateUserById(existing.id, { password });
    return res.error?.message;
  }
  if (!password) return;
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  return res.error?.message;
};

export async function saveStaff(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, password, ...row } = parsed.data;
  if (password && password.length < 8) return { error: "Passwords need at least 8 characters" };
  if (password && !row.email) return { error: "Add an email before setting a password" };

  const supabase = await createClient();
  // An admin-assigned password is temporary — they pick their own at next sign-in
  const values = { ...row, email: row.email || null, ...(password ? { must_change_password: true } : {}) };
  const { error } = id
    ? await supabase.from("staff").update(values).eq("id", id)
    : await supabase.from("staff").insert(values);
  if (error) return { error: error.code === "23505" ? "That email is already on another staff member" : error.message };

  if (row.email) {
    const loginError = await syncLogin(row.email, password || undefined);
    if (loginError) return { error: `Saved, but the login couldn't be updated: ${loginError}` };
  }
  return done(password ? "Saved — they'll set their own password at next sign-in" : "Saved");
}

// Settings ------------------------------------------------------------------

const tierPairs = (formData: FormData, a: string, b: string) =>
  formData
    .getAll(a)
    .map((v, i) => [String(v).replace(/[$,\s]/g, ""), String(formData.getAll(b)[i] ?? "").replace(/[$,\s]/g, "")])
    .filter(([x, y]) => x !== "" && y !== "")
    .map(([x, y]) => [Number(x), Number(y)] as const);

const settingsSchema = z.object({
  front_pct: moneyStr,
  back_pct: moneyStr,
  product_hat_trick_bonus: moneyStr,
  two_car_day_spiff: moneyStr,
  hat_trick_day_spiff: moneyStr,
  multilingual_spiff: moneyStr,
  ninety_day_spiff: moneyStr,
  personal_best_spiff: moneyStr,
});

/** Saves settings effective from the current month — closed months keep their rates. */
export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const mini = tierPairs(formData, "mini_start", "mini_amount");
  const store = tierPairs(formData, "store_units", "store_amount");
  if (mini.length === 0) return { error: "Add at least one mini tier" };
  if (mini.some(([u, a]) => Number.isNaN(u) || Number.isNaN(a)) || store.some(([u, a]) => Number.isNaN(u) || Number.isNaN(a))) {
    return { error: "Tier values must be numbers" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("commission_settings").upsert({
    effective_month: currentMonth(),
    ...parsed.data,
    // Percent fields are entered as whole percents (1 = 1%)
    front_pct: parsed.data.front_pct / 100,
    back_pct: parsed.data.back_pct / 100,
    mini_tiers: mini.map(([startUnits, amount]) => ({ startUnits, amount })).sort((x, y) => x.startUnits - y.startUnits),
    store_volume_tiers: store.map(([units, amount]) => ({ units, amount })).sort((x, y) => x.units - y.units),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  return done(`Settings saved — effective ${currentMonth()} onward`);
}

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Product name is required"),
  spiff_amount: moneyStr,
  active: checkbox,
  sort_order: z.coerce.number().int().default(0),
});

export async function saveProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert(row);
  if (error) return { error: error.code === "23505" ? "A product with that name already exists" : error.message };
  return done(id ? "Product saved" : "Product added");
}

// Holidays ------------------------------------------------------------------

const holidaySchema = z.object({
  date: z.iso.date("Pick a date"),
  name: z.string().trim().min(1, "Name the holiday"),
});

export async function addHoliday(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").upsert(parsed.data);
  if (error) return { error: error.message };
  return done("Holiday saved");
}

export async function deleteHoliday(date: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("date", date);
  if (error) return { error: error.message };
  return done("Removed");
}
