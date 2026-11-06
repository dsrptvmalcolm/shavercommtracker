import { describe, expect, it } from "vitest";
import { vehicleTitle } from "./vehicle";

describe("vehicleTitle — placeholder trims", () => {
  it("leaves out VinCue's 'Other' trim placeholder", () => {
    expect(vehicleTitle({ year: 2019, make: "Ford", model: "F-150", trim: "Other" })).toBe("2019 Ford F-150");
    expect(vehicleTitle({ year: 2019, make: "Ford", model: "F-150", trim: "OTHER" })).toBe("2019 Ford F-150");
  });

  it("keeps real trims", () => {
    expect(vehicleTitle({ year: 2023, make: "Jeep", model: "Compass", trim: "Altitude" })).toBe("2023 Jeep Compass Altitude");
  });
});
