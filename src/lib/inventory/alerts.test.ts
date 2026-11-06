import { describe, expect, it } from "vitest";
import { alertMessage, type InventoryAlert } from "./alerts";

const vehicle = { stockNumber: "16945", year: 2023, make: "Jeep", model: "Compass", trim: "Altitude" };

const alert = (over: Partial<InventoryAlert>): InventoryAlert => ({
  id: "a1",
  kind: "sold",
  oldPrice: null,
  newPrice: null,
  createdAt: "2026-11-06T12:00:00Z",
  vehicle,
  ...over,
});

describe("alertMessage", () => {
  it("tells the poster a sold car's listing must come down", () => {
    expect(alertMessage(alert({ kind: "sold", oldPrice: 22729 }))).toEqual({
      headline: "Sold — take down your listing",
      detail: "2023 Jeep Compass Altitude · #16945",
    });
  });

  it("shows the old and new price for a price change", () => {
    expect(alertMessage(alert({ kind: "price_change", oldPrice: 22729, newPrice: 21729 }))).toEqual({
      headline: "Price changed $22,729 → $21,729 — update your listing",
      detail: "2023 Jeep Compass Altitude · #16945",
    });
  });
});
