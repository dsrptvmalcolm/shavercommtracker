export type Bar = {
  key: string;
  label: string;
  value: number;
  /** Emphasized bar (e.g. the month being viewed) */
  highlight?: boolean;
  /** Lines shown in the hover tooltip */
  tooltip: string[];
};

/** Dashed reference line. Labels go in a legend under the chart so close lines never collide. */
export type RefLine = { value: number; label: string };

type Props = {
  title: string;
  subtitle?: string;
  bars: Bar[];
  refLines?: RefLine[];
  formatValue?: (n: number) => string;
  height?: number;
};

/** Minimum vertical distance between axis labels, in px (12px text + breathing room) */
const LABEL_GAP = 14;

const niceMax = (n: number): number => {
  if (n <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= n) ?? 10 * mag;
};

/**
 * Single-series column chart. Server-rendered HTML; hover, focus or tap shows a tooltip.
 * Values are direct-labeled only on the highlighted bar and the peak.
 */
export function BarChart({ title, subtitle, bars, refLines = [], formatValue = String, height = 180 }: Props) {
  const max = niceMax(Math.max(...bars.map((b) => b.value), ...refLines.map((r) => r.value), 1));
  const peak = Math.max(...bars.map((b) => b.value));
  const px = (v: number) => (v / max) * height;
  const pct = (v: number) => `${(v / max) * 100}%`;
  // Reference lines are labeled on the axis at their own value, nudged apart so close lines never collide;
  // default ticks that would crowd a reference label are dropped.
  const refLabels = [...refLines]
    .sort((a, b) => b.value - a.value)
    .reduce<{ line: RefLine; y: number }[]>((acc, line) => {
      const prev = acc.at(-1);
      return [...acc, { line, y: prev ? Math.min(px(line.value), prev.y - LABEL_GAP) : px(line.value) }];
    }, []);
  const ticks = [0, max / 2, max].filter((t) => refLabels.every((r) => Math.abs(px(t) - r.y) >= LABEL_GAP));

  return (
    <figure className="card p-6">
      <figcaption className="mb-5">
        <span className="eyebrow">{subtitle}</span>
        <h3 className="display text-xl text-white">{title}</h3>
      </figcaption>
      <div className="flex gap-3">
        <div className="relative w-8 shrink-0 text-right font-mono text-xs text-on-surface-subtle" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: px(t) }}>
              {formatValue(t)}
            </span>
          ))}
          {refLabels.map(({ line, y }) => (
            <span key={line.label} className="absolute right-0 translate-y-1/2 font-bold text-on-surface-muted" style={{ bottom: y }}>
              {formatValue(line.value)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {ticks.filter((t) => t > 0).map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-surface-border/50" style={{ bottom: pct(t) }} />
          ))}
          {refLines.map((r) => (
            <div key={r.label} className="absolute inset-x-0 border-t border-dashed border-on-surface-subtle/60" style={{ bottom: pct(r.value) }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-surface-border">
            {bars.map((b, i) => {
              const showLabel = b.highlight || (b.value === peak && b.value > 0);
              // Edge bars anchor their tooltip inward so it never runs off a phone screen
              const tipAlign = i < 2 ? "left-0" : i >= bars.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={b.key} tabIndex={0} role="img" className="group relative flex h-full flex-1 items-end justify-center" aria-label={`${b.label}: ${b.tooltip.join(", ")}`}>
                  <div
                    className={`w-full max-w-10 rounded-t transition-colors ${b.highlight ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/60 group-focus:bg-primary/60"}`}
                    style={{ height: pct(b.value), minHeight: b.value > 0 ? 2 : 0 }}
                  />
                  {showLabel && (
                    <span className="pointer-events-none absolute -translate-y-1 font-mono text-xs font-bold text-on-surface" style={{ bottom: pct(b.value) }}>
                      {formatValue(b.value)}
                    </span>
                  )}
                  <div className={`pointer-events-none absolute bottom-full ${tipAlign} z-10 mb-2 hidden w-max rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)] group-hover:block group-focus:block`}>
                    <p className="font-bold text-white">{b.label}</p>
                    {b.tooltip.map((t) => (
                      <p key={t} className="text-on-surface-muted">{t}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* 12 month labels share ~240px on a 360px phone; 12px would truncate them, so phones keep 10px, tightly tracked */}
      <div className="mt-2 ml-11 flex gap-[2px]">
        {bars.map((b) => (
          <span key={b.key} className={`flex-1 truncate text-center font-mono text-[10px] tracking-tighter sm:text-xs sm:tracking-normal ${b.highlight ? "font-bold text-primary" : "text-on-surface-subtle"}`}>
            {b.label}
          </span>
        ))}
      </div>
      {refLines.length > 0 && (
        <ul className="mt-4 grid gap-x-4 gap-y-1.5 border-t border-surface-border/60 pt-3 text-xs text-on-surface-muted sm:grid-cols-2">
          {refLines.map((r) => (
            <li key={r.label} className="flex items-center gap-2 font-mono">
              <span className="w-4 shrink-0 border-t border-dashed border-on-surface-subtle" aria-hidden />
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
