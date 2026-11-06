import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeed } from "./parse-feed";

// Values that pass a shape check but would make Postgres reject the whole refresh.
const sample = readFileSync(join(__dirname, "fixtures/vincue-sample.csv"), "utf8");
const jeepWith = (field: string, from: string, to: string) => {
  const edited = sample.replace(`"${from}"`, `"${to}"`);
  expect(edited).not.toBe(sample); // the fixture value we replace must exist
  return parseFeed(edited).vehicles.find((v) => v.stockNumber === "16945")!;
};

describe("parseFeed rejects impossible values instead of passing them to the database", () => {
  it("drops a lot date that isn't a real calendar date", () => {
    expect(jeepWith("date_first_on_lot", "2026-06-19", "2026-02-30").dateFirstOnLot).toBeNull();
    expect(jeepWith("date_first_on_lot", "2026-06-19", "0000-00-00").dateFirstOnLot).toBeNull();
  });

  it("rounds fractional mileage instead of gluing the digits together", () => {
    expect(jeepWith("mileage.value", "40403", "45000.5").mileage).toBe(45001);
  });

  it("drops a mileage too large to be real", () => {
    expect(jeepWith("mileage.value", "40403", "99999999999").mileage).toBeNull();
  });

  it("drops a year outside 1900 to next year + 1", () => {
    expect(jeepWith("year", "2023", "1800").year).toBeNull();
    expect(jeepWith("year", "2023", "20230").year).toBeNull();
  });
});
