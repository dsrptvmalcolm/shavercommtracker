/** Shown instantly on navigation while the next page's data loads. */
export default function Loading() {
  const block = "animate-pulse rounded-3xl border border-surface-border/60 bg-surface-card";
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-8">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-card" />
        <div className="h-10 w-64 animate-pulse rounded bg-surface-card" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`${block} h-72 lg:col-span-7`} />
        <div className={`${block} h-72 lg:col-span-5`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
      <div className={`${block} h-64`} />
    </div>
  );
}
