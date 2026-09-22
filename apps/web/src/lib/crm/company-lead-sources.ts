/** Company Source + Lead Source shared option order/labels. */

export const COMPANY_LEAD_SOURCES = [
  "referral",
  "website",
  "cold_call",
  "multi_tier",
  "event",
  "advertisement",
  "other",
] as const;

export type CompanyLeadSource = (typeof COMPANY_LEAD_SOURCES)[number];

export function companyLeadSourceLabel(source: string): string {
  const normalized = source === "partner" ? "multi_tier" : source;
  if (normalized === "multi_tier") return "Multi-Tier";
  return normalized.replaceAll("_", " ");
}

export function normalizeCompanyLeadSource(source: string): string {
  return source === "partner" ? "multi_tier" : source;
}

/** Compare company source codes / free-text to lead-source option labels. */
export function normalizeSourceMatchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");
}

export function companySourceToLeadMatchKey(companySource: string): string {
  const normalized = companySource === "partner" ? "multi_tier" : companySource.trim();
  if ((COMPANY_LEAD_SOURCES as readonly string[]).includes(normalized)) {
    return normalizeSourceMatchKey(companyLeadSourceLabel(normalized));
  }
  // Free-text "other" values still try exact label match; else map to Other.
  return normalizeSourceMatchKey(normalized) || "other";
}

export function sortLeadSourcesByCompanyOrder<T extends { label: string }>(rows: T[]): T[] {
  const order = COMPANY_LEAD_SOURCES.map((code) =>
    normalizeSourceMatchKey(companyLeadSourceLabel(code)),
  );
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(normalizeSourceMatchKey(a.label));
    const bi = order.indexOf(normalizeSourceMatchKey(b.label));
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
