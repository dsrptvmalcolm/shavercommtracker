import { describe, expect, it } from "vitest";
import { daysOnLot, listVehicles, vehicleTitle, type Vehicle } from "./vehicle";

const make = (over: Partial<Vehicle>): Vehicle => ({
  id: over.stockNumber ?? "id",
  vin: "VIN",
  stockNumber: "1",
  year: 2023,
  make: "Jeep",
  model: "Compass",
  trim: "Altitude",
  bodyStyle: "SUV",
  drivetrain: "4X4",
  transmission: "AUTOMATIC",
  fuelType: "GASOLINE",
  mileage: 1000,
  price: 20000,
  firstPrice: 20000,
  exteriorColor: "",
  interiorColor: "",
  url: "",
  images: [],
  descriptionHtml: "",
  dealerName: "",
  dealerAddress: "",
  dateFirstOnLot: "2026-10-01",
  status: "in_stock",
  removedAt: null,
  postedAt: null,
  postedBy: null,
  ...over,
});

describe("vehicleTitle", () => {
  it("joins year make model trim", () => {
    expect(vehicleTitle({ year: 2023, make: "Jeep", model: "Compass", trim: "Altitude" })).toBe("2023 Jeep Compass Altitude");
  });
  it("skips a blank trim", () => {
    expect(vehicleTitle({ year: 2023, make: "Jeep", model: "Compass", trim: "" })).toBe("2023 Jeep Compass");
  });
});

describe("daysOnLot", () => {
  it("counts whole days", () => {
    expect(daysOnLot("2026-06-19", "2026-11-06")).toBe(140);
  });
  it("is null without a date", () => {
    expect(daysOnLot(null, "2026-11-06")).toBeNull();
  });
});

describe("listVehicles", () => {
  const today = "2026-11-06";
  const old = make({ stockNumber: "100", dateFirstOnLot: "2026-01-01" });
  const mid = make({ stockNumber: "200", dateFirstOnLot: "2026-06-01" });
  const fresh = make({ stockNumber: "300", dateFirstOnLot: "2026-11-01" });
  const postedEarly = make({ stockNumber: "400", postedAt: "2026-11-01T10:00:00Z", postedBy: "p" });
  const postedLate = make({ stockNumber: "500", postedAt: "2026-11-05T10:00:00Z", postedBy: "p" });
  const gone = make({ stockNumber: "600", status: "gone", dateFirstOnLot: "2025-01-01" });
  const all = [fresh, postedEarly, mid, gone, postedLate, old];

  it("leaves out cars that are gone", () => {
    expect(listVehicles(all, { tab: "all", q: "", today }).map((v) => v.stockNumber)).not.toContain("600");
  });

  it("not posted: excludes posted cars, oldest on the lot first", () => {
    expect(listVehicles(all, { tab: "not-posted", q: "", today }).map((v) => v.stockNumber)).toEqual(["100", "200", "300"]);
  });

  it("posted: newest posted first", () => {
    expect(listVehicles(all, { tab: "posted", q: "", today }).map((v) => v.stockNumber)).toEqual(["500", "400"]);
  });

  it("puts cars without a lot date last", () => {
    const noDate = make({ stockNumber: "700", dateFirstOnLot: null });
    expect(listVehicles([noDate, fresh], { tab: "all", q: "", today }).map((v) => v.stockNumber)).toEqual(["300", "700"]);
  });

  it("search needs every term to match", () => {
    const jeep = make({ stockNumber: "16945" });
    const otherJeep = make({ stockNumber: "17001" });
    const ford = make({ stockNumber: "16900", make: "Ford", model: "F-150", trim: "XLT" });
    expect(listVehicles([jeep, otherJeep, ford], { tab: "all", q: "jeep 169", today }).map((v) => v.stockNumber)).toEqual(["16945"]);
  });

  it("search matches VIN case-insensitively", () => {
    const v = make({ stockNumber: "1", vin: "3C4NJDBN0PT528489" });
    expect(listVehicles([v], { tab: "all", q: "pt5284", today })).toHaveLength(1);
  });
});
