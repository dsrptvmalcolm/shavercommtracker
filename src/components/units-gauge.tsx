import { units as fmtUnits } from "@/lib/format";

/** Radial gauge of units toward a target. */
export function UnitsGauge({ value, target, caption }: { value: number; target: number; caption: string }) {
  const circumference = 2 * Math.PI * 48;
  const pct = target > 0 ? Math.min(value / target, 1) : 1;
  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-48 w-48 -rotate-90 lg:h-56 lg:w-56" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="48" fill="none" stroke="#23232c" strokeWidth="9" strokeLinecap="round" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="#facc15"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-5xl text-white">{fmtUnits(value)}</span>
        <span className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-on-surface-subtle">{caption}</span>
      </div>
    </div>
  );
}
