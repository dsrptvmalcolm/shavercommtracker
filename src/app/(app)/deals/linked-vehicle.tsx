import Link from "next/link";
import { vehicleHref, vehicleTitle, type Vehicle } from "@/lib/inventory/vehicle";
import { shortDate } from "@/lib/format";
import { todayIso } from "@/lib/months";

/** The car this deal is linked to (save_deal sets the link from the stock number). */
export function LinkedVehicle({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link href={vehicleHref(v.stockNumber, v.id)} className="card flex items-center gap-4 p-4 hover:bg-surface-card-hover">
      {v.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- VinCue CDN photo, same as the inventory list
        <img src={v.images[0]} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-surface-subtle text-xs text-on-surface-subtle">No photo</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="eyebrow block text-primary">Vehicle</span>
        <span className="block font-bold leading-snug text-white">{vehicleTitle(v)}</span>
        <span className="block text-xs text-on-surface-muted">
          Stock #{v.stockNumber}
          {v.status === "gone" && v.removedAt && <> · Left inventory {shortDate(todayIso(new Date(v.removedAt)))}</>}
        </span>
      </span>
      <span aria-hidden className="text-on-surface-subtle">→</span>
    </Link>
  );
}
