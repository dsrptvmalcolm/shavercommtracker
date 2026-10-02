import { notFound } from "next/navigation";
import { getAllStaff, getDeal, getProducts, getViewer } from "@/lib/data";
import { redirect } from "next/navigation";
import { currentMonth, todayIso } from "@/lib/months";
import { DealForm } from "../deal-form";

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Viewing as someone is read only
  if (viewer.impersonating) redirect("/dashboard");
  const { me } = viewer;
  const [deal, products, staff] = await Promise.all([getDeal(id), getProducts(), getAllStaff()]);
  if (!deal) notFound();
  const locked = !me.is_admin && deal.sale_date < `${currentMonth()}-01`;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow text-primary">Edit deal</p>
        <h1 className="display text-4xl text-white">{deal.customer_name}</h1>
      </div>
      {locked ? (
        <p className="card p-6 text-sm text-on-surface-muted">This month is closed. Ask an admin to make changes.</p>
      ) : (
        <DealForm deal={deal} me={me} products={products} salespeople={staff.filter((s) => s.is_salesperson)} today={todayIso()} minDate={`${currentMonth()}-01`} />
      )}
    </div>
  );
}
