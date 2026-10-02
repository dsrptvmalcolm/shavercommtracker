/** Labeled figure in a hero card's footer row. */
export function Breakdown({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium uppercase tracking-wider text-on-surface-subtle">{label}</span>
      <span className={`display mt-0.5 block text-base ${highlight ? "text-primary" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}
