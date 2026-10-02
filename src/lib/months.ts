/** All month math runs in the dealership's timezone (Merrillville, IN). */
export const APP_TIMEZONE = "America/Chicago";

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Today as YYYY-MM-DD in the dealership's timezone */
export const todayIso = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export const currentMonth = (now: Date = new Date()): string => todayIso(now).slice(0, 7);

export const isMonth = (m: string | undefined | null): m is string => !!m && MONTH_RE.test(m);

export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** [first day, first day of next month) as YYYY-MM-DD */
export const monthRange = (month: string): { start: string; end: string } => ({
  start: `${month}-01`,
  end: `${shiftMonth(month, 1)}-01`,
});

export const daysInMonth = (month: string): number => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Days elapsed including today; full month for past months, 0 for future */
export const daysElapsed = (month: string, now: Date = new Date()): number => {
  const cur = currentMonth(now);
  if (month < cur) return daysInMonth(month);
  if (month > cur) return 0;
  return Number(todayIso(now).slice(8, 10));
};

export const monthLabel = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

export const isClosed = (month: string, now: Date = new Date()): boolean => month < currentMonth(now);

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

// Working days ------------------------------------------------------------
// The store sells Monday–Saturday; holidays (admin-managed) are excluded.

/** Every date in the month as YYYY-MM-DD */
export const datesInMonth = (month: string): string[] =>
  Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);

export const isWorkingDay = (isoDate: string, holidays: ReadonlySet<string>): boolean => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday !== 0 && !holidays.has(isoDate);
};

export const workingDaysIn = (month: string, holidays: ReadonlySet<string>): number =>
  datesInMonth(month).filter((d) => isWorkingDay(d, holidays)).length;

/** Working days elapsed including today; all of them for past months, 0 for future */
export const workingDaysElapsed = (month: string, holidays: ReadonlySet<string>, now: Date = new Date()): number => {
  const today = todayIso(now);
  return datesInMonth(month).filter((d) => d <= today && isWorkingDay(d, holidays)).length;
};
