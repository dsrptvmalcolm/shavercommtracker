import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAddress, parseFeed, parseImages, parsePrice, toIngestPayload } from "./parse-feed";

const sample = readFileSync(join(__dirname, "fixtures/vincue-sample.csv"), "utf8");

describe("parseFeed", () => {
  it("parses the sample feed", () => {
    const { vehicles, rejected } = parseFeed(sample);
    expect(vehicles).toHaveLength(3);
    expect(rejected).toHaveLength(0);
    const jeep = vehicles.find((v) => v.stockNumber === "16945");
    expect(jeep).toMatchObject({
      vin: "3C4NJDBN0PT528489",
      year: 2023,
      make: "Jeep",
      model: "Compass",
      trim: "Altitude",
      mileage: 40403,
      price: 21729,
      exteriorColor: "Billet Silver Metallic Clearcoat",
      interiorColor: "Black",
      drivetrain: "4X4",
      transmission: "AUTOMATIC",
      fuelType: "GASOLINE",
      bodyStyle: "SUV",
      dateFirstOnLot: "2026-06-19",
      dealerName: "Shaver Preferred Motors",
      dealerAddress: "5701 Broadway, Merrillville, IN 46410",
    });
    expect(jeep?.images).toHaveLength(3);
    expect(jeep?.images.every((u) => u.startsWith("https://cdn-img.vincue.net/"))).toBe(true);
    expect(jeep?.descriptionHtml).toContain("<li>Altitude Special Edition</li>");
  });

  it("keeps a row with a blank color", () => {
    const blank = parseFeed(sample).vehicles.find((v) => v.stockNumber === "M17144");
    expect(blank?.exteriorColor).toBe("");
  });

  it("rejects rows without a VIN", () => {
    const broken = sample.replace('"3C4NJDBN0PT528489","','"3C4NJDBN0PT528489_X","').replace(/"3C4NJDBN0PT528489"/g, '""');
    const { vehicles, rejected } = parseFeed(broken);
    expect(vehicles).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("VIN");
  });

  it("returns zero vehicles for non-CSV input without throwing", () => {
    const result = parseFeed("<html><body>Error</body></html>");
    expect(result.vehicles).toHaveLength(0);
  });

  it("returns zero vehicles for an empty string", () => {
    expect(parseFeed("").vehicles).toHaveLength(0);
  });
});

describe("field parsers", () => {
  it("parsePrice reads '21729.00 USD'", () => {
    expect(parsePrice("21729.00 USD")).toBe(21729);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });

  it("parseImages pulls every url from the pseudo-JSON list", () => {
    expect(parseImages("[{url:'https://a/1.jpg'},{url:'https://a/2.jpg'}]")).toEqual(["https://a/1.jpg", "https://a/2.jpg"]);
    expect(parseImages("")).toEqual([]);
  });

  it("parseAddress formats the address object", () => {
    expect(parseAddress("{addr1: '5701 Broadway', city: 'Merrillville', region: 'IN', postal_code: '46410', country: 'US'}")).toBe(
      "5701 Broadway, Merrillville, IN 46410",
    );
    expect(parseAddress("")).toBe("");
  });
});

describe("toIngestPayload", () => {
  it("uses the database column names", () => {
    const [row] = toIngestPayload(parseFeed(sample).vehicles.filter((v) => v.stockNumber === "16945"));
    expect(row).toMatchObject({
      vin: "3C4NJDBN0PT528489",
      stock_number: "16945",
      date_first_on_lot: "2026-06-19",
      body_style: "SUV",
      fuel_type: "GASOLINE",
      exterior_color: "Billet Silver Metallic Clearcoat",
      description_html: expect.stringContaining("<li>"),
      dealer_address: "5701 Broadway, Merrillville, IN 46410",
      price: 21729,
      mileage: 40403,
      year: 2023,
    });
    expect(Array.isArray(row.images)).toBe(true);
  });
});
