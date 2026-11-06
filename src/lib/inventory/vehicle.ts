import type { FeedVehicle } from "./types";

/** A vehicle as stored (feed fields + lifecycle + posted status for porters/admins). */
export type Vehicle = FeedVehicle & {
  id: string;
  firstPrice: number | null;
  status: "in_stock" | "gone";
  removedAt: string | null;
  /** Only visible to porters and admins (RLS); null for everyone else */
  postedAt: string | null;
  postedBy: string | null;
};

/** Vehicle page link; pass the id to pin one car when a stock number was reused. */
export const vehicleHref = (stockNumber: string, id?: string): string =>
  `/inventory/${encodeURIComponent(stockNumber)}${id ? `?id=${id}` : ""}`;

export type InventoryTab = "not-posted" | "posted" | "all";

/** "Year Make Model Trim". VinCue fills a missing trim with "Other", which isn't a trim. */
export const vehicleTitle = (v: Pick<Vehicle, "year" | "make" | "model" | "trim">): string =>
  [v.year, v.make, v.model, v.trim.trim().toLowerCase() === "other" ? "" : v.trim]
    .filter((p) => p !== null && String(p).trim() !== "")
    .join(" ");

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole days between the lot date and `asOf` (both YYYY-MM-DD). */
export const daysOnLot = (dateFirstOnLot: string | null, asOf: string): number | null =>
  dateFirstOnLot ? dayNumber(asOf) - dayNumber(dateFirstOnLot) : null;

const haystack = (v: Vehicle) =>
  [v.stockNumber, v.vin, v.year, v.make, v.model, v.trim].join(" ").toLowerCase();

export const listVehicles = (
  vehicles: Vehicle[],
  { tab, q, today }: { tab: InventoryTab; q: string; today: string },
): Vehicle[] => {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const age = (v: Vehicle) => daysOnLot(v.dateFirstOnLot, today) ?? -Infinity;
  return vehicles
    .filter((v) => v.status === "in_stock")
    .filter((v) => (tab === "posted" ? v.postedAt !== null : tab === "not-posted" ? v.postedAt === null : true))
    .filter((v) => terms.every((t) => haystack(v).includes(t)))
    .sort((a, b) => (tab === "posted" ? (b.postedAt ?? "").localeCompare(a.postedAt ?? "") : age(b) - age(a)));
};
