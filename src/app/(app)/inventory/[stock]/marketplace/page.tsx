import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { getListingPhone, getVehicleByStock, requirePoster } from "@/lib/data";
import { money0 } from "@/lib/format";
import { marketplaceDescription, marketplaceDetails, marketplaceMiles } from "@/lib/inventory/marketplace";
import { PostedToggle } from "../../posted-toggle";
import { PhotoPicker } from "./photo-picker";

export default async function MarketplacePage({ params }: { params: Promise<{ stock: string }> }) {
  const [, { stock }] = await Promise.all([requirePoster(), params]);
  const v = await getVehicleByStock(decodeURIComponent(stock));
  if (!v) notFound();
  const vehicleHref = `/inventory/${encodeURIComponent(v.stockNumber)}`;
  if (v.status === "gone") redirect(vehicleHref);

  const phone = await getListingPhone();
  const description = marketplaceDescription(v, phone);
  const details = marketplaceDetails(v);
  const rows: { label: string; shown: string; copy: string }[] = [
    { label: "VIN", shown: details.vin, copy: details.vin },
    { label: "Title", shown: details.title, copy: details.title },
    { label: "Price", shown: money0(v.price), copy: details.price },
    { label: "Miles", shown: v.mileage === null ? "—" : v.mileage.toLocaleString("en-US"), copy: marketplaceMiles(v) },
  ];

  return (
    <>
      <div className="space-y-2">
        <Link href={vehicleHref} className="inline-flex min-h-11 items-center text-sm font-bold text-on-surface-muted hover:text-on-surface">
          ← Back to car
        </Link>
        <p className="eyebrow text-primary">Post on Marketplace · Stock #{v.stockNumber}</p>
        <h1 className="display text-3xl text-white lg:text-4xl">{details.title}</h1>
      </div>

      <section className="card space-y-4 p-6">
        <h2 className="field-label">1 · Photos</h2>
        <PhotoPicker urls={v.images} baseName={`${v.stockNumber}-${details.title.replace(/[^A-Za-z0-9]+/g, "-")}`} />
      </section>

      <section className="card space-y-2 p-6">
        <h2 className="field-label">2 · Details</h2>
        <ul className="divide-y divide-surface-border/70">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-muted">{r.label}</p>
                <p className="break-all font-bold text-white">{r.shown}</p>
              </div>
              <CopyButton text={r.copy} label="Copy" className="shrink-0" />
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="field-label">3 · Description</h2>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-surface-subtle p-4 font-sans text-sm text-on-surface">
          {description}
        </pre>
        <CopyButton text={description} label="Copy description" className="w-full sm:w-auto" />
      </section>

      <section className="card space-y-3 p-6">
        <p className="text-sm text-on-surface-muted">Tap when it&apos;s live on Marketplace.</p>
        <PostedToggle vehicleId={v.id} posted={v.postedAt !== null} className="sm:max-w-xs" />
      </section>
    </>
  );
}
