import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { highlights, marketplaceDescription, marketplaceDetails } from "./marketplace";
import { parseFeed } from "./parse-feed";
import type { Vehicle } from "./vehicle";

const feed = parseFeed(readFileSync(join(__dirname, "fixtures/vincue-sample.csv"), "utf8")).vehicles;
const toVehicle = (stock: string): Vehicle => {
  const f = feed.find((v) => v.stockNumber === stock)!;
  return { ...f, id: stock, firstPrice: f.price, status: "in_stock", removedAt: null, postedAt: null, postedBy: null };
};
const jeep = toVehicle("16945");
const PHONE = "219-235-8687";

describe("marketplaceDescription", () => {
  it("matches the approved template for the Jeep Compass", () => {
    expect(marketplaceDescription(jeep, PHONE)).toBe(
      [
        "2023 Jeep Compass Altitude",
        "$21,729 · 40,403 miles",
        "",
        "Exterior: Billet Silver Metallic Clearcoat",
        "Interior: Black",
        "4X4 · Automatic · Gasoline · SUV",
        "",
        "Highlights:",
        "• Altitude Special Edition",
        "• Light Tungsten Interior Accent Stitching",
        "• Gloss Black Grille and Crosshairs",
        "• Gloss Black Badges",
        "• Black Day Light Opening Moldings",
        "• Black Roof",
        "• 225/55R18 BSW AS Tires",
        '• 18" X 7" Gloss Black Painted Aluminum Wheels',
        "",
        "Stock #16945 · VIN 3C4NJDBN0PT528489",
        "",
        "Shaver Preferred Motors",
        "5701 Broadway, Merrillville, IN 46410",
        "Call 219-235-8687 or send us a message here.",
      ].join("\n"),
    );
  });

  it("leaves out a blank exterior color", () => {
    const text = marketplaceDescription({ ...jeep, exteriorColor: "" }, PHONE);
    expect(text).not.toContain("Exterior:");
    expect(text).toContain("Interior: Black");
  });

  it("leaves out 'Other' drivetrain and fuel", () => {
    const text = marketplaceDescription({ ...jeep, drivetrain: "Other", fuelType: "OTHER" }, PHONE);
    expect(text).toContain("\nAutomatic · SUV\n");
    expect(text).not.toMatch(/other/i);
  });

  it("drops the highlights block when the feed has none", () => {
    const text = marketplaceDescription({ ...jeep, descriptionHtml: "Plain text only" }, PHONE);
    expect(text).not.toContain("Highlights:");
    expect(text).not.toContain("\n\n\n");
  });

  it("shows miles alone when there is no price", () => {
    expect(marketplaceDescription({ ...jeep, price: null }, PHONE).split("\n")[1]).toBe("40,403 miles");
  });

  it("never contains HTML or escaped newlines and stays under 1500 characters", () => {
    for (const v of feed) {
      const text = marketplaceDescription(toVehicle(v.stockNumber), PHONE);
      expect(text).not.toContain("<");
      expect(text).not.toContain("\\n");
      expect(text.length).toBeLessThanOrEqual(1500);
    }
  });

  it("uses the phone it is given", () => {
    expect(marketplaceDescription(jeep, "555-0100")).toContain("Call 555-0100 or send us a message here.");
  });
});

describe("highlights", () => {
  it("decodes entities, skips long sentences and caps at 8", () => {
    const html = `<ul><li>A &amp; B</li><li> ${"x".repeat(61)}</li>${Array.from({ length: 10 }, (_, i) => `<li>Item ${i}</li>`).join("")}</ul>`;
    const list = highlights(html);
    expect(list[0]).toBe("A & B");
    expect(list).toHaveLength(8);
    expect(list.some((l) => l.length > 60)).toBe(false);
  });

  it("removes duplicates", () => {
    expect(highlights("<li>Black Roof</li><li>Black Roof</li>")).toEqual(["Black Roof"]);
  });
});

describe("marketplaceDetails", () => {
  it("gives VIN, title and price as plain digits", () => {
    expect(marketplaceDetails(jeep)).toEqual({ vin: "3C4NJDBN0PT528489", title: "2023 Jeep Compass Altitude", price: "21729" });
  });
  it("gives an empty price when there is none", () => {
    expect(marketplaceDetails({ ...jeep, price: null }).price).toBe("");
  });
});
