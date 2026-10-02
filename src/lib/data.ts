import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { salespersonMonth, shareOf, storeUnitsFor } from "@/lib/commission/engine";
import type { CommissionSettings, DealInput, MonthSummary } from "@/lib/commission/types";
import { APP_TIMEZONE, monthOf, monthRange } from "@/lib/months";
import { createClient } from "@/lib/supabase/server";

export type Staff = {
  id: string;
  name: string;
  email: string | null;
  is_salesperson: boolean;
  is_admin: boolean;
  multilingual_eligible: boolean;
  active: boolean;
  personal_best_units: number;
  created_at: string;
};

export type Product = { id: string; name: string; spiff_amount: number; active: boolean; sort_order: number };

export type DealRow = {
  id: string;
  sale_date: string;
  customer_name: string;
  stock_number: string;
  deal_number: string | null;
  deal_notes: string | null;
  salesperson_id: string | null;
  split_salesperson_id: string | null;
  is_house: boolean;
  front_gross: number | null;
  back_gross: number | null;
  multilingual: boolean;
  ninety_day: boolean;
  deal_products: { product_id: string; spiff_amount: number }[];
};

export type PaidMonth = {
  staff_id: string;
  month: string;
  units: number;
  mini_rate: number;
  vehicle_commission: number;
  product_spiffs: number;
  multilingual_spiffs: number;
  ninety_day_spiffs: number;
  two_car_day_count: number;
  two_car_day_spiffs: number;
  hat_trick_day_count: number;
  hat_trick_day_spiffs: number;
  personal_best_spiff: number;
  store_volume_spiff: number;
  adjustments: number;
  total: number;
  note: string | null;
};

export type Adjustment = { id: string; staff_id: string; month: string; amount: number; note: string };

export type SettingsRow = {
  effective_month: string;
  mini_tiers: { startUnits: number; amount: number }[];
  front_pct: number;
  back_pct: number;
  product_hat_trick_bonus: number;
  two_car_day_spiff: number;
  hat_trick_day_spiff: number;
  multilingual_spiff: number;
  ninety_day_spiff: number;
  personal_best_spiff: number;
  store_volume_tiers: { units: number; amount: number }[];
};

const DEAL_SELECT =
  "id, sale_date, customer_name, stock_number, deal_number, deal_notes, salesperson_id, split_salesperson_id, is_house, front_gross, back_gross, multilingual, ninety_day, deal_products(product_id, spiff_amount)";

// Postgres numerics arrive as strings
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

const toStaff = (r: Record<string, unknown>): Staff => ({
  ...(r as Staff),
  personal_best_units: num(r.personal_best_units),
});

const toDeal = (r: Record<string, unknown>): DealRow => ({
  ...(r as DealRow),
  front_gross: numOrNull(r.front_gross),
  back_gross: numOrNull(r.back_gross),
  deal_products: ((r.deal_products as { product_id: string; spiff_amount: unknown }[]) ?? []).map((p) => ({
    product_id: p.product_id,
    spiff_amount: num(p.spiff_amount),
  })),
});

const toPaid = (r: Record<string, unknown>): PaidMonth =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, ["staff_id", "month", "note"].includes(k) ? v : num(v)]),
  ) as PaidMonth;

export const toDealInput = (d: DealRow): DealInput => ({
  id: d.id,
  saleDate: d.sale_date,
  salespersonId: d.salesperson_id,
  splitSalespersonId: d.split_salesperson_id,
  isHouse: d.is_house,
  frontGross: d.front_gross,
  backGross: d.back_gross,
  productSpiffs: d.deal_products.map((p) => p.spiff_amount),
  multilingual: d.multilingual,
  ninetyDay: d.ninety_day,
});

export const toEngineSettings = (s: SettingsRow): CommissionSettings => ({
  miniTiers: s.mini_tiers.map((t) => ({ startUnits: num(t.startUnits), amount: num(t.amount) })),
  frontPct: num(s.front_pct),
  backPct: num(s.back_pct),
  productHatTrickBonus: num(s.product_hat_trick_bonus),
  twoCarDaySpiff: num(s.two_car_day_spiff),
  hatTrickDaySpiff: num(s.hat_trick_day_spiff),
  multilingualSpiff: num(s.multilingual_spiff),
  ninetyDaySpiff: num(s.ninety_day_spiff),
  personalBestSpiff: num(s.personal_best_spiff),
  storeVolumeTiers: s.store_volume_tiers.map((t) => ({ units: num(t.units), amount: num(t.amount) })),
});

