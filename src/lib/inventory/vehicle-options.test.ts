import { describe, expect, it } from "vitest";
import { searchVehicleOptions, type VehicleOption } from "./vehicle-options";

const opt = (stockNumber: string, title: string, gone = false): VehicleOption => ({ id: stockNumber, stockNumber, title, image: null, gone });

const options = [
  opt("17001", "2021 Ford Escape SE 1169 Edition"),
  opt("16945", "2023 Jeep Compass Altitude"),
  opt("16990", "2019 Jeep Cherokee Latitude", true),
  opt("16991", "2020 Jeep Cherokee Trailhawk"),
];

describe("searchVehicleOptions", () => {
  it("returns nothing for an empty query", () => {
    expect(searchVehicleOptions(options, "  ")).toEqual([]);
  });

  it("matches every word against title and stock number, ignoring case", () => {
    expect(searchVehicleOptions(options, "jeep comp").map((o) => o.stockNumber)).toEqual(["16945"]);
  });

  it("puts stock number prefix matches before title matches", () => {
    expect(searchVehicleOptions(options, "169").map((o) => o.stockNumber)[0]).toBe("16945");
    expect(searchVehicleOptions(options, "169").at(-1)?.stockNumber).toBe("17001");
  });

  it("puts in-stock cars before cars that already left", () => {
    expect(searchVehicleOptions(options, "cherokee").map((o) => o.stockNumber)).toEqual(["16991", "16990"]);
  });

  it("honours the limit", () => {
    expect(searchVehicleOptions(options, "jeep", 2)).toHaveLength(2);
  });
});
