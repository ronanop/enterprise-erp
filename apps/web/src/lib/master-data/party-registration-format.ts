/** Shared formatting for registration amounts shown across list and detail views. */

const INR = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return INR.format(value);
}

/**
 * Indian business users read large rupee figures in lakh and crore, not in
 * millions. Amounts above a lakh get the short form alongside the full number.
 */
export function formatAmountShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${(value / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `${(value / 100_000).toFixed(2)} L`;
  return INR.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
