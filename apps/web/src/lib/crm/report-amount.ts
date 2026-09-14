/** Indian rupee compact display for CRM report amount columns. */

const AMOUNT_HINT =
  /(amount|revenue|price|freight|charges|budget|grand_total|mrr|arr|unit_cost|sale_value|committed)/i;

const NON_AMOUNT_HINT = /(percent|_pct$|probability|rate|qty|quantity|count|days|revision)/i;

/** True when a report column key should render as currency. */
export function isReportAmountColumn(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k || NON_AMOUNT_HINT.test(k)) return false;
  return AMOUNT_HINT.test(k);
}

/**
 * Format amounts in rupees with 2 decimal places.
 * K = thousands, L = lakhs, C = crore.
 * Examples: ₹999.50 · ₹1.50K · ₹2.25L · ₹1.00C
 */
export function formatReportAmountInr(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}C`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}₹${abs.toFixed(2)}`;
}

/** Full INR with 2 decimals (for tooltips / accessibility). */
export function formatReportAmountInrFull(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatReportCellValue(columnKey: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (isReportAmountColumn(columnKey)) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;
    if (Number.isFinite(n)) return formatReportAmountInr(n);
  }

  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatReportCellTitle(columnKey: string, value: unknown): string {
  if (isReportAmountColumn(columnKey)) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;
    if (Number.isFinite(n)) return formatReportAmountInrFull(n);
  }
  return formatReportCellValue(columnKey, value);
}