// Auth ----------------------------------------------------------------------

export const getMe = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email) return null;
  const { data: row } = await supabase.from("staff").select("*").ilike("email", email).eq("active", true).maybeSingle();
  return row ? toStaff(row) : null;
});

export const requireMe = async (): Promise<Staff> => {
  const me = await getMe();
  if (!me) redirect("/login?error=no-access");
  return me;
};

export const requireAdmin = async (): Promise<Staff> => {
  const me = await requireMe();
  if (!me.is_admin) redirect("/");
  return me;
};

// Reads ---------------------------------------------------------------------

export const getAllStaff = cache(async (): Promise<Staff[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff").select("*").order("name");
  if (error) throw error;
  return data.map(toStaff);
});

export const getProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data.map((p) => ({ ...p, spiff_amount: num(p.spiff_amount) }));
});

export const getSettingsRows = cache(async (): Promise<SettingsRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commission_settings").select("*").order("effective_month");
  if (error) throw error;
  return data as SettingsRow[];
});

/** The settings version in effect for a month (latest effective_month on or before it). */
export const getSettingsFor = async (month: string): Promise<SettingsRow> => {
  const rows = await getSettingsRows();
  const row = rows.filter((r) => r.effective_month <= month).at(-1) ?? rows[0];
  if (!row) throw new Error("No commission settings configured");
  return row;
};

export const getDeal = async (id: string): Promise<DealRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select(DEAL_SELECT).eq("id", id).maybeSingle();
  return data ? toDeal(data) : null;
};

/** Deals in a month that RLS lets the viewer see (all for admins, own for salespeople). */
export const getDealsForMonth = cache(async (month: string, staffId?: string): Promise<DealRow[]> => {
  const supabase = await createClient();
  const { start, end } = monthRange(month);
  let q = supabase.from("deals").select(DEAL_SELECT).gte("sale_date", start).lt("sale_date", end);
  if (staffId) q = q.or(`salesperson_id.eq.${staffId},split_salesperson_id.eq.${staffId}`);
  const { data, error } = await q.order("sale_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toDeal);
});

export const getStoreUnits = cache(async (month: string): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("store_units", { p_month: month });
  if (error) throw error;
  return data as number;
});

export const getAdjustments = cache(async (month: string): Promise<Adjustment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("adjustments").select("*").eq("month", month).order("created_at");
  if (error) throw error;
  return data.map((a) => ({ ...a, amount: num(a.amount) }));
});

export const getPaidMonths = cache(async (staffId?: string): Promise<PaidMonth[]> => {
  const supabase = await createClient();
  let q = supabase.from("paid_months").select("*");
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q.order("month");
  if (error) throw error;
  return data.map(toPaid);
});

/** Units per month for one salesperson, from paid history plus deals on record. */
export const getUnitsByMonth = cache(async (staffId: string): Promise<Map<string, number>> => {
  const supabase = await createClient();
  const [{ data, error }, paid] = await Promise.all([
    supabase
      .from("deals")
      .select("sale_date, salesperson_id, split_salesperson_id, is_house")
      .or(`salesperson_id.eq.${staffId},split_salesperson_id.eq.${staffId}`),
    getPaidMonths(staffId),
  ]);
  if (error) throw error;
  const fromDeals = data.reduce<Map<string, number>>((m, d) => {
    const share = shareOf(
      {
        id: "",
        saleDate: d.sale_date,
        salespersonId: d.salesperson_id,
        splitSalespersonId: d.split_salesperson_id,
        isHouse: d.is_house,
        frontGross: null,
        backGross: null,
        productSpiffs: [],
        multilingual: false,
        ninetyDay: false,
      },
      staffId,
    );
    return m.set(monthOf(d.sale_date), (m.get(monthOf(d.sale_date)) ?? 0) + share);
  }, new Map());
  // Paid months are the record for their month
  paid.forEach((p) => fromDeals.set(p.month, p.units));
  return fromDeals;
});

