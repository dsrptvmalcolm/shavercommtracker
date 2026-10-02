// One-time backfill from the Airtable CSV exports.
// Usage: npm run db:import -- <dir with CSVs> [--reset]
//
// - Joey Golub's deals become house deals (they count toward store volume only)
// - Monthly Airtable totals are stored in paid_months exactly as paid
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { createDbClient } from "./db";

const HOUSE_STAFF = "Joey Golub";

type Row = Record<string, string>;

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--")) ?? join(homedir(), "Downloads");
const reset = args.includes("--reset");

const readCsv = async (file: string): Promise<Row[]> =>
  parse(await readFile(join(dir, file), "utf8"), { columns: true, bom: true, skip_empty_lines: true });

const clean = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
const checked = (s: string | undefined): boolean => clean(s) !== "";
const money = (s: string | undefined): number | null => {
  const v = clean(s).replace(/[$,]/g, "");
  return v === "" ? null : Number(v);
};
const isoDate = (mdy: string): string => {
  const [m, d, y] = clean(mdy).split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

const PRODUCTS: { column: string; name: string; settingsColumn: string }[] = [
  { column: "LoJack - Standard", name: "LoJack - Standard", settingsColumn: "Product: LoJack - Standard Spiff" },
  { column: "Wheel Locks - Standard", name: "Wheel Locks - Standard", settingsColumn: "Product: Wheel Locks - Standard Spiff" },
  { column: "Multi-Guard", name: "Multi-Guard", settingsColumn: "Product: Multi-Guard Spiff" },
  { column: "LoJack - Upsell", name: "LoJack - Upsell", settingsColumn: "Product: LoJack - Upsell Spiff" },
];

const main = async () => {
  const [settingsRows, staffRows, dealRows, monthRows] = await Promise.all([
    readCsv("Commission Tracker - Settings-Grid view.csv"),
    readCsv("Staff-Grid view.csv"),
    readCsv("Deals-Sandbox.csv"),
    readCsv("Salesperson Months-Sandbox.csv"),
  ]);
  const s = settingsRows[0];

  const db = await createDbClient();
  await db.query("begin");
  try {
    const existing = (await db.query("select count(*)::int as n from public.deals")).rows[0].n as number;
    if (existing > 0 && !reset) throw new Error(`${existing} deals already exist — rerun with --reset to replace`);
    if (reset) {
      await db.query(
        "truncate public.deal_products, public.deals, public.paid_months, public.adjustments, public.products, public.commission_settings, public.staff cascade",
      );
    }

    // Settings — unchanged all of 2026, so one version effective from January
    await db.query(
      `insert into public.commission_settings (effective_month, mini_tiers, front_pct, back_pct, product_hat_trick_bonus,
         two_car_day_spiff, hat_trick_day_spiff, multilingual_spiff, ninety_day_spiff, personal_best_spiff, store_volume_tiers)
       values ('2026-01', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        JSON.stringify([1, 2, 3].map((n) => ({
          startUnits: Number(s[`Mini Tier ${n} Start Units`]),
          amount: money(s[`Mini Tier ${n} Amount`]),
        }))),
        Number(s["Front Commission Percent"]),
        Number(s["Back Commission Percent"]),
        money(s["Product Hat Trick Bonus"]),
        money(s["Vehicle 2 Car Day Spiff"]),
        money(s["Vehicle Hat Trick Spiff"]),
        money(s["Multi-Lingual Spiff"]),
        money(s["90 Day+ Unit Spiff Amount"]),
        money(s["Personal Best Spiff"]),
        JSON.stringify([1, 2, 3, 4].map((n) => ({
          units: Number(s[`Store Volume Tier ${n} Units`]),
          amount: money(s[`Store Volume Tier ${n} Amount`]),
        }))),
      ],
    );

    const productIds = new Map<string, { id: string; spiff: number }>();
    for (const [i, p] of PRODUCTS.entries()) {
      const spiff = money(s[p.settingsColumn]) ?? 0;
      const { rows } = await db.query(
        "insert into public.products (name, spiff_amount, sort_order) values ($1, $2, $3) returning id",
        [p.name, spiff, i],
      );
      productIds.set(p.column, { id: rows[0].id, spiff });
    }

    // Staff — salespeople plus admins. Logins are added later by email.
    const staffIds = new Map<string, string>();
    const people = staffRows
      .map((r) => ({ name: clean(r["Name"]), role: clean(r["Role"]), r }))
      .filter((p) => p.role === "Sales" || p.name === HOUSE_STAFF || p.name === "Malcolm Heath" || p.name === "Mickey Shaver");
    for (const p of people) {
      const isSalesperson = p.role === "Sales";
      const { rows } = await db.query(
        `insert into public.staff (name, email, is_salesperson, is_admin, multilingual_eligible, active, personal_best_units)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [
          p.name,
          p.name === "Malcolm Heath" ? "malcolm@dsrptv.digital" : null,
          isSalesperson,
          !isSalesperson,
          checked(p.r["Multi-Lingual Eligible?"]),
          checked(p.r["Active?"]),
          // Baseline stays 0 — the app takes the best month on record, so 2026 history already counts
          0,
        ],
      );
      staffIds.set(p.name, rows[0].id);
    }

    let dealCount = 0;
    for (const d of dealRows) {
      const sp = clean(d["Salesperson"]);
      const isHouse = sp === HOUSE_STAFF;
      const spId = staffIds.get(sp);
      if (!spId) throw new Error(`Unknown salesperson "${sp}" on ${clean(d["Name"])}`);
      const { rows } = await db.query(
        `insert into public.deals (sale_date, customer_name, stock_number, deal_number, deal_notes, salesperson_id,
           is_house, front_gross, back_gross, multilingual, ninety_day, airtable_name, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
        [
          isoDate(d["Sale Date"]),
          clean(d["Customer Name"]),
          clean(d["Stock Number"]).toUpperCase(),
          clean(d["Deal Number"]) || null,
          clean(d["Deal Notes"]) || null,
          isHouse ? null : spId,
          isHouse,
          money(d["Front Gross"]),
          money(d["Back Gross"]),
          checked(d["Multi-Lingual Sold?"]),
          checked(d["90 Day+ Unit Eligible?"]),
          clean(d["Name"]),
          isHouse ? spId : null,
        ],
      );
      for (const p of PRODUCTS.filter((p) => checked(d[p.column]))) {
        const prod = productIds.get(p.column)!;
        await db.query("insert into public.deal_products (deal_id, product_id, spiff_amount) values ($1, $2, $3)", [
          rows[0].id,
          prod.id,
          prod.spiff,
        ]);
      }
      dealCount++;
    }

    let monthCount = 0;
    for (const m of monthRows.filter((r) => clean(r["Salesperson"]) !== HOUSE_STAFF)) {
      await db.query(
        `insert into public.paid_months (staff_id, month, units, mini_rate, vehicle_commission, product_spiffs,
           ninety_day_spiffs, two_car_day_count, two_car_day_spiffs, hat_trick_day_count, hat_trick_day_spiffs,
           personal_best_spiff, store_volume_spiff, total, note)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          staffIds.get(clean(m["Salesperson"])),
          clean(m["Month Label (from Month)"]),
          Number(m["Units Sold"]),
          money(m["Mini Rate (This Month)"]),
          money(m["Total Commission (Deals Only)"]),
          money(m["Total Product Commission"]),
          money(m["90 Day+ Unit Spiff Rollup (from Deals)"]),
          Number(m["2 Car Day Count"]),
          money(m["2 Car Day Spiff Total"]),
          Number(m["Hat Trick Day Count"]),
          money(m["Hat Trick Spiff Total"]),
          money(m["Personal Best Spiff Total"]),
          money(m["Store Volume Spiff Amount"]),
          money(m["Total Commission w/ Spiffs"]),
          "Imported from Airtable as paid",
        ],
      );
      monthCount++;
    }

    await db.query("commit");
    console.log(`imported ${people.length} staff, ${PRODUCTS.length} products, ${dealCount} deals, ${monthCount} paid months`);
  } catch (err) {
    await db.query("rollback");
    throw err;
  } finally {
    await db.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
