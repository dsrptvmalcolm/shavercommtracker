import { describe, expect, it } from "vitest";
import { buildSalesLog, type Departure, type LinkedDeal, type SalesLogVehicle } from "./sales-log";

const vehicles: SalesLogVehicle[] = [
  { id: "v1", stockNumber: "16945", title: "2023 Jeep Compass Altitude", bodyStyle: "SUV", firstPrice: 22729 },
  { id: "v2", stockNumber: "17001", title: "2021 Ford Escape SE", bodyStyle: "SUV", firstPrice: 18000 },
];
const dep = (eventId: string, vehicleId: string, leftAt: string): Departure => ({ eventId, vehicleId, leftAt, daysOnLot: 30, lastPrice: 21729 });

describe("buildSalesLog", () => {
  it("dates departures in Chicago time and filters by month left", () => {
    const departures = [dep("e1", "v1", "2026-11-01T04:30:00Z")];
    const oct = buildSalesLog({ departures, vehicles, deals: [], month: "2026-10" });
    expect(oct).toHaveLength(1);
    expect(oct[0]).toMatchObject({ leftOn: "2026-10-31", stockNumber: "16945", title: "2023 Jeep Compass Altitude", bodyStyle: "SUV", firstPrice: 22729, lastPrice: 21729, daysOnLot: 30, dealId: null });
    expect(buildSalesLog({ departures, vehicles, deals: [], month: "2026-11" })).toEqual([]);
  });

  it("sorts newest first and returns every month when month is null", () => {
    const departures = [dep("e1", "v1", "2026-10-05T15:00:00Z"), dep("e2", "v2", "2026-11-03T15:00:00Z")];
    expect(buildSalesLog({ departures, vehicles, deals: [], month: null }).map((r) => r.eventId)).toEqual(["e2", "e1"]);
  });

  it("attaches a deal to the first departure on or after its sale date", () => {
    const departures = [dep("e1", "v1", "2026-10-25T15:00:00Z"), dep("e2", "v1", "2026-11-03T15:00:00Z")];
    const deals: LinkedDeal[] = [{ id: "d1", vehicleId: "v1", saleDate: "2026-10-20" }];
    const rows = buildSalesLog({ departures, vehicles, deals, month: null });
    expect(rows.find((r) => r.eventId === "e1")?.dealId).toBe("d1");
    expect(rows.find((r) => r.eventId === "e2")?.dealId).toBeNull();
  });

  it("doesn't move an October deal onto a November departure when viewing November", () => {
    const departures = [dep("e1", "v1", "2026-10-25T15:00:00Z"), dep("e2", "v1", "2026-11-03T15:00:00Z")];
    const deals: LinkedDeal[] = [{ id: "d1", vehicleId: "v1", saleDate: "2026-10-20" }];
    expect(buildSalesLog({ departures, vehicles, deals, month: "2026-11" })).toMatchObject([{ eventId: "e2", dealId: null }]);
  });

  it("still attaches the deal when the car left before the sale date", () => {
    const departures = [dep("e1", "v1", "2026-10-25T15:00:00Z")];
    const deals: LinkedDeal[] = [{ id: "d1", vehicleId: "v1", saleDate: "2026-10-28" }];
    expect(buildSalesLog({ departures, vehicles, deals, month: null })[0].dealId).toBe("d1");
  });

  it("never attaches a deal for another vehicle", () => {
    const departures = [dep("e1", "v1", "2026-10-25T15:00:00Z")];
    const deals: LinkedDeal[] = [{ id: "d1", vehicleId: "v2", saleDate: "2026-10-20" }];
    expect(buildSalesLog({ departures, vehicles, deals, month: null })[0].dealId).toBeNull();
  });

  it("skips departures whose vehicle row is missing", () => {
    expect(buildSalesLog({ departures: [dep("e1", "nope", "2026-10-25T15:00:00Z")], vehicles, deals: [], month: null })).toEqual([]);
  });
});
