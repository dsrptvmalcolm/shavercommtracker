import Link from "next/link";
import { Breakdown } from "@/components/breakdown";
import { BarChart } from "@/components/charts/bar-chart";
import { PaceChart } from "@/components/charts/pace-chart";
import { MonthNav } from "@/components/month-nav";
import { StatTile } from "@/components/stat-tile";
import { TierLadder } from "@/components/tier-ladder";
import { UnitsGauge } from "@/components/units-gauge";
import { ViewAsButton } from "@/components/view-as-button";
import { currentMiniTierIndex, paceFor, storeVolumeSpiffFor } from "@/lib/commission/engine";
import { getMonthCalendar, getStoreMonth, getStoreUnitsByMonth, requireAdmin } from "@/lib/data";
import { money, money0, units as fmtUnits } from "@/lib/format";
import { currentMonth, daysInMonth, isClosed, isMonth, monthLabel, shiftMonth } from "@/lib/months";

const CHART_MONTHS = 12;

export default async function StorePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const chartFrom = shiftMonth(month, -(CHART_MONTHS - 1));
  const [view, storeByMonth, cal] = await Promise.all([
    getStoreMonth(month),
    getStoreUnitsByMonth(chartFrom, month),
    getMonthCalendar(month),
  ]);

  const closed = isClosed(month);
  const storeUnits = view.storeUnits;
  const pace = closed ? storeUnits : paceFor(storeUnits, cal.elapsed, cal.workingDays);
  const tiers = [...view.settings.store_volume_tiers].sort((a, b) => a.units - b.units);
  const earned = storeVolumeSpiffFor(storeUnits, tiers);
  const nextTier = tiers.find((t) => t.units > storeUnits);
  const noBackGross = view.deals.filter((d) => d.back_gross == null && !d.is_house).length;
  const miniTiers = [...view.settings.mini_tiers].sort((a, b) => a.startUnits - b.startUnits);

  // Paid months show what was paid; open months show the live calculation
  const rows = view.rows
    .map((r) => {
      const total = r.paid?.total ?? r.summary.total;
      const vehicle = r.paid?.vehicle_commission ?? r.summary.vehicleCommission;
      const products = r.paid?.product_spiffs ?? r.summary.productSpiffs;
      return {
        ...r,
        units: r.paid?.units ?? r.summary.units,
        total,
        vehicle,
        products,
        bonus: total - vehicle - products,
        diff: r.paid ? r.summary.total - r.paid.total : 0,
      };
    })
    .sort((a, b) => b.units - a.units || b.total - a.total);
  const sum = (k: "total" | "vehicle" | "products" | "bonus") => rows.reduce((a, r) => a + r[k], 0);
  const twoCarDays = rows.reduce((a, r) => a + (r.paid?.two_car_day_count ?? r.summary.twoCarDayCount), 0);
  const hatTricks = rows.reduce((a, r) => a + (r.paid?.hat_trick_day_count ?? r.summary.hatTrickDayCount), 0);

  const daily = Array.from({ length: daysInMonth(month) }, () => 0);
  view.deals.forEach((d) => (daily[Number(d.sale_date.slice(8, 10)) - 1] += 1));

  const storeBars = Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(chartFrom, i)).map((m) => {
    const u = m === month ? storeUnits : (storeByMonth.get(m) ?? 0);
    const spiff = storeVolumeSpiffFor(u, tiers);
    return {
      key: m,
      label: monthLabel(m).slice(0, 3),
      value: u,
      highlight: m === month,
      tooltip: [`${u} store units`, spiff > 0 ? `${money0(spiff)} volume spiff each` : "No volume spiff", monthLabel(m)],
    };
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Store overview</p>
          <h1 className="display text-4xl text-white lg:text-5xl">{monthLabel(month)}</h1>
        </div>
        <MonthNav month={month} basePath="/admin" />
      </div>

      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="card relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-surface-card via-surface-card to-surface-subtle p-6 shadow-2xl lg:col-span-7 lg:p-10">
          <div className="pointer-events-none absolute -top-16 -left-16 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="chip border border-primary/30 bg-primary-soft px-3 py-1 text-xs uppercase tracking-wider text-primary">
              {closed ? "Team commission" : "MTD team commission"}
            </span>
            <span className="text-xs font-semibold text-on-surface-subtle">
              {closed ? "Month closed" : `${cal.remaining} selling days left`}
            </span>
          </div>
          <div className="relative my-8">
            <div className="flex items-baseline gap-1">
              <h2 className="display text-6xl text-white sm:text-7xl lg:text-8xl">{money(sum("total")).split(".")[0]}</h2>
              <span className="display text-2xl text-on-surface-subtle lg:text-3xl">.{money(sum("total")).split(".")[1]}</span>
            </div>
            <p className="mt-3 text-xs text-on-surface-muted">
              {rows.length} salespeople · {fmtUnits(storeUnits - view.houseUnits)} salesperson units + {view.houseUnits} house
            </p>
          </div>
          <div className="relative flex flex-wrap gap-6 border-t border-surface-border/70 pt-6 text-xs">
            <Breakdown label="Vehicle (deals only)" value={money(sum("vehicle"))} />
            <Breakdown label="Product spiffs" value={money(sum("products"))} />
            <Breakdown label="Bonus spiffs" value={`+${money(sum("bonus"))}`} highlight />
          </div>
        </div>

        <div className="card flex flex-col items-center justify-between gap-4 p-6 text-center lg:col-span-5 lg:p-8">
          <div className="flex w-full items-center justify-between">
            <span className="eyebrow">Store units</span>
            <span className="chip border border-primary/20 bg-surface-subtle font-mono text-primary">
              {closed ? "Final" : `Pace ${Math.round(pace)}`}
            </span>
          </div>
          <UnitsGauge
            value={storeUnits}
            target={nextTier?.units ?? storeUnits}
            caption={nextTier ? `of ${nextTier.units} for next tier` : "top tier"}
          />
          <div className="flex w-full items-center justify-between rounded-2xl border border-surface-border/60 bg-surface-subtle p-4 text-left">
            {nextTier ? (
              <>
                <div>
                  <span className="block text-xs font-bold leading-tight text-on-surface">
                    {nextTier.units - storeUnits} units to {money0(nextTier.amount)} each
                  </span>
                  <span className="block text-xs text-on-surface-subtle">
                    {earned > 0 ? `${money0(earned)} each earned so far` : "Paid to every salesperson"}
                  </span>
                </div>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                  +{money0((nextTier.amount - earned) * rows.length)}
                </span>
              </>
            ) : (
              <span className="text-xs font-bold text-on-surface">Top tier — {money0(earned)} to every salesperson</span>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaceChart
          daily={daily}
          todayDay={cal.todayDay}
          workingDayFlags={cal.workingDayFlags}
          monthLabel={monthLabel(month)}
          target={nextTier ? { units: nextTier.units, label: `${money0(nextTier.amount)} tier` } : undefined}
        />
        <BarChart
          title="Store Units by Month"
          subtitle="Last 12 months"
          bars={storeBars}
          refLines={tiers.map((t) => ({ value: t.units, label: `${t.units} units → ${money0(t.amount)}` }))}
        />
      </section>

      <TierLadder
        eyebrow="Store volume"
        title="Team Tier Path"
        value={storeUnits}
        steps={tiers.map((t) => ({ at: t.units, amount: t.amount }))}
        stepDetail={(t) => `${t.at}+ units · ${money0(t.amount)}`}
        // Highest tier only, paid to every salesperson
        gainFor={(t, cur) => (t.amount - (cur?.amount ?? 0)) * rows.length}
        summary={
          earned > 0 ? (
            <>
              Earning <strong className="font-bold text-primary">{money0(earned)} per salesperson</strong>
            </>
          ) : (
            "No store volume spiff yet"
          )
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatTile label="House deals" value={view.houseUnits} detail="Count toward store volume" />
        <StatTile label="2-car days" value={twoCarDays} detail="Across the team" />
        <StatTile label="Hat tricks" value={hatTricks} detail="3+ cars in a day" />
        <StatTile
          label="No back gross"
          value={noBackGross}
          tone={noBackGross > 0 ? "primary" : "success"}
          detail={
            <Link href={`/admin/deals?month=${month}&filter=missing`} className="underline hover:text-white">
              Review deals →
            </Link>
          }
        />
      </section>

      <section className="space-y-4">
        <div>
          <span className="eyebrow">Leaderboard</span>
          <h2 className="display text-2xl text-white">Salespeople</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r, i) => {
            const tierIdx = currentMiniTierIndex(r.units, miniTiers);
            const nextMini = miniTiers[tierIdx + 1];
            const progress = nextMini ? Math.min(r.units / nextMini.startUnits, 1) : 1;
            return (
              <div key={r.staff.id} className="card p-5 transition-colors hover:border-primary/40 lg:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-display text-lg ${i === 0 && r.units > 0 ? "bg-primary text-black" : "bg-surface-subtle text-on-surface-muted"}`}>
                      {i + 1}
                    </span>
                    <div>
                      <Link href={`/dashboard?staff=${r.staff.id}&month=${month}`} className="font-bold text-white hover:text-primary">
                        {r.staff.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="chip bg-surface-subtle text-on-surface-muted">
                          Tier {tierIdx + 1} · {money0(r.paid?.mini_rate ?? r.summary.miniRate)}
                        </span>
                        {(r.paid ? r.paid.personal_best_spiff > 0 : r.summary.personalBest) && (
                          <span className="chip bg-success/10 text-success">Personal best</span>
                        )}
                        {r.paid && <span className="chip bg-surface-subtle text-on-surface-subtle">Paid</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="display text-3xl text-white">{fmtUnits(r.units)}</div>
                    <div className="text-xs uppercase tracking-wider text-on-surface-subtle">units</div>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary" style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-on-surface-subtle">
                  {nextMini ? `${fmtUnits(nextMini.startUnits - r.units)} to Tier ${tierIdx + 2}` : "Top mini tier"}
                </p>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-surface-border/70 pt-4">
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-on-surface-subtle">Commission</span>
                    <span className="display text-2xl text-white">{money(r.total)}</span>
                    {Math.abs(r.diff) > 0.01 && (
                      <span className="block text-xs text-amber-300">
                        Recalc {r.diff > 0 ? "+" : ""}
                        {money(r.diff)} vs paid
                      </span>
                    )}
                  </div>
                  <div className="-mr-2 flex items-center gap-2">
                    <Link href={`/history?staff=${r.staff.id}`} className="inline-flex min-h-11 items-center px-2 text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-primary">
                      History
                    </Link>
                    {r.staff.active && <ViewAsButton staffId={r.staff.id} name={r.staff.name} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
