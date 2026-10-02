"use client";

import { useState } from "react";

type Props = {
  /** Units sold on each day of the month (index 0 = day 1) */
  daily: number[];
  /** Days elapsed so far (0 for future months, full month when closed) */
  elapsed: number;
  target?: { units: number; label: string };
  monthLabel: string;
};

const W = 600;
const H = 180;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Cumulative units through the month, with a projection at the current pace and the next tier as a target line. */
export function PaceChart({ daily, elapsed, target, monthLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const days = daily.length;
  const cumulative = daily.reduce<number[]>((acc, u, i) => [...acc, (acc[i - 1] ?? 0) + u], []);
  const sold = cumulative[elapsed - 1] ?? 0;
  const projected = elapsed > 0 ? (sold / elapsed) * days : 0;
  const max = Math.max(projected, target?.units ?? 0, sold, 1) * 1.1;

  const x = (day: number) => ((day - 0.5) / days) * W;
  const y = (units: number) => H - (units / max) * H;

  const actual = cumulative.slice(0, elapsed).map((u, i) => `${x(i + 1)},${y(u)}`).join(" ");
  const pending = elapsed < days && elapsed > 0;
  const shown = hover ?? (elapsed > 0 ? elapsed : null);

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
          aria-label={`${fmt(sold)} units sold in ${elapsed} days${pending ? `, pacing for ${fmt(Math.round(projected * 10) / 10)}` : ""}`}
        >
          <line x1={0} x2={W} y1={H} y2={H} stroke="#282830" vectorEffect="non-scaling-stroke" />
          {target && (
            <line x1={0} x2={W} y1={y(target.units)} y2={y(target.units)} stroke="#686877" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
          {pending && (
            <line x1={x(elapsed)} y1={y(sold)} x2={x(days)} y2={y(projected)} stroke="#facc15" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {elapsed > 0 && (
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
        {shown !== null && shown <= elapsed && (
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface-card"
            style={{ left: `${(x(shown) / W) * 100}%`, top: y(cumulative[shown - 1]) }}
          />
        )}
        {pending && hover === null && (
          <span className="pointer-events-none absolute right-0 font-mono text-[10px] font-bold text-primary" style={{ top: Math.max(y(projected) - 16, 0) }}>
            pace {fmt(Math.round(projected * 10) / 10)}
          </span>
        )}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            style={hover > days / 2 ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
          >
            <p className="font-bold text-white">Day {hover}</p>
            {hover <= elapsed ? (
              <>
                <p className="text-on-surface-muted">{fmt(daily[hover - 1])} sold that day</p>
                <p className="text-on-surface-muted">{fmt(cumulative[hover - 1])} for the month</p>
              </>
            ) : (
              <p className="text-on-surface-muted">Pace: {fmt(Math.round((projected / days) * hover * 10) / 10)}</p>
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
