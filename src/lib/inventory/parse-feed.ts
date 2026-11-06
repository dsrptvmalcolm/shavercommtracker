import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { FeedRejection, FeedVehicle } from "./types";

// Parses VinCue's Facebook inventory export (CSV). Pure: text in, typed rows out.

export const parsePrice = (field: string): number | null => {
  const n = Number.parseFloat(field.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Ranges keep impossible values from reaching Postgres, where one bad row would fail the whole refresh.
const MAX_MILEAGE = 2_000_000;
const MIN_YEAR = 1900;

const parseMileage = (field: string): number | null => {
  const n = Math.round(Number.parseFloat(field.replace(/[^0-9.]/g, "")));
  return Number.isFinite(n) && n >= 0 && n <= MAX_MILEAGE ? n : null;
};

const parseYear = (field: string): number | null => {
  const n = Number.parseInt(field.trim(), 10);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= new Date().getFullYear() + 1 ? n : null;
};

/** YYYY-MM-DD that is a real calendar date, else null */
const parseDate = (field: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(field)) return null;
  const d = new Date(`${field}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === field && d.getUTCFullYear() >= MIN_YEAR ? field : null;
};

/** `[{url:'https://…'},{url:'…'}]` (single quotes, unquoted keys) → URLs */
export const parseImages = (field: string): string[] =>
  [...field.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1].trim()).filter((u) => u.startsWith("http"));

/** `{addr1: '5701 Broadway', city: 'Merrillville', region: 'IN', postal_code: '46410', …}` → one line */
export const parseAddress = (field: string): string => {
  const get = (key: string) => field.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1]?.trim() ?? "";
  const street = get("addr1");
  const city = get("city");
  const regionZip = [get("region"), get("postal_code")].filter(Boolean).join(" ");
  return [street, city, regionZip].filter(Boolean).join(", ");
};

const rowSchema = z.object({
  vin: z.string().trim().min(11, "Missing VIN").max(17, "VIN too long"),
  stock_number: z.string().trim().min(1, "Missing stock number"),
});

const str = (row: Record<string, string>, key: string) => (row[key] ?? "").trim();

export const parseFeed = (csv: string): { vehicles: FeedVehicle[]; rejected: FeedRejection[] } => {
  let records: Record<string, string>[];
  try {
    records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  } catch (err) {
    return { vehicles: [], rejected: [{ line: 0, reason: `Feed isn't readable CSV: ${(err as Error).message}` }] };
  }

  const vehicles: FeedVehicle[] = [];
  const rejected: FeedRejection[] = [];
  records.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const check = rowSchema.safeParse({ vin: str(row, "vin"), stock_number: str(row, "stock_number") });
    if (!check.success) {
      rejected.push({ line, reason: check.error.issues[0]?.message ?? "Invalid row" });
      return;
    }
    const date = str(row, "date_first_on_lot");
    vehicles.push({
      vin: check.data.vin.toUpperCase(),
      stockNumber: check.data.stock_number.toUpperCase(),
      year: parseYear(str(row, "year")),
      make: str(row, "make"),
      model: str(row, "model"),
      trim: str(row, "trim"),
      bodyStyle: str(row, "body_style"),
      drivetrain: str(row, "drivetrain"),
      transmission: str(row, "transmission"),
      fuelType: str(row, "fuel_type"),
      mileage: parseMileage(str(row, "mileage.value")),
      price: parsePrice(str(row, "price")),
      exteriorColor: str(row, "exterior_color"),
      interiorColor: str(row, "interior_color"),
      url: str(row, "url"),
      images: parseImages(str(row, "image")),
      descriptionHtml: str(row, "description"),
      dealerName: str(row, "dealer_name"),
      dealerAddress: parseAddress(str(row, "address")),
      dateFirstOnLot: parseDate(date),
    });
  });
  return { vehicles, rejected };
};

/** Rows for `ingest_inventory(p_rows)` — keys are the `vehicles` column names. */
export const toIngestPayload = (vehicles: FeedVehicle[]) =>
  vehicles.map((v) => ({
    vin: v.vin,
    stock_number: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    body_style: v.bodyStyle,
    drivetrain: v.drivetrain,
    transmission: v.transmission,
    fuel_type: v.fuelType,
    mileage: v.mileage,
    price: v.price,
    exterior_color: v.exteriorColor,
    interior_color: v.interiorColor,
    url: v.url,
    images: v.images,
    description_html: v.descriptionHtml,
    dealer_name: v.dealerName,
    dealer_address: v.dealerAddress,
    date_first_on_lot: v.dateFirstOnLot,
  }));
