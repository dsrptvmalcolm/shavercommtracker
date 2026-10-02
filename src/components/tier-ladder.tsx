import { money0, units as fmtUnits } from "@/lib/format";

type Step = { at: number; amount: number };

type Props = {
  eyebrow: string;
  title: string;
  value: number;
  steps: Step[];
  /** Mini tiers: tier 1 applies from zero. Store volume: nothing is earned until the first tier. */
  firstStepIsBase?: boolean;
  /** Caption under each step, e.g. "15+ cars · $225" */
  stepDetail: (step: Step) => string;
  /** What reaching a step is worth, shown on steps not yet reached */
  gainFor: (step: Step, current: Step | undefined) => number;
  summary: React.ReactNode;
};

/** Progress across tiers — the current tier is lit, the next ones show units to go and the dollar jump. */
export function TierLadder({ eyebrow, title, value, steps, firstStepIsBase = false, stepDetail, gainFor, summary }: Props) {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  const reachedIdx = sorted.findLastIndex((t) => value >= t.at);
  const currentIdx = firstStepIsBase ? Math.max(reachedIdx, 0) : reachedIdx;
  const current = sorted[currentIdx];

  // Nodes are evenly spaced, so fill piecewise between steps
  const segments = Math.max(sorted.length - 1, 1);
  const from = current?.at ?? 0;
  const next = sorted[currentIdx + 1];
  const within = next ? (value - from) / (next.at - from) : 0;
  const fill = currentIdx < 0 ? 0 : Math.min(Math.max((currentIdx + Math.max(within, 0)) / segments, 0), 1);
  const inset = `${50 / sorted.length}%`;

  return (
    <section className="card p-6 lg:p-8">
      <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</span>
          <h2 className="display mt-0.5 text-2xl text-white">{title}</h2>
        </div>
        <p className="text-xs font-medium text-on-surface-muted">{summary}</p>
      </div>
      <div className="relative pt-2">
        <div className="absolute top-8 h-1.5 -translate-y-1/2 rounded-full bg-surface-subtle" style={{ left: inset, right: inset }}>
          <div className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))` }}>
          {sorted.map((t, i) => {
            const state = i < currentIdx ? "cleared" : i === currentIdx ? "current" : "next";
            return (
              <div key={t.at} className="flex flex-col items-center text-center">
                <div
                  className={`z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black ${
                    state === "current"
                      ? "bg-primary text-black shadow-[0_0_20px_rgba(250,204,21,0.4)] ring-4 ring-primary/20"
                      : state === "cleared"
                        ? "border-2 border-primary/70 bg-surface-card text-primary"
                        : "border-2 border-dashed border-surface-border bg-surface-subtle text-on-surface-subtle"
                  }`}
                >
                  {state === "cleared" ? "✓" : i + 1}
                </div>
                <span className={`display mt-3 text-base ${state === "current" ? "text-primary" : state === "next" ? "text-on-surface-muted" : "text-white"}`}>
                  Tier {i + 1}
                </span>
                <span className="text-xs text-on-surface-muted">{stepDetail(t)}</span>
                {state === "current" && <span className="chip mt-1 bg-primary-soft text-primary">CURRENT</span>}
                {state === "cleared" && <span className="mt-1 font-mono text-xs font-semibold text-success">CLEARED</span>}
                {state === "next" && (
                  <span className="mt-1 font-mono text-xs font-bold text-primary">
                    {fmtUnits(t.at - value)} to go · +{money0(gainFor(t, current))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
