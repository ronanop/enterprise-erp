/**
 * CRM OVF delivery period — matches `textOrDash(ovf.delivery_period)` on the OVF detail page.
 * Values may be `YYYY-MM-DD` or free text (e.g. "6 weeks from PO").
 */
export function formatOvfDeliveryPeriodDisplay(value?: string | null): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}
