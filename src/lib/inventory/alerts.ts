import { money0 } from "../format";
import { vehicleTitle, type Vehicle } from "./vehicle";

/** An undismissed Marketplace alert for the person who posted the car. */
export type InventoryAlert = {
  id: string;
  kind: "sold" | "price_change";
  oldPrice: number | null;
  newPrice: number | null;
  createdAt: string;
  vehicle: Pick<Vehicle, "stockNumber" | "year" | "make" | "model" | "trim">;
};

/** What the alert strip says: the action to take, then which car. */
export const alertMessage = (a: InventoryAlert): { headline: string; detail: string } => ({
  headline:
    a.kind === "sold"
      ? "Sold — take down your listing"
      : `Price changed ${money0(a.oldPrice)} → ${money0(a.newPrice)} — update your listing`,
  detail: `${vehicleTitle(a.vehicle)} · #${a.vehicle.stockNumber}`,
});
