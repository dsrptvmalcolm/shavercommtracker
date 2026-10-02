import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart } from "@/components/charts/bar-chart";
import { PaceChart } from "@/components/charts/pace-chart";
import { DealList } from "@/components/deal-list";
import { MonthNav } from "@/components/month-nav";
import { StatTile } from "@/components/stat-tile";
import { TierLadder } from "@/components/tier-ladder";
import { UnitsGauge } from "@/components/units-gauge";
import { currentMiniTierIndex, paceFor, storeVolumeSpiffFor } from "@/lib/commission/engine";
import { getAllStaff, getProducts, getSalespersonMonth, getUnitsByMonth, getViewer } from "@/lib/data";
import { money, money0, units as fmtUnits } from "@/lib/format";
import { currentMonth, daysElapsed, daysInMonth, isClosed, isMonth, monthLabel, shiftMonth } from "@/lib/months";

const CHART_MONTHS = 12;
const shortMonth = (m: string) => monthLabel(m).slice(0, 3);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; staff?: string }> }) {
  const [viewer, sp] = await Promise.all([getViewer(), searchParams]);
  if (!viewer) redirect("/login");
  const { me, impersonating } = viewer;
  const month = isMonth(sp.month) ? sp.month : currentMonth();

  // Admins can look at any salesperson's dashboard
  const staffList = await getAllStaff();
  const staff = sp.staff && me.is_admin ? staffList.find((s) => s.id === sp.staff) : me;
  if (!staff) notFound();
  if (!staff.is_salesperson && !sp.staff) redirect("/admin");

  const [view, products, unitsByMonth] = await Promise.all([
    getSalespersonMonth(staff, month),
    getProducts(),
    getUnitsByMonth(staff.id),
  ]);
  const { summary, paid, settings } = view;

  // Paid months show exactly what was paid; open months show the live calculation
  const total = paid?.total ?? summary.total;
  const vehicle = paid?.vehicle_commission ?? summary.vehicleCommission;
  const productSpiffs = paid?.product_spiffs ?? summary.productSpiffs;
  const bonus = total - vehicle - productSpiffs;
  const units = paid?.units ?? summary.units;

  const elapsed = daysElapsed(month);
  const days = daysInMonth(month);
  const closed = isClosed(month);
  const pace = closed ? units : paceFor(units, elapsed, days);
  const storePace = closed ? view.storeUnits : paceFor(view.storeUnits, elapsed, days);

  const tiers = [...settings.mini_tiers].sort((a, b) => a.startUnits - b.startUnits);
  const nextTier = tiers[currentMiniTierIndex(units, tiers) + 1];
  const storeTiers = [...settings.store_volume_tiers].sort((a, b) => a.units - b.units);
  const nextStoreTier = storeTiers.find((t) => t.units > view.storeUnits);
  const storeSpiff = storeVolumeSpiffFor(view.storeUnits, storeTiers);

  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const staffNames = new Map(staffList.map((s) => [s.id, s.name]));
  const commissions = new Map(summary.deals.map((c) => [c.dealId, c]));
  const params: Record<string, string> = sp.staff ? { staff: sp.staff } : {};
  const canWrite = !impersonating;

  // Charts: day-by-day units this month, and the trailing year by month
  const daily = Array.from({ length: days }, () => 0);
  const dealDates = new Map(view.deals.map((d) => [d.id, d.sale_date]));
  summary.deals.forEach((c) => {
    const day = Number(dealDates.get(c.dealId)?.slice(8, 10));
    if (day) daily[day - 1] += c.share;
  });
  const chartMonths = Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(month, i - CHART_MONTHS + 1));
  const monthBars = chartMonths.map((m) => {
    const u = m === month ? units : (unitsByMonth.get(m) ?? 0);
    return {
      key: m,
      label: shortMonth(m),
      value: u,
      highlight: m === month,
      tooltip: [`${fmtUnits(u)} units`, monthLabel(m)],
    };
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">{staff.id === me.id ? "Your month" : staff.name}</p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} basePath="/dashboard" params={params} />
      </div>

      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="card relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-surface-card via-surface-card to-surface-subtle p-6 shadow-2xl lg:col-span-7 lg:p-10">
          <div className="pointer-events-none absolute -top-16 -left-16 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="chip border border-primary/30 bg-primary-soft px-3 py-1 text-xs uppercase tracking-wider text-primary">
              {paid ? "Paid" : closed ? "Month total" : "MTD commission"}
            </span>
            <span className="text-xs font-semibold text-on-surface-subtle">
              {closed ? "Month closed" : `${days - elapsed} days left`}
            </span>
          </div>
          <div className="relative my-8">
            <div className="flex items-baseline gap-1">
              <h2 className="display text-6xl text-white sm:text-7xl lg:text-8xl">{money(total).split(".")[0]}</h2>
              <span className="display text-2xl text-on-surface-subtle lg:text-3xl">.{money(total).split(".")[1]}</span>
            </div>
            {paid && me.is_admin && Math.abs(paid.total - summary.total) > 0.01 && (
              <p className="mt-3 text-xs text-amber-300">
                Recalculated with current rules: {money(summary.total)} ({money(summary.total - paid.total)} difference)
              </p>
            )}
          </div>
          <div className="relative flex flex-wrap gap-6 border-t border-surface-border/70 pt-6 text-xs">
            <Breakdown label="Vehicle (deals only)" value={money(vehicle)} />
            <Breakdown label="Product spiffs" value={money(productSpiffs)} />
            <Breakdown label="Bonus spiffs" value={`+${money(bonus)}`} highlight />
          </div>
        </div>

        <div className="card flex flex-col items-center justify-between gap-4 p-6 text-center lg:col-span-5 lg:p-8">
          <div className="flex w-full items-center justify-between">
            <span className="eyebrow">Units sold</span>
            <span className="chip border border-primary/20 bg-surface-subtle font-mono text-primary">
              {closed ? "Final" : `Pace ${fmtUnits(Math.round(pace * 10) / 10)}`}
            </span>
          </div>
          <UnitsGauge
            value={units}
            target={nextTier?.startUnits ?? Math.max(view.priorBest + 1, units)}
            caption={nextTier ? `of ${nextTier.startUnits} for next tier` : "top tier"}
          />
          <div className="flex w-full items-center justify-between rounded-2xl border border-surface-border/60 bg-surface-subtle p-4 text-left">
            {nextTier ? (
              <>
                <div>
                  <span className="block text-xs font-bold leading-tight text-on-surface">
                    {fmtUnits(nextTier.startUnits - units)} to {money0(nextTier.amount)} / unit
                  </span>
                  <span className="block text-[11px] text-on-surface-subtle">Pays on every unit this month</span>
                </div>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                  +{money0((nextTier.amount - summary.miniRate) * nextTier.startUnits)}
                </span>
              </>
            ) : (
              <span className="text-xs font-bold text-on-surface">Top mini tier — {money0(summary.miniRate)} / unit</span>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaceChart
          daily={daily}
          elapsed={elapsed}
          monthLabel={monthLabel(month)}
          target={nextTier ? { units: nextTier.startUnits, label: `Tier ${currentMiniTierIndex(units, tiers) + 2}` } : undefined}
        />
        <BarChart
          title="Units by Month"
          subtitle="Last 12 months"
          bars={monthBars}
          refLines={view.priorBest > 0 ? [{ value: view.priorBest, label: `Personal best: ${fmtUnits(view.priorBest)} units` }] : []}
          formatValue={(n) => fmtUnits(Math.round(n * 10) / 10)}
        />
      </section>

      <TierLadder tiers={tiers} units={units} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatTile
          label="2-car days"
          value={paid?.two_car_day_count ?? summary.twoCarDayCount}
          detail={money(paid?.two_car_day_spiffs ?? summary.twoCarDaySpiffs)}
        />
        <StatTile
          label="Hat tricks"
          value={paid?.hat_trick_day_count ?? summary.hatTrickDayCount}
          detail={money(paid?.hat_trick_day_spiffs ?? summary.hatTrickDaySpiffs)}
        />
        <StatTile
          label="Personal best"
          value={fmtUnits(view.priorBest)}
          tone={(paid ? paid.personal_best_spiff > 0 : summary.personalBest) ? "success" : "default"}
          detail={
            (paid ? paid.personal_best_spiff > 0 : summary.personalBest)
              ? `New best! +${money0(settings.personal_best_spiff)}`
              : `Beat it for +${money0(settings.personal_best_spiff)}`
          }
        />
        <StatTile
          label="Store volume"
          value={view.storeUnits}
          badge={closed ? undefined : `pace ${Math.round(storePace)}`}
          tone={storeSpiff > 0 ? "primary" : "default"}
          detail={
            nextStoreTier
              ? `${storeSpiff > 0 ? `${money0(storeSpiff)} earned · ` : ""}${nextStoreTier.units - view.storeUnits} to ${money0(nextStoreTier.amount)}`
              : `${money0(storeSpiff)} earned — top tier`
          }
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">{fmtUnits(units)} units</span>
            <h3 className="display text-2xl text-white">Deals</h3>
          </div>
          {staff.id === me.id && !closed && canWrite && (
            <Link href="/deals/new" className="btn-secondary">
              + Log deal
            </Link>
          )}
        </div>
        <DealList
          deals={view.deals}
          commissions={commissions}
          productNames={productNames}
          staffNames={staffNames}
          viewerId={staff.id}
          canEdit={(d) => canWrite && (me.is_admin || (!closed && d.sale_date >= `${currentMonth()}-01`))}
        />
        {summary.adjustments !== 0 && (
          <p className="text-sm text-on-surface-muted">
            Includes {money(summary.adjustments)} in one-off spiffs.
          </p>
        )}
      </section>
    </>
  );
}

function Breakdown({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="block text-[11px] font-medium uppercase tracking-wider text-on-surface-subtle">{label}</span>
      <span className={`display mt-0.5 block text-base ${highlight ? "text-primary" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}
