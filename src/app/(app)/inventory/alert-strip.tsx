import Link from "next/link";
import { alertMessage, type InventoryAlert } from "@/lib/inventory/alerts";
import { DismissAlertButton } from "./dismiss-alert-button";

/** Undismissed Marketplace alerts for the viewer, shown at the top of Inventory (porters and admins). */
export function AlertStrip({ alerts }: { alerts: InventoryAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section aria-labelledby="alerts-heading" className="space-y-2">
      <h2 id="alerts-heading" className="eyebrow text-primary">
        {alerts.length === 1 ? "1 listing to update" : `${alerts.length} listings to update`}
      </h2>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const { headline, detail } = alertMessage(a);
          const sold = a.kind === "sold";
          return (
            <li
              key={a.id}
              className={`card flex items-center gap-3 p-3 pl-4 ${sold ? "border-danger/40 bg-danger/10" : "border-primary/40 bg-primary-soft"}`}
            >
              <Link
                href={`/inventory/${encodeURIComponent(a.vehicle.stockNumber)}`}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
              >
                <span className={`text-sm font-bold ${sold ? "text-danger" : "text-primary"}`}>{headline}</span>
                <span className="text-sm text-on-surface">{detail}</span>
              </Link>
              <DismissAlertButton alertId={a.id} label={`Dismiss: ${headline}, ${detail}`} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
