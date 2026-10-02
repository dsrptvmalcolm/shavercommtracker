"use client";

import { useState } from "react";

type Props = {
  /** Units sold on each calendar day of the month (index 0 = day 1) */
  daily: number[];
  /** Calendar days elapsed (0 for future months, full month when closed) */
  todayDay: number;
  /** Whether each calendar day is a selling day (Mon–Sat, not a holiday) */
  workingDayFlags: boolean[];
  target?: { units: number; label: string };
  monthLabel: string;
};

const W = 600;
const H = 180;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Cumulative units through the month. The projection grows only on selling days,
 * at the rate sold so far per selling day; closed days are shaded.
 */
export function PaceChart({ daily, todayDay, workingDayFlags, target, monthLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const days = daily.length;
  const cumulative = daily.reduce<number[]>((acc, u, i) => [...acc, (acc[i - 1] ?? 0) + u], []);
  const sold = cumulative[todayDay - 1] ?? 0;
  const elapsedWorking = workingDayFlags.slice(0, todayDay).filter(Boolean).length;
  const rate = elapsedWorking > 0 ? sold / elapsedWorking : 0;

  // Projected cumulative for each future day — only selling days add units
  const projection: number[] = [];
  workingDayFlags.forEach((working, i) => {
    if (i < todayDay) return;
    const prev = projection.at(-1) ?? sold;
    projection.push(prev + (working ? rate : 0));
  });
  const projected = projection.at(-1) ?? sold;
  const pending = todayDay > 0 && todayDay < days;

  const max = Math.max(projected, target?.units ?? 0, sold, 1) * 1.1;
  const x = (day: number) => ((day - 0.5) / days) * W;
  const y = (units: number) => H - (units / max) * H;
  const colW = W / days;

  const actual = cumulative.slice(0, todayDay).map((u, i) => `${x(i + 1)},${y(u)}`).join(" ");
  const pacePoints = [`${x(todayDay)},${y(sold)}`, ...projection.map((u, i) => `${x(todayDay + i + 1)},${y(u)}`)].join(" ");
  const shown = hover ?? (todayDay > 0 ? todayDay : null);
  const valueAt = (day: number) => (day <= todayDay ? cumulative[day - 1] : projection[day - todayDay - 1]);

  return (
    <figure className="card p-6">
      <figcaption className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="eyebrow">{monthLabel}</span>
          <h3 className="display text-xl text-white">Month Pace</h3>
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] text-on-surface-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Units sold</span>
          {pending && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-primary/60" /> Pace</span>}
          {target && <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-on-surface-subtle" /> {target.label}</span>}
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-white/[0.06]" /> Closed</span>
        </div>
      </figcaption>

      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.min(days, Math.max(1, Math.ceil(((e.clientX - r.left) / r.width) * days))));
          }}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${fmt(sold)} units sold in ${elapsedWorking} selling days${pending ? `, pacing for ${fmt(round1(projected))}` : ""}`}
        >
          {workingDayFlags.map((working, i) =>
            working ? null : <rect key={i} x={i * colW} y={0} width={colW} height={H} fill="#ffffff" fillOpacity={0.05} />,
          )}
          <line x1={0} x2={W} y1={H} y2={H} stroke="#282830" vectorEffect="non-scaling-stroke" />
          {target && (
            <line x1={0} x2={W} y1={y(target.units)} y2={y(target.units)} stroke="#686877" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
          {pending && (
            <polyline points={pacePoints} fill="none" stroke="#facc15" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {todayDay > 0 && (
            <polyline points={actual} fill="none" stroke="#facc15" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#9696a4" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* Markers and labels live in HTML so they don't stretch with the SVG */}
        {target && (
          <span className="pointer-events-none absolute right-0 -translate-y-full font-mono text-[10px] text-on-surface-muted" style={{ top: y(target.units) }}>
            {fmt(target.units)}
          </span>
        )}
        {shown !== null && valueAt(shown) !== undefined && (
          <span
            className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-card ${shown <= todayDay ? "bg-primary" : "bg-primary/60"}`}
            style={{ left: `${(x(shown) / W) * 100}%`, top: y(valueAt(shown)) }}
          />
        )}
        {pending && hover === null && (
          <span className="pointer-events-none absolute right-0 font-mono text-[10px] font-bold text-primary" style={{ top: Math.max(y(projected) - 16, 0) }}>
            pace {fmt(round1(projected))}
          </span>
        )}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            style={hover > days / 2 ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
          >
            <p className="font-bold text-white">
              Day {hover}
              {!workingDayFlags[hover - 1] && <span className="font-normal text-on-surface-subtle"> · closed</span>}
            </p>
            {hover <= todayDay ? (
              <>
                <p className="text-on-surface-muted">{fmt(daily[hover - 1])} sold that day</p>
                <p className="text-on-surface-muted">{fmt(cumulative[hover - 1])} for the month</p>
              </>
            ) : (
              todayDay > 0 && <p className="text-on-surface-muted">On pace for {fmt(round1(valueAt(hover)))}</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-on-surface-subtle">
        <span>Day 1</span>
        <span>Day {Math.ceil(days / 2)}</span>
        <span>Day {days}</span>
      </div>
    </figure>
  );
}
