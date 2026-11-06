import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DealList } from "@/components/deal-list";
import { getAllStaff, getDealsNeedingAction, getProducts, getViewer, isPorterOnly } from "@/lib/data";
import { currentMonth } from "@/lib/months";

/** A salesperson's deals that an admin flagged "Needs action" — what to do is in the deal notes. */
export default async function NeedsActionPage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const [viewer, sp] = await Promise.all([getViewer(), searchParams]);
  if (!viewer) redirect("/login");
  if (isPorterOnly(viewer.me)) redirect("/inventory");
  const { me, impersonating } = viewer;

  // Same rule as the dashboard: admins can look at any salesperson
  const staffList = await getAllStaff();
  const staff = sp.staff && me.is_admin ? staffList.find((s) => s.id === sp.staff) : me;
  if (!staff) notFound();
  if (!staff.is_salesperson) redirect("/admin/review");

  const [deals, products] = await Promise.all([getDealsNeedingAction(staff.id), getProducts()]);
  const open = `${currentMonth()}-01`;

  return (
    <>
      <div className="space-y-2">
        <Link href={sp.staff ? `/dashboard?staff=${sp.staff}` : "/dashboard"} className="-ml-2 inline-flex min-h-11 items-center px-2 text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-primary">
          ← Dashboard
        </Link>
        <div>
          <p className="eyebrow text-primary">{staff.id === me.id ? "Your deals" : staff.name} · {deals.length}</p>
          <h1 className="display text-4xl text-white lg:text-5xl">Needs Action</h1>
        </div>
      </div>
      <p className="text-sm text-on-surface-muted">An admin flagged these deals. What needs to happen is in the deal notes — an admin clears the flag once it&apos;s handled.</p>
      <DealList
        deals={deals}
        productNames={new Map(products.map((p) => [p.id, p.name]))}
        staffNames={new Map(staffList.map((s) => [s.id, s.name]))}
        viewerId={staff.id}
        canEdit={(d) => !impersonating && (me.is_admin || d.sale_date >= open)}
        emptyText="Nothing needs action. You're all clear."
        fullNotes
      />
    </>
  );
}
