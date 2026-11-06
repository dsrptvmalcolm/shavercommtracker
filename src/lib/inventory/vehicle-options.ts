/** A car the deal form can suggest for the stock number field. */
export type VehicleOption = {
  id: string;
  stockNumber: string;
  /** "Year Make Model Trim" */
  title: string;
  image: string | null;
  /** Left inventory (in the last 30 days) */
  gone: boolean;
};

/** Suggestions for what's typed: every word must appear; stock-number prefix matches first, then in-stock cars. */
export const searchVehicleOptions = (options: VehicleOption[], q: string, limit = 8): VehicleOption[] => {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const rank = (o: VehicleOption) => (o.stockNumber.toLowerCase().startsWith(terms[0]) ? 0 : 2) + (o.gone ? 1 : 0);
  return options
    .filter((o) => terms.every((t) => `${o.stockNumber} ${o.title}`.toLowerCase().includes(t)))
    .sort((a, b) => rank(a) - rank(b) || a.stockNumber.localeCompare(b.stockNumber))
    .slice(0, limit);
};
