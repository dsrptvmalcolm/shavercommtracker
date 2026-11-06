import { describe, expect, it } from "vitest";
import { marketplaceMiles } from "./marketplace";

describe("marketplaceMiles", () => {
  it("gives mileage as plain digits for Facebook's mileage field", () => {
    expect(marketplaceMiles({ mileage: 40403 })).toBe("40403");
  });
  it("gives an empty string when the feed has no mileage", () => {
    expect(marketplaceMiles({ mileage: null })).toBe("");
  });
});
