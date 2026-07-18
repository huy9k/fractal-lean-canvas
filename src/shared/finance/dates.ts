/** Inclusive calendar-date window (`YYYY-MM-DD`). */
export type DateWindow = {
  start: string;
  end: string;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse `YYYY-MM-DD` into UTC midnight parts; throws on invalid calendar dates. */
export function parseIsoDate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    throw new Error(`Invalid ISO date "${iso}" (expected YYYY-MM-DD)`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${iso}"`);
  }
  return { year, month, day };
}

/** Compare two ISO dates: negative if a < b, zero if equal, positive if a > b. */
export function compareIsoDate(a: string, b: string): number {
  parseIsoDate(a);
  parseIsoDate(b);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Format UTC Y-M-D parts back to `YYYY-MM-DD`. */
export function formatIsoDate(
  year: number,
  month: number,
  day: number,
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True when `start ≤ end` as calendar dates. */
export function isValidWindow(window: DateWindow): boolean {
  return compareIsoDate(window.start, window.end) <= 0;
}

/** True when `inner` lies entirely within `outer` (inclusive). */
export function windowContains(outer: DateWindow, inner: DateWindow): boolean {
  return (
    compareIsoDate(outer.start, inner.start) <= 0 &&
    compareIsoDate(inner.end, outer.end) <= 0
  );
}

/** Inclusive intersection, or `undefined` when ranges do not overlap. */
export function intersectWindows(
  a: DateWindow,
  b: DateWindow,
): DateWindow | undefined {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  if (compareIsoDate(start, end) > 0) return undefined;
  return { start, end };
}

/** Advance a calendar date by N days. */
export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

/** Advance by N weeks. */
export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

/**
 * Advance by N calendar months, clamping day-of-month to the target month's length
 * (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = daysInMonth(nextYear, nextMonth);
  return formatIsoDate(nextYear, nextMonth, Math.min(day, lastDay));
}

/** Advance by N calendar years (Feb 29 → Feb 28 in non-leap years). */
export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
