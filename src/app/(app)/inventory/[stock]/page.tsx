import Link from "next/link";
import { notFound } from "next/navigation";
import { canPost, getVehicleById, getVehicleByStock, getVehicleEvents, requireMe, type VehicleEvent } from "@/lib/data";
import { money0 } from "@/lib/format";
import { daysOnLot, vehicleTitle } from "@/lib/inventory/vehicle";
import { APP_TIMEZONE, todayIso } from "@/lib/months";
import { PostedToggle } from "../posted-toggle";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: APP_TIMEZONE, month: "short", day: "numeric", year: "numeric" });

const eventLine = (e: VehicleEvent): string => {
  switch (e.kind) {
    case "added":
      return "Added to inventory";
    case "price_change":
      return `Price ${money0(e.oldPrice)} → ${money0(e.newPrice)}`;
    case "removed":
      return e.daysOnLot === null ? "Left inventory" : `Left inventory (${e.daysOnLot} days on lot)`;
    case "returned":
      return "Back in inventory";
    case "posted":
      return `Posted to Marketplace${e.byName ? ` by ${e.byName}` : ""}`;
    case "unposted":
      return `Marked not posted${e.byName ? ` by ${e.byName}` : ""}`;
  }
};

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ stock: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const [me, { stock }, sp] = await Promise.all([requireMe(), params, searchParams]);
  const wanted = decodeURIComponent(stock);
  // ?id= picks one car when a stock number was reused (deal and sales-log links); otherwise the newest car
  const byId = sp.id && /^[0-9a-f-]{36}$/i.test(sp.id) ? await getVehicleById(sp.id) : null;
  const v = byId && byId.stockNumber.toUpperCase() === wanted.toUpperCase() ? byId : await getVehicleByStock(wanted);
  if (!v) notFound();
  const poster = canPost(me);
  const events = await getVehicleEvents(v.id);
  const gone = v.status === "gone";
  const days = daysOnLot(v.dateFirstOnLot, gone && v.removedAt ? todayIso(new Date(v.removedAt)) : todayIso());

  const details: [string, string][] = (
    [
      ["Price", money0(v.price)],
      ["First price", v.firstPrice !== null && v.firstPrice !== v.price ? money0(v.firstPrice) : ""],
      ["Miles", v.mileage === null ? "" : v.mileage.toLocaleString("en-US")],
      ["Days on lot", days === null ? "" : String(days)],
      ["Stock #", v.stockNumber],
      ["VIN", v.vin],
      ["Exterior", v.exteriorColor],
      ["Interior", v.interiorColor],
      ["Drivetrain", v.drivetrain],
      ["Transmission", v.transmission],
      ["Fuel", v.fuelType],
      ["Body", v.bodyStyle],
    ] as [string, string][]
  ).filter(([, value]) => value.trim() !== "");

  return (
    <>
      <div className="space-y-2">
        <Link href="/inventory" className="inline-flex min-h-11 items-center text-sm font-bold text-on-surface-muted hover:text-on-surface">
          ← Inventory
        </Link>
        <p className="eyebrow text-primary">Stock #{v.stockNumber}</p>
        <h1 className="display text-3xl text-white lg:text-5xl">{vehicleTitle(v)}</h1>
      </div>

      {gone && (
        <p role="status" className="card border-danger/40 bg-danger/10 p-4 text-sm font-bold text-danger">
          No longer in inventory{v.removedAt ? ` since ${date(v.removedAt)}` : ""}.
        </p>
      )}

      {v.images.length > 0 && (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0" aria-label="Photos">
          {v.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`Photo ${i + 1} of ${v.images.length}`}
              loading={i < 2 ? "eager" : "lazy"}
              className="aspect-[4/3] w-[85%] shrink-0 snap-center rounded-2xl object-cover sm:w-80"
            />
          ))}
        </div>
      )}

      {poster && !gone && (
        <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
          <Link href={`/inventory/${encodeURIComponent(v.stockNumber)}/marketplace`} className="btn-primary px-4 py-2">
            Post on Marketplace
          </Link>
          <PostedToggle vehicleId={v.id} posted={v.postedAt !== null} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="field-label mb-3">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-on-surface-muted">{label}</dt>
                <dd className="break-all font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          {v.url && (
            <a href={v.url} target="_blank" rel="noopener" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
              View on shavercars.com ↗
            </a>
          )}
        </section>

        <section className="card p-6">
          <h2 className="field-label mb-3">History</h2>
          {events.length === 0 ? (
            <p className="text-sm text-on-surface-muted">No changes yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-x-4">
                  <span className="text-white">{eventLine(e)}</span>
                  <span className="text-xs text-on-surface-subtle">{date(e.at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
