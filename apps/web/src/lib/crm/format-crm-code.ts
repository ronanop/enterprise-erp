/**
 * Shorten CRM document codes for display.
 * QT-2026-000014 → QT-2026-14 (strips leading zeros on the sequence).
 * Leaves company-style codes (COMP-01) unchanged.
 */
export function formatCrmCode(code: string | null | undefined): string {
  if (!code) return "";
  const trimmed = code.trim();
  // PREFIX-YYYY-000014 → PREFIX-YYYY-14
  const yearSeq = trimmed.match(/^([A-Za-z]+-\d{4}-)0*([1-9]\d*|0)$/);
  if (yearSeq) {
    return `${yearSeq[1]}${yearSeq[2]}`;
  }
  return trimmed;
}
