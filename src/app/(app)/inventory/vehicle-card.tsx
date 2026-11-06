import Link from "next/link";
import { money0 } from "@/lib/format";
import { daysOnLot, vehicleTitle, type Vehicle } from "@/lib/inventory/vehicle";
import { PostedToggle } from "./posted-toggle";

export function VehicleCard({ vehicle: v, today, canPost }: { vehicle: Vehicle; today: string; canPost: boolean }) {
  const days = daysOnLot(v.dateFirstOnLot, today);
  return (
    <li className="card flex flex-col overflow-hidden">
      <Link href={`/inventory/${encodeURIComponent(v.stockNumber)}`} className="group flex flex-1 flex-col hover:bg-surface-card-hover">
        <div className="aspect-[4/3] w-full bg-surface-subtle">
          {v.images[0] ? (
            // Plain <img>: photos come straight from VinCue's CDN; no image-optimizer config or cost
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-on-surface-subtle">No photo yet</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="font-bold leading-snug text-white">{vehicleTitle(v)}</p>
          <p className="text-xs text-on-surface-subtle">Stock #{v.stockNumber}</p>
          <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2 text-sm">
            <span className="text-lg font-extrabold text-primary">{money0(v.price)}</span>
            {v.mileage !== null && <span className="text-on-surface-muted">{v.mileage.toLocaleString("en-US")} mi</span>}
            {days !== null && <span className="text-on-surface-muted">{days} {days === 1 ? "day" : "days"}</span>}
          </div>
        </div>
      </Link>
      {canPost && <PostedToggle vehicleId={v.id} posted={v.postedAt !== null} className="px-4 pb-4" />}
    </li>
  );
}
