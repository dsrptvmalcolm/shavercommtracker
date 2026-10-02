import { describe, expect, it } from "vitest";
import { isWorkingDay, workingDaysElapsed, workingDaysIn } from "./months";

const holidays = new Set(["2026-11-26"]);

describe("working days", () => {
  it("counts Monday–Saturday and skips holidays", () => {
    expect(isWorkingDay("2026-11-01", holidays)).toBe(false); // Sunday
    expect(isWorkingDay("2026-11-07", holidays)).toBe(true); // Saturday
    expect(isWorkingDay("2026-11-26", holidays)).toBe(false); // Thanksgiving
    // November 2026: 30 days − 5 Sundays − Thanksgiving
    expect(workingDaysIn("2026-11", holidays)).toBe(24);
  });

  it("counts elapsed working days through today in Central time", () => {
    // Oct 2 2026 is a Friday; Oct 1–2 are both working days
    const now = new Date("2026-10-02T15:00:00Z");
    expect(workingDaysElapsed("2026-10", new Set(), now)).toBe(2);
    expect(workingDaysElapsed("2026-09", new Set(["2026-09-07"]), now)).toBe(25);
    expect(workingDaysElapsed("2026-11", new Set(), now)).toBe(0);
  });
});
