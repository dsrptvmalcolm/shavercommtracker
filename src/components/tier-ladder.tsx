import { money0, units as fmtUnits } from "@/lib/format";

type Tier = { startUnits: number; amount: number };

/** Mini tier path — the reached tier pays on every unit, so the next jump is shown in dollars. */
export function TierLadder({ tiers, units }: { tiers: Tier[]; units: number }) {
  const sorted = [...tiers].sort((a, b) => a.startUnits - b.startUnits);
  const currentIdx = Math.max(sorted.findLastIndex((t) => units >= t.startUnits), 0);
  // Nodes are evenly spaced, so fill piecewise between tier starts
  const segments = Math.max(sorted.length - 1, 1);
  const next = sorted[currentIdx + 1];
  const within = next ? (units - sorted[currentIdx].startUnits) / (next.startUnits - sorted[currentIdx].startUnits) : 0;
  const fill = Math.min(Math.max((currentIdx + Math.max(within, 0)) / segments, 0), 1);
  const inset = `${50 / sorted.length}%`;

  return (
    <section className="card p-6 lg:p-8">
      <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Mini ladder</span>
          <h2 className="display mt-0.5 text-2xl text-white">Tier Path</h2>
        </div>
        <p className="text-xs font-medium text-on-surface-muted">
          At <strong className="font-bold text-primary">Tier {currentIdx + 1} — {money0(sorted[currentIdx].amount)} / unit</strong> on all{" "}
          {fmtUnits(units)} units
        </p>
      </div>
      <div className="relative pt-2">
        <div className="absolute top-8 h-1.5 -translate-y-1/2 rounded-full bg-surface-subtle" style={{ left: inset, right: inset }}>
          <div className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))` }}>
          {sorted.map((t, i) => {
            const state = i < currentIdx ? "cleared" : i === currentIdx ? "current" : "next";
            const toGo = t.startUnits - units;
            const gain = (t.amount - sorted[currentIdx].amount) * Math.max(units, t.startUnits);
            return (
              <div key={t.startUnits} className="flex flex-col items-center text-center">
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
                <span className="text-xs text-on-surface-muted">
                  {t.startUnits}+ cars · {money0(t.amount)}
                </span>
                {state === "current" && <span className="chip mt-1 bg-primary-soft text-primary">CURRENT</span>}
                {state === "cleared" && <span className="mt-1 font-mono text-[10px] font-semibold text-success">CLEARED</span>}
                {state === "next" && (
                  <span className="mt-1 font-mono text-[10px] font-bold text-primary">
                    {fmtUnits(toGo)} to go · +{money0(gain)}
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
