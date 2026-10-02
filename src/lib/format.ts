const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money = (n: number | null | undefined): string => (n == null ? "—" : usd.format(n));
export const money0 = (n: number | null | undefined): string => (n == null ? "—" : usd0.format(n));

/** 16 → "16", 15.5 → "15.5" */
export const units = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};
