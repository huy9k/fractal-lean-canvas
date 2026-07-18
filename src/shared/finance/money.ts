/** ISO 4217 currencies with non-default minor-unit exponents (default is 2). */
const EXPONENT_BY_CURRENCY: Readonly<Record<string, number>> = {
  BHD: 3,
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  IQD: 3,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  PYG: 0,
  RWF: 0,
  TND: 3,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

/** Minor-unit exponent for an ISO 4217 code (default 2). */
export function minorUnitExponent(currency: string): number {
  return EXPONENT_BY_CURRENCY[currency.toUpperCase()] ?? 2;
}

/**
 * Format minor units for display (e.g. 12345 USD → "USD 123.45").
 * Uses en-US grouping; currency code prefix keeps symbols unambiguous internationally.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const exp = minorUnitExponent(code);
  const major = amountMinor / 10 ** exp;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(major);
  return `${code} ${formatted}`;
}

/** Human label for a billing cadence (e.g. "/mo", "one-time"). */
export function formatCadence(cadence: {
  type: "one_time" | "recurring";
  every?: number;
  unit?: "day" | "week" | "month" | "year";
}): string {
  if (cadence.type === "one_time") return "one-time";
  const every = cadence.every ?? 1;
  const unit = cadence.unit ?? "month";
  if (every === 1) {
    switch (unit) {
      case "day":
        return "/day";
      case "week":
        return "/wk";
      case "month":
        return "/mo";
      case "year":
        return "/yr";
    }
  }
  return `every ${every} ${unit}${every === 1 ? "" : "s"}`;
}
