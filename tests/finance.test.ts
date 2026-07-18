import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMonths,
  chargeDates,
  compareIsoDate,
  effectiveWindow,
  formatMoney,
  minorUnitExponent,
  netBurnMinor,
  parseIsoDate,
  totalMinor,
  type BillingCadence,
} from "../src/shared/finance/index.js";

describe("parseIsoDate / compareIsoDate", () => {
  it("parses valid calendar dates", () => {
    assert.deepEqual(parseIsoDate("2026-02-28"), {
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  it("rejects malformed and impossible dates", () => {
    assert.throws(() => parseIsoDate("2026/01/01"));
    assert.throws(() => parseIsoDate("2026-02-30"));
  });

  it("compares chronologically", () => {
    assert.equal(compareIsoDate("2026-01-01", "2026-01-02"), -1);
    assert.equal(compareIsoDate("2026-01-01", "2026-01-01"), 0);
  });
});

describe("addMonths month-end clamp", () => {
  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    assert.equal(addMonths("2010-01-31", 1), "2010-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    assert.equal(addMonths("2012-01-31", 1), "2012-02-29");
  });
});

describe("chargeDates", () => {
  const year: { start: string; end: string } = {
    start: "2010-01-01",
    end: "2010-12-31",
  };

  it("one_time charges on window start", () => {
    assert.deepEqual(chargeDates({ type: "one_time" }, year), ["2010-01-01"]);
  });

  it("monthly across a full year yields 12 charges", () => {
    const cadence: BillingCadence = {
      type: "recurring",
      every: 1,
      unit: "month",
    };
    assert.equal(chargeDates(cadence, year).length, 12);
    assert.equal(chargeDates(cadence, year)[0], "2010-01-01");
    assert.equal(chargeDates(cadence, year)[11], "2010-12-01");
  });

  it("includes a charge on the inclusive end date", () => {
    const cadence: BillingCadence = {
      type: "recurring",
      every: 1,
      unit: "month",
    };
    const dates = chargeDates(cadence, {
      start: "2010-01-15",
      end: "2010-03-15",
    });
    assert.deepEqual(dates, ["2010-01-15", "2010-02-15", "2010-03-15"]);
  });

  it("supports every 2 weeks", () => {
    const dates = chargeDates(
      { type: "recurring", every: 2, unit: "week" },
      { start: "2010-01-01", end: "2010-02-12" },
    );
    assert.deepEqual(dates, [
      "2010-01-01",
      "2010-01-15",
      "2010-01-29",
      "2010-02-12",
    ]);
  });

  it("supports every 2 months from mid-month start", () => {
    const dates = chargeDates(
      { type: "recurring", every: 2, unit: "month" },
      { start: "2010-01-15", end: "2010-07-15" },
    );
    assert.deepEqual(dates, [
      "2010-01-15",
      "2010-03-15",
      "2010-05-15",
      "2010-07-15",
    ]);
  });
});

describe("effectiveWindow", () => {
  const canvas = { startDate: "2010-01-01", endDate: "2010-12-31" };

  it("inherits omitted item dates from the canvas", () => {
    assert.deepEqual(effectiveWindow({}, canvas), {
      start: "2010-01-01",
      end: "2010-12-31",
    });
  });

  it("allows a tighter item window inside the canvas", () => {
    assert.deepEqual(
      effectiveWindow(
        { startDate: "2010-03-01", endDate: "2010-06-30" },
        canvas,
      ),
      { start: "2010-03-01", end: "2010-06-30" },
    );
  });

  it("rejects item windows outside the canvas", () => {
    assert.throws(() =>
      effectiveWindow(
        { startDate: "2009-12-01", endDate: "2010-06-01" },
        canvas,
      ),
    );
  });
});

describe("totalMinor / netBurnMinor", () => {
  const monthly: BillingCadence = {
    type: "recurring",
    every: 1,
    unit: "month",
  };

  it("multiplies amountMinor by charge count", () => {
    const total = totalMinor(
      { amountMinor: 1000, cadence: monthly },
      { start: "2010-01-01", end: "2010-03-01" },
    );
    assert.equal(total, 3000);
  });

  it("computes net burn as costs minus revenues", () => {
    const canvas = {
      startDate: "2010-01-01",
      endDate: "2010-12-31",
      costStructure: {
        expenses: [{ amountMinor: 5000_00, cadence: monthly }],
      },
      revenueStreams: {
        returns: [{ amountMinor: 8000_00, cadence: monthly }],
      },
    };
    const burn = netBurnMinor(canvas, {
      start: "2010-01-01",
      end: "2010-12-31",
    });
    // 12 * (500000 - 800000) = -3_600_000
    assert.equal(burn, -3_600_000);
  });
});

describe("formatMoney / minorUnitExponent", () => {
  it("uses 2 decimals for USD", () => {
    assert.equal(minorUnitExponent("USD"), 2);
    assert.equal(formatMoney(12345, "USD"), "USD 123.45");
  });

  it("uses 0 decimals for JPY and VND", () => {
    assert.equal(minorUnitExponent("JPY"), 0);
    assert.equal(formatMoney(12345, "JPY"), "JPY 12,345");
    assert.equal(formatMoney(1_000_000, "VND"), "VND 1,000,000");
  });
});
