import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareIsoDate,
  type DateWindow,
  windowContains,
} from "./dates.js";

/** One-shot or recurring billing schedule. */
export type BillingCadence =
  | { type: "one_time" }
  | {
      type: "recurring";
      every: number;
      unit: "day" | "week" | "month" | "year";
    };

/** Money line fields used by cadence totals (cost or revenue). */
export type TimedMoneyFields = {
  amountMinor: number;
  cadence: BillingCadence;
  startDate?: string;
  endDate?: string;
};

/** Canvas date bounds for inheritance. */
export type CanvasDateBounds = {
  startDate: string;
  endDate: string;
};

/**
 * Resolve a timed item's effective window by inheriting omitted bounds from the canvas.
 * Throws when the effective window is invalid or not ⊆ canvas.
 */
export function effectiveWindow(
  item: Pick<TimedMoneyFields, "startDate" | "endDate">,
  canvas: CanvasDateBounds,
): DateWindow {
  const canvasWindow: DateWindow = {
    start: canvas.startDate,
    end: canvas.endDate,
  };
  if (compareIsoDate(canvasWindow.start, canvasWindow.end) > 0) {
    throw new Error(
      `Canvas window invalid: ${canvasWindow.start} > ${canvasWindow.end}`,
    );
  }

  const window: DateWindow = {
    start: item.startDate ?? canvas.startDate,
    end: item.endDate ?? canvas.endDate,
  };
  if (compareIsoDate(window.start, window.end) > 0) {
    throw new Error(`Item window invalid: ${window.start} > ${window.end}`);
  }
  if (!windowContains(canvasWindow, window)) {
    throw new Error(
      `Item window ${window.start}…${window.end} exceeds canvas ${canvasWindow.start}…${canvasWindow.end}`,
    );
  }
  return window;
}

/**
 * Charge days in an inclusive window.
 * `one_time` → window.start when start ≤ end.
 * Recurring → start, then every N units, while day ≤ end. No proration.
 */
export function chargeDates(
  cadence: BillingCadence,
  window: DateWindow,
): string[] {
  if (compareIsoDate(window.start, window.end) > 0) return [];

  if (cadence.type === "one_time") {
    return [window.start];
  }

  if (cadence.every < 1) {
    throw new Error(
      `Recurring cadence.every must be ≥ 1 (got ${cadence.every})`,
    );
  }

  const dates: string[] = [];
  let cursor = window.start;
  // Cap iterations to avoid runaway on bad input (≈ 100 years of daily charges).
  const MAX_CHARGES = 40_000;
  while (compareIsoDate(cursor, window.end) <= 0) {
    dates.push(cursor);
    if (dates.length > MAX_CHARGES) {
      throw new Error("Charge date generation exceeded safety limit");
    }
    cursor = advance(cursor, cadence.every, cadence.unit);
  }
  return dates;
}

/** Total minor units for one timed line over a billing window (no proration). */
export function totalMinor(item: TimedMoneyFields, window: DateWindow): number {
  const count = chargeDates(item.cadence, window).length;
  return item.amountMinor * count;
}

/** Sum cost totals − revenue totals for a canvas over a window. */
export function netBurnMinor(
  canvas: {
    startDate: string;
    endDate: string;
    costStructure: { expenses: TimedMoneyFields[] };
    revenueStreams: { returns: TimedMoneyFields[] };
  },
  window: DateWindow,
): number {
  const costs = canvas.costStructure.expenses.reduce((sum, e) => {
    const itemWindow = effectiveWindow(e, canvas);
    const overlapStart =
      itemWindow.start > window.start ? itemWindow.start : window.start;
    const overlapEnd =
      itemWindow.end < window.end ? itemWindow.end : window.end;
    if (compareIsoDate(overlapStart, overlapEnd) > 0) return sum;
    return sum + totalMinor(e, { start: overlapStart, end: overlapEnd });
  }, 0);

  const revenues = canvas.revenueStreams.returns.reduce((sum, r) => {
    const itemWindow = effectiveWindow(r, canvas);
    const overlapStart =
      itemWindow.start > window.start ? itemWindow.start : window.start;
    const overlapEnd =
      itemWindow.end < window.end ? itemWindow.end : window.end;
    if (compareIsoDate(overlapStart, overlapEnd) > 0) return sum;
    return sum + totalMinor(r, { start: overlapStart, end: overlapEnd });
  }, 0);

  return costs - revenues;
}

function advance(
  iso: string,
  every: number,
  unit: "day" | "week" | "month" | "year",
): string {
  switch (unit) {
    case "day":
      return addDays(iso, every);
    case "week":
      return addWeeks(iso, every);
    case "month":
      return addMonths(iso, every);
    case "year":
      return addYears(iso, every);
  }
}
