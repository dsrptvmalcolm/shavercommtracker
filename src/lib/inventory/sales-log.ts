import { todayIso } from "../months";

/** One time a car left the feed (a `removed` vehicle event, with the price and days on lot frozen then). */
export type Departure = { eventId: string; vehicleId: string; leftAt: string; daysOnLot: number | null; lastPrice: number | null };
export type SalesLogVehicle = { id: string; stockNumber: string; title: string; bodyStyle: string; firstPrice: number | null };
export type LinkedDeal = { id: string; vehicleId: string; saleDate: string };

export type SalesLogRow = {
  eventId: string;
  /** YYYY-MM-DD, America/Chicago */
  leftOn: string;
  vehicleId: string;
  stockNumber: string;
  title: string;
  bodyStyle: string;
  firstPrice: number | null;
  lastPrice: number | null;
  daysOnLot: number | null;
  dealId: string | null;
};

const leftOn = (d: Departure) => todayIso(new Date(d.leftAt));

/**
 * Which departure each linked deal belongs to: the first one on or after the sale date, or — when the car
 * dropped off the feed before the sale date — the latest one before it. One deal per departure.
 */
const dealsByDeparture = (departures: Departure[], deals: LinkedDeal[]): Map<string, string> => {
  const out = new Map<string, string>();
  for (const deal of [...deals].sort((a, b) => a.saleDate.localeCompare(b.saleDate))) {
    const mine = departures
      .filter((d) => d.vehicleId === deal.vehicleId && !out.has(d.eventId))
      .sort((a, b) => a.leftAt.localeCompare(b.leftAt));
    const pick = mine.find((d) => leftOn(d) >= deal.saleDate) ?? mine.findLast((d) => leftOn(d) < deal.saleDate);
    if (pick) out.set(pick.eventId, deal.id);
  }
  return out;
};

/** Sales log rows for one month left (YYYY-MM, Chicago) — or every month when null — newest first. */
export const buildSalesLog = ({
  departures,
  vehicles,
  deals,
  month,
}: {
  departures: Departure[];
  vehicles: SalesLogVehicle[];
  deals: LinkedDeal[];
  month: string | null;
}): SalesLogRow[] => {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const dealFor = dealsByDeparture(departures, deals);
  return departures
    .flatMap((d): SalesLogRow[] => {
      const v = byId.get(d.vehicleId);
      const on = leftOn(d);
      if (!v || (month && !on.startsWith(month))) return [];
      return [{
        eventId: d.eventId,
        leftOn: on,
        vehicleId: v.id,
        stockNumber: v.stockNumber,
        title: v.title,
        bodyStyle: v.bodyStyle,
        firstPrice: v.firstPrice,
        lastPrice: d.lastPrice,
        daysOnLot: d.daysOnLot,
        dealId: dealFor.get(d.eventId) ?? null,
      }];
    })
    .sort((a, b) => b.leftOn.localeCompare(a.leftOn) || b.eventId.localeCompare(a.eventId));
};
