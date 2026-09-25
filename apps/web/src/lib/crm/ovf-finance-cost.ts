/** OVF Rule #7 — finance cost from payment-term gap (matches margin_engine). */

export const FINANCE_COST_PCT_PER_15_DAYS = 0.5;
/** First N days of funding gap are free. */
export const FINANCE_COST_BUFFER_DAYS = 5;

/**
 * gapDays = max(0, customerDays - vendorDays - 5)
 * finance_cost_pct = (gapDays / 15) * 0.5  → rounded to 2 decimal places
 */
export function computeFinanceCostPct(
  vendorPaymentDays: number,
  customerPaymentDays: number,
): number {
  const vendor = Math.max(0, Math.trunc(Number(vendorPaymentDays) || 0));
  const customer = Math.max(0, Math.trunc(Number(customerPaymentDays) || 0));
  const gapDays = customer - vendor - FINANCE_COST_BUFFER_DAYS;
  if (gapDays <= 0) return 0;
  return Number(((gapDays / 15) * FINANCE_COST_PCT_PER_15_DAYS).toFixed(2));
}