/** Best month before `month`: the manual baseline or any month on record, whichever is higher. */
export const priorBestUnits = (staff: Staff, unitsByMonth: Map<string, number>, month: string): number =>
  Math.max(
    staff.personal_best_units,
    ...[...unitsByMonth.entries()].filter(([m]) => m < month).map(([, u]) => u),
  );

/** Month a staff member was added, in the dealership's timezone. */
const startMonth = (staff: Staff): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit" }).format(new Date(staff.created_at));

/**
 * Whether a salesperson was on the team for a month — gates the store volume spiff,
 * which is paid even at zero units. Deals or a paid record always count.
 */
export const onTeamFor = (staff: Staff, month: string, hasRecord: boolean): boolean =>
  hasRecord || (staff.is_salesperson && staff.active && month >= startMonth(staff));

// Month views ---------------------------------------------------------------

export type SalespersonMonthView = {
  staff: Staff;
  month: string;
  summary: MonthSummary;
  paid: PaidMonth | null;
  deals: DealRow[];
  storeUnits: number;
  settings: SettingsRow;
  priorBest: number;
};

export const getSalespersonMonth = async (staff: Staff, month: string): Promise<SalespersonMonthView> => {
  const [settings, deals, storeUnits, adjustments, paid, unitsByMonth] = await Promise.all([
    getSettingsFor(month),
    getDealsForMonth(month, staff.id),
    getStoreUnits(month),
    getAdjustments(month),
    getPaidMonths(staff.id),
    getUnitsByMonth(staff.id),
  ]);
  const priorBest = priorBestUnits(staff, unitsByMonth, month);
  const paidMonth = paid.find((p) => p.month === month) ?? null;
  const onTeam = onTeamFor(staff, month, deals.length > 0 || paidMonth !== null);
  const summary = salespersonMonth({
    salesperson: { id: staff.id, multilingualEligible: staff.multilingual_eligible, priorBestUnits: priorBest },
    deals: deals.map(toDealInput),
    storeUnits: onTeam ? storeUnits : 0,
    adjustments: adjustments.map((a) => ({ staffId: a.staff_id, amount: a.amount, note: a.note })),
    settings: toEngineSettings(settings),
  });
  return {
    staff,
    month,
    summary,
    paid: paidMonth,
    deals,
    storeUnits,
    settings,
    priorBest,
  };
};

export type StoreMonthView = {
  month: string;
  deals: DealRow[];
  storeUnits: number;
  houseUnits: number;
  rows: { staff: Staff; summary: MonthSummary; paid: PaidMonth | null }[];
  settings: SettingsRow;
};

/** Admin view of the whole store for a month. */
export const getStoreMonth = async (month: string): Promise<StoreMonthView> => {
  const [settings, deals, staff, adjustments, paid] = await Promise.all([
    getSettingsFor(month),
    getDealsForMonth(month),
    getAllStaff(),
    getAdjustments(month),
    getPaidMonths(),
  ]);
  const inputs = deals.map(toDealInput);
  const storeUnits = storeUnitsFor(inputs);
  const onDeals = new Set(deals.flatMap((d) => [d.salesperson_id, d.split_salesperson_id]));
  const paidIds = new Set(paid.filter((p) => p.month === month).map((p) => p.staff_id));
  const salespeople = staff.filter((s) => onTeamFor(s, month, onDeals.has(s.id) || paidIds.has(s.id)));
  const unitMaps = await Promise.all(salespeople.map((s) => getUnitsByMonth(s.id)));
  const engineSettings = toEngineSettings(settings);

  const rows = salespeople.map((s, i) => ({
    staff: s,
    summary: salespersonMonth({
      salesperson: {
        id: s.id,
        multilingualEligible: s.multilingual_eligible,
        priorBestUnits: priorBestUnits(s, unitMaps[i], month),
      },
      deals: inputs,
      storeUnits,
      adjustments: adjustments.map((a) => ({ staffId: a.staff_id, amount: a.amount, note: a.note })),
      settings: engineSettings,
    }),
    paid: paid.find((p) => p.staff_id === s.id && p.month === month) ?? null,
  }));

  return {
    month,
    deals,
    storeUnits,
    houseUnits: deals.filter((d) => d.is_house).length,
    rows,
    settings,
  };
};
