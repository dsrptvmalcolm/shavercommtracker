export function StatTile({
  label,
  value,
  detail,
  badge,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: "default" | "primary" | "success";
}) {
  const valueTone = tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : "text-white";
  return (
    <div className="card flex flex-col justify-between p-5 lg:p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {badge && <span className="font-mono text-xs font-bold text-primary">{badge}</span>}
      </div>
      <div className="mt-3">
        <div className={`display text-3xl lg:text-4xl ${valueTone}`}>{value}</div>
        {detail && <div className="mt-1 text-xs text-on-surface-subtle">{detail}</div>}
      </div>
    </div>
  );
}
