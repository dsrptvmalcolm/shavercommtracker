import { getAllStaff, getProducts, getViewer } from "@/lib/data";
import { redirect } from "next/navigation";
import { currentMonth, todayIso } from "@/lib/months";
import { DealForm } from "../deal-form";

export default async function NewDealPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Viewing as someone is read only
  if (viewer.impersonating) redirect("/dashboard");
  const { me } = viewer;
  const [products, staff] = await Promise.all([getProducts(), getAllStaff()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow text-primary">New deal</p>
        <h1 className="display text-4xl text-white">Log a Deal</h1>
      </div>
      <DealForm me={me} products={products} salespeople={staff.filter((s) => s.is_salesperson)} today={todayIso()} minDate={`${currentMonth()}-01`} />
    </div>
  );
}
